import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { useToast } from '@/hooks/use-toast';

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
  const [categories, setCategories] = useState<DbCategory[]>([]);
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

    const [{ data: catData }, { data: budgetData }, { data: prevBudgetData }, { data: expenseData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).eq('active', true).order('sort_order'),
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', startDate),
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', prevMonthKey),
      supabase.from('expenses').select('final_category, value, type, credit_card_id, invoice_month, date').eq('user_id', user.id).gte('date', startDate).lt('date', endDate),
    ]);

    setCategories((catData || []) as DbCategory[]);
    setBudgets((budgetData || []) as BudgetRow[]);
    setPrevBudgets((prevBudgetData || []) as BudgetRow[]);

    // Build spent map by final_category (name-based)
    const spent: Record<string, number> = {};
    let income = 0;
    (expenseData || []).forEach((e: any) => {
      if (e.type === 'income') { income += e.value; return; }
      if (e.type === 'transfer') return;
      spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
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

  const saveBudget = useCallback(async (categoryId: string, amount: number) => {
    if (!user) return;
    setSavingId(categoryId);

    const existing = budgets.find(b => b.category_id === categoryId);
    if (existing) {
      const { error } = await supabase.from('budgets').update({ allocated_amount: amount }).eq('id', existing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else {
        setBudgets(prev => prev.map(b => b.id === existing.id ? { ...b, allocated_amount: amount } : b));
      }
    } else {
      // Also find the category name for backward compat
      const cat = categories.find(c => c.id === categoryId);
      const { data, error } = await supabase.from('budgets').insert({
        user_id: user.id,
        category: cat?.name || '',
        category_id: categoryId,
        month_year: monthKey,
        allocated_amount: amount,
      }).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else if (data) {
        setBudgets(prev => [...prev, data as BudgetRow]);
      }
    }
    setSavingId(null);
  }, [user, budgets, categories, monthKey, toast]);

  return { tree, totalAllocated, totalSpent, totalIncome, loading, savingId, saveBudget, budgets, spentMap };
}
