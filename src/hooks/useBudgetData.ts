import { useState, useEffect, useCallback, useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useStaticData';
import {
  buildEffectiveMonthExpenses,
  buildMaterializedRecurringSignature,
  buildRecurringExceptionSignature,
  buildRecurringLooseSignature,
  buildRecurringSignature,
  hideMaterializedRecurringTemplates,
  shouldProjectRecurringInMonth,
} from '@/lib/recurringProjection';
import { isCreditCardPaymentLabel } from '@/lib/creditCardPayments';


export interface DbCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  active: boolean;
  sort_order: number;
}

export interface BudgetRow {
  id: string;
  category: string;
  category_id: string | null;
  allocated_amount: number;
  month_year: string;
  is_recurring: boolean;
}

export interface CategoryBudgetNode {
  category: DbCategory;
  children: DbCategory[];
  budget: BudgetRow | null;
  childBudgets: Record<string, BudgetRow | null>;
  spent: number;
  childSpent: Record<string, number>;
  /** Previous month budget for suggestion */
  prevBudget: number;
  childPrevBudgets: Record<string, number>;
}

export function useBudgetData() {
  const { user } = useAuth();
  const { startDate, endDate, monthKey } = useSelectedDate();
  const { toast } = useToast();
  // Categorias vêm do cache partilhado (30 min) — sem busca própria.
  const { data: allCategories = [], isLoading: categoriesLoading } = useCategories();
  const categories = useMemo(
    () => allCategories.filter(c => c.active !== false) as unknown as DbCategory[],
    [allCategories],
  );
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [prevBudgets, setPrevBudgets] = useState<BudgetRow[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Previous month key
  const prevMonthKey = useMemo(() => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, [startDate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const EXPENSE_COLS =
      'id, description, value, date, type, final_category, credit_card_id, wallet_id, payment_method, project_id, invoice_month, is_recurring, is_paid, frequency';

    const [
      { data: budgetData },
      { data: recurringData },
      { data: prevBudgetData },
      { data: expenseData },
      { data: templatesData },
      { data: exceptionsData },
    ] = await Promise.all([
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', startDate),
      // Fetch all recurring budgets to propagate to months without explicit budgets
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('is_recurring', true).lt('month_year', startDate).order('month_year', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', prevMonthKey),
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id).gte('date', startDate).lt('date', endDate),
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id).eq('is_recurring', true),
      supabase.from('recurring_exceptions').select('template_id, occurrence_date').eq('user_id', user.id),
    ]);

    
    
    // Merge: for categories without a budget this month, use the latest recurring budget
    const currentBudgets = (budgetData || []) as BudgetRow[];
    const existingCatIds = new Set(currentBudgets.map(b => b.category_id));
    const inheritedBudgets: BudgetRow[] = [];
    const seenCatIds = new Set<string>();
    for (const rb of (recurringData || []) as BudgetRow[]) {
      if (rb.category_id && !existingCatIds.has(rb.category_id) && !seenCatIds.has(rb.category_id)) {
        seenCatIds.add(rb.category_id);
        inheritedBudgets.push({ ...rb, month_year: startDate });
      }
    }
    setBudgets([...currentBudgets, ...inheritedBudgets]);
    setPrevBudgets((prevBudgetData || []) as BudgetRow[]);

    // Regime de competência: considera as despesas reais do mês (inclusive as do
    // cartão de crédito, pela data da compra) MAIS as ocorrências virtuais das
    // recorrências fixas que ainda não foram materializadas neste mês.
    const [yearNum, monthNum] = startDate.split('-').map(Number);
    const monthIndex = monthNum - 1;
    const templates = (templatesData || []) as any[];
    const exceptionSet = new Set(
      ((exceptionsData || []) as any[]).map(e => buildRecurringExceptionSignature(e.template_id, e.occurrence_date)),
    );

    const monthRows = (expenseData || []) as any[];
    const effective = buildEffectiveMonthExpenses({
      monthExpenses: monthRows,
      recurringTemplates: templates,
      year: yearNum,
      month: monthIndex,
      exceptionSet,
    }) as any[];

    // Recorrências fixas no cartão são ignoradas pelo motor acima (fluxo de caixa
    // usa a fatura). Para o orçamento elas precisam entrar pela data da compra.
    const visible = hideMaterializedRecurringTemplates(monthRows) as any[];
    const realSignatures = new Set(visible.map(e => buildRecurringSignature(e.type, e.value, e.description)));
    const realLooseSignatures = new Set(visible.map(e => buildRecurringLooseSignature(e.type, e.description)));
    const materializedSignatures = new Set(
      visible.filter(e => !e.is_recurring).map(e => buildMaterializedRecurringSignature(e)),
    );
    const realIds = new Set(visible.map(e => e.id));
    const daysInMonth = new Date(yearNum, monthIndex + 1, 0).getDate();

    const virtualCardRows: any[] = [];
    templates.forEach(t => {
      if (!t.credit_card_id || t.type !== 'expense') return;
      if (isCreditCardPaymentLabel(t.description)) return;
      if (realIds.has(t.id)) return;
      if (!shouldProjectRecurringInMonth(t.date, yearNum, monthIndex, t.frequency)) return;
      if (
        realSignatures.has(buildRecurringSignature(t.type, t.value, t.description)) ||
        realLooseSignatures.has(buildRecurringLooseSignature(t.type, t.description)) ||
        materializedSignatures.has(buildMaterializedRecurringSignature(t))
      )
        return;
      const originalDay = new Date(`${t.date}T12:00:00`).getDate();
      const day = Math.min(originalDay, daysInMonth);
      const occurrenceDate = `${yearNum}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (exceptionSet.has(buildRecurringExceptionSignature(t.id ?? '', occurrenceDate))) return;
      virtualCardRows.push({ ...t, date: occurrenceDate, is_recurring: false, is_paid: false });
    });

    // Build spent map by final_category (name-based)
    const spent: Record<string, number> = {};
    let income = 0;
    [...effective, ...virtualCardRows].forEach((e: any) => {
      if (e.type === 'income') { income += Number(e.value || 0); return; }
      if (e.type === 'transfer') return;
      if (isBalanceAdjustment(e)) return;
      if (isCreditCardPaymentLabel(e.description) || e.description?.startsWith('Pagamento fatura')) return;
      spent[e.final_category] = (spent[e.final_category] || 0) + Number(e.value || 0);
    });
    setSpentMap(spent);
    setTotalIncome(income);
    setLoading(false);

  }, [user, startDate, endDate, prevMonthKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build hierarchy
  const tree = useMemo<CategoryBudgetNode[]>(() => {
    const parents = categories.filter(c => !c.parent_id);
    const childrenMap: Record<string, DbCategory[]> = {};
    categories.filter(c => c.parent_id).forEach(c => {
      if (!childrenMap[c.parent_id!]) childrenMap[c.parent_id!] = [];
      childrenMap[c.parent_id!].push(c);
    });

    return parents.map(parent => {
      const children = childrenMap[parent.id] || [];
      
      // Find budgets by category_id
      const parentBudget = budgets.find(b => b.category_id === parent.id) || null;
      const childBudgets: Record<string, BudgetRow | null> = {};
      children.forEach(ch => {
        childBudgets[ch.id] = budgets.find(b => b.category_id === ch.id) || null;
      });

      // Spent: match by category name (since expenses use final_category text)
      const childSpent: Record<string, number> = {};
      children.forEach(ch => {
        childSpent[ch.id] = spentMap[ch.name] || 0;
      });
      // Parent spent = direct matches + all children
      const directSpent = spentMap[parent.name] || 0;
      const totalChildSpent = Object.values(childSpent).reduce((s, v) => s + v, 0);
      const spent = directSpent + totalChildSpent;

      // Previous month budgets for suggestion
      const prevParent = prevBudgets.find(b => b.category_id === parent.id);
      const childPrevBudgets: Record<string, number> = {};
      children.forEach(ch => {
        const pb = prevBudgets.find(b => b.category_id === ch.id);
        childPrevBudgets[ch.id] = pb?.allocated_amount || 0;
      });

      return {
        category: parent,
        children,
        budget: parentBudget,
        childBudgets,
        spent,
        childSpent,
        prevBudget: prevParent?.allocated_amount || 0,
        childPrevBudgets,
      };
    });
  }, [categories, budgets, prevBudgets, spentMap]);

  const totalAllocated = useMemo(() => budgets.reduce((s, b) => s + b.allocated_amount, 0), [budgets]);
  const totalSpent = useMemo(() => Object.values(spentMap).reduce((s, v) => s + v, 0), [spentMap]);

  const saveBudget = useCallback(async (categoryId: string, amount: number, isRecurring?: boolean) => {
    if (!user) return;
    setSavingId(categoryId);

    const existing = budgets.find(b => b.category_id === categoryId);
    // If this is an inherited recurring budget (from a past month), we need to insert a new one
    const isInherited = existing && existing.month_year !== monthKey;
    
    if (existing && !isInherited) {
      const updateFields: any = { allocated_amount: amount };
      if (isRecurring !== undefined) updateFields.is_recurring = isRecurring;
      const { error } = await supabase.from('budgets').update(updateFields).eq('id', existing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else {
        setBudgets(prev => prev.map(b => b.id === existing.id ? { ...b, allocated_amount: amount, ...(isRecurring !== undefined ? { is_recurring: isRecurring } : {}) } : b));
      }
    } else {
      const cat = categories.find(c => c.id === categoryId);
      const recurring = isRecurring !== undefined ? isRecurring : (existing?.is_recurring || false);
      const { data, error } = await supabase.from('budgets').insert({
        user_id: user.id,
        category: cat?.name || '',
        category_id: categoryId,
        month_year: monthKey,
        allocated_amount: amount,
        is_recurring: recurring,
      }).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else if (data) {
        setBudgets(prev => {
          // Remove inherited entry if present
          const filtered = isInherited ? prev.filter(b => !(b.category_id === categoryId && b.month_year !== monthKey)) : prev;
          return [...filtered, data as BudgetRow];
        });
      }
    }
    setSavingId(null);
  }, [user, budgets, categories, monthKey, toast]);

  return { tree, totalAllocated, totalSpent, totalIncome, loading: loading || categoriesLoading, savingId, saveBudget, budgets, spentMap };
}
