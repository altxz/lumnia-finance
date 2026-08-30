import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { MonthSelector } from '@/components/MonthSelector';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import {
  ArrowLeft,
  Loader2,
  Tag,
  TrendingDown,
  TrendingUp,
  ArrowDownUp,
  Pencil,
  Calendar as CalendarIcon,
  Receipt,
  Repeat,
  Wallet as WalletIcon,
  CreditCard,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TriangleAlert,
  Check,
} from 'lucide-react';
import { icons } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { StatePanel } from '@/components/ui/state-panel';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useBudgetData } from '@/hooks/useBudgetData';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { transactionAmount } from '@/lib/transactionAmount';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
}

interface Expense {
  id: string;
  description: string;
  date: string;
  value: number;
  type: 'expense' | 'income' | 'transfer';
  final_category: string;
  is_paid: boolean;
  credit_card_id: string | null;
  is_recurring: boolean;
  wallet_id: string | null;
  payment_method: string | null;
  project_id: string | null;
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const IconComp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComp) return <Tag className={className} />;
  return <IconComp className={className} />;
}

export default function CategoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, label, selectedMonth, selectedYear } = useSelectedDate();
  const selectedDate = useMemo(() => new Date(selectedYear, selectedMonth, 1), [selectedYear, selectedMonth]);
  const navigate = useNavigate();

  const [category, setCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const [budgetDraft, setBudgetDraft] = useState('');
  const { tree: budgetTree, saveBudget, savingId } = useBudgetData();

  const budgetContext = useMemo(() => {
    if (!id) return null;
    const parentNode = budgetTree.find(node => node.category.id === id);
    if (parentNode) {
      const childAllocated = Object.values(parentNode.childBudgets)
        .reduce((sum, budget) => sum + Number(budget?.allocated_amount || 0), 0);
      return {
        allocated: Number(parentNode.budget?.allocated_amount || 0),
        totalAllocated: Number(parentNode.budget?.allocated_amount || 0) + childAllocated,
        spent: Number(parentNode.spent || 0),
        directSpent: Math.max(0, Number(parentNode.spent || 0) - Object.values(parentNode.childSpent).reduce((sum, amount) => sum + Number(amount || 0), 0)),
        prevBudget: Number(parentNode.prevBudget || 0),
        isRecurring: Boolean(parentNode.budget?.is_recurring),
        children: parentNode.children.map(child => ({
          ...child,
          allocated: Number(parentNode.childBudgets[child.id]?.allocated_amount || 0),
          spent: Number(parentNode.childSpent[child.id] || 0),
        })),
      };
    }

    const childParent = budgetTree.find(node => node.children.some(child => child.id === id));
    if (!childParent) return null;
    return {
      allocated: Number(childParent.childBudgets[id]?.allocated_amount || 0),
      totalAllocated: Number(childParent.childBudgets[id]?.allocated_amount || 0),
      spent: Number(childParent.childSpent[id] || 0),
      directSpent: Number(childParent.childSpent[id] || 0),
      prevBudget: Number(childParent.childPrevBudgets[id] || 0),
      isRecurring: Boolean(childParent.childBudgets[id]?.is_recurring),
      children: [],
    };
  }, [budgetTree, id]);

  useEffect(() => {
    setBudgetDraft(budgetContext?.allocated ? String(budgetContext.allocated) : '');
  }, [budgetContext?.allocated]);

  const fetchData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);

    const { data: cat, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (categoryError) {
      setError(categoryError.message || 'Não foi possível carregar a categoria.');
      setLoading(false);
      return;
    }

    if (!cat) { setLoading(false); return; }
    setCategory(cat as Category);

    // Parent category info (if this is a subcategory)
    if (cat.parent_id) {
      const { data: p, error: parentError } = await supabase
        .from('categories')
        .select('id, name, icon, color, parent_id')
        .eq('id', cat.parent_id)
        .maybeSingle();
      if (parentError) {
        setError(parentError.message || 'Não foi possível carregar a categoria principal.');
        setLoading(false);
        return;
      }
      setParentCategory((p as Category) || null);
    } else {
      setParentCategory(null);
    }

    // Subcategories so we can also include their transactions
    const { data: subs, error: subcategoriesError } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('user_id', user.id)
      .eq('parent_id', cat.id);
    if (subcategoriesError) {
      setError(subcategoriesError.message || 'Não foi possível carregar as subcategorias.');
      setLoading(false);
      return;
    }
    setSubCategories((subs || []) as Category[]);

    const namesToMatch = [cat.name, ...(subs || []).map(s => s.name)];
    const lowered = namesToMatch.map(n => n.toLowerCase());
    const allNames = Array.from(new Set([...namesToMatch, ...lowered]));

    const select = 'id, description, date, value, type, final_category, is_paid, credit_card_id, is_recurring, wallet_id, payment_method, project_id';

    // Current period
    const { data: exps, error: expensesError } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .in('final_category', allNames)
      .order('date', { ascending: false });

    // Previous period (same month, last year-month)
    const prevStart = format(startOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd');
    const prevEnd = format(endOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd');
    const { data: prevExps, error: previousExpensesError } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', prevStart)
      .lte('date', prevEnd)
      .in('final_category', allNames);

    // Last 6 months trend
    const sixMonthsAgoStart = format(startOfMonth(subMonths(selectedDate, 5)), 'yyyy-MM-dd');
    const trendEnd = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    const { data: trendExps, error: trendExpensesError } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', sixMonthsAgoStart)
      .lte('date', trendEnd)
      .in('final_category', allNames);

    const requestError = expensesError || previousExpensesError || trendExpensesError;
    if (requestError) {
      setError(requestError.message || 'Não foi possível carregar os lançamentos desta categoria.');
      setLoading(false);
      return;
    }

    const dedupedCurrent = hideMaterializedRecurringTemplates((exps || []) as Expense[]);
    const dedupedPrev = hideMaterializedRecurringTemplates((prevExps || []) as Expense[]);
    const dedupedTrend = hideMaterializedRecurringTemplates((trendExps || []) as Expense[]);

    setExpenses(dedupedCurrent);
    setPreviousExpenses(dedupedPrev);

    // Build trend by month
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(selectedDate, i);
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM', { locale: ptBR }), total: 0 });
    }
    dedupedTrend.forEach(e => {
      if (e.type === 'transfer') return;
      const monthKey = e.date.slice(0, 7);
      const m = months.find(x => x.key === monthKey);
      if (m) m.total += transactionAmount(e.value);
    });
    setTrendData(months.map(m => ({ month: m.label, total: m.total })));

    setLoading(false);
  }, [user, id, startDate, endDate, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, paid = 0, pending = 0, recurringCount = 0;
    expenses.forEach(e => {
      const amount = transactionAmount(e.value);
      if (e.type === 'income') income += amount;
      else if (e.type !== 'transfer') {
        expense += amount;
        if (e.is_paid) paid += amount;
        else pending += amount;
      }
      if (e.is_recurring) recurringCount += 1;
    });
    const net = income - expense;
    const count = expenses.length;
    const avgTicket = expense > 0 && count > 0 ? expense / count : 0;
    return { income, expense, paid, pending, net, count, recurringCount, avgTicket };
  }, [expenses]);

  // Monthly comparison
  const previousExpense = useMemo(() => {
    return previousExpenses.reduce((s, e) => e.type === 'expense' ? s + transactionAmount(e.value) : s, 0);
  }, [previousExpenses]);

  const variation = useMemo(() => {
    if (previousExpense === 0) return null;
    return ((totals.expense - previousExpense) / previousExpense) * 100;
  }, [totals.expense, previousExpense]);

  // Top 5 largest transactions
  const topTransactions = useMemo(() => {
    return [...expenses]
      .filter(e => e.type !== 'transfer')
      .sort((a, b) => transactionAmount(b.value) - transactionAmount(a.value))
      .slice(0, 5);
  }, [expenses]);

  // Daily distribution chart
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    return days.map(d => {
      const total = expenses
        .filter(e => e.type === 'expense' && isSameDay(parseISO(e.date), d))
        .reduce((s, e) => s + transactionAmount(e.value), 0);
      return { day: format(d, 'dd'), total };
    });
  }, [expenses, selectedDate]);

  // Day of week distribution
  const weekdayStats = useMemo(() => {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach(e => {
      if (e.type !== 'expense') return;
      const dow = parseISO(e.date).getDay();
      totals[dow] += transactionAmount(e.value);
    });
    const max = Math.max(...totals);
    const peakIdx = totals.indexOf(max);
    return { totals, dayNames, peakDay: max > 0 ? dayNames[peakIdx] : '—', peakValue: max };
  }, [expenses]);

  // Average expense day-of-month
  const heaviestDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    const peak = dailyData.reduce((a, b) => b.total > a.total ? b : a, dailyData[0]);
    return peak.total > 0 ? peak : null;
  }, [dailyData]);

  if (authLoading) return <PageLoadingSkeleton title="Carregando categoria" />;
  if (!user) return <Navigate to="/auth" replace />;

  const accent = category?.color || 'hsl(var(--primary))';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/categorias')} className="rounded-xl h-10 w-10 shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {category ? (
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent + '20' }}
                    >
                      <LucideIcon name={category.icon || 'tag'} className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">{category.name}</h1>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {parentCategory && (
                          <Badge variant="secondary" className="h-auto whitespace-normal break-words rounded-lg px-1.5 py-0 text-[10px]">
                            ↳ {parentCategory.name}
                          </Badge>
                        )}
                        {subCategories.length > 0 && (
                          <Badge variant="outline" className="rounded-lg text-[10px] px-1.5 py-0">{subCategories.length} subs</Badge>
                        )}
                        <p className="text-[10px] text-muted-foreground capitalize sm:text-xs">{label}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Categoria</h1>
                )}
              </div>
              <div className="flex justify-center sm:justify-end">
                <MonthSelector />
              </div>
            </div>

            {!isOnline && <OfflineBanner />}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <StatePanel
                tone={isOnline ? 'error' : 'offline'}
                icon={<TriangleAlert className="h-5 w-5" />}
                title={isOnline ? 'Não foi possível carregar a categoria' : 'Categoria indisponível offline'}
                description={isOnline ? 'Os indicadores não foram atualizados. Verifique a conexão e tente novamente.' : 'Reconecte-se para atualizar os indicadores desta categoria.'}
                actionLabel="Tentar novamente"
                onAction={fetchData}
              />
            ) : !category ? (
              <StatePanel
                icon={<Tag className="h-5 w-5" />}
                title="Categoria não encontrada"
                description="Ela pode ter sido removida ou não estar disponível nesta conta."
                actionLabel="Voltar para categorias"
                onAction={() => navigate('/categorias')}
              />
            ) : (
              <>
                <Card className="overflow-hidden rounded-3xl border shadow-card">
                  <CardContent className="space-y-5 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Visão do período</p>
                        <p className="mt-1 text-sm text-muted-foreground">Gastos e orçamento de {label}.</p>
                      </div>
                      {variation === null ? (
                        <Badge variant="secondary" className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-xs"><Minus className="mr-1 h-3.5 w-3.5" />Sem base comparável</Badge>
                      ) : (
                        <Badge variant="secondary" className={cn('h-auto whitespace-normal rounded-full px-3 py-1.5 text-xs', variation > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>
                          {variation > 0 ? <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 h-3.5 w-3.5" />}
                          {Math.abs(variation).toFixed(1)}% em relação ao mês anterior
                        </Badge>
                      )}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Gasto no período</p>
                        <p className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: accent }}>{formatCurrency(totals.expense)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{totals.count} lançamento{totals.count === 1 ? '' : 's'} neste período.</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/35 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium">Orçamento monitorado</p>
                          <p className="whitespace-nowrap text-lg font-semibold tabular-nums">{budgetContext && budgetContext.totalAllocated > 0 ? formatCurrency(budgetContext.totalAllocated) : 'Não definido'}</p>
                        </div>
                        {budgetContext && budgetContext.totalAllocated > 0 ? (
                          <>
                            <Progress value={Math.min(100, (budgetContext.spent / budgetContext.totalAllocated) * 100)} className={cn('mt-3 h-2.5', budgetContext.spent >= budgetContext.totalAllocated && '[&>div]:bg-destructive', budgetContext.spent >= budgetContext.totalAllocated * 0.8 && budgetContext.spent < budgetContext.totalAllocated && '[&>div]:bg-amber-500')} />
                            <p className={cn('mt-2 text-sm', budgetContext.spent >= budgetContext.totalAllocated ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                              {((budgetContext.spent / budgetContext.totalAllocated) * 100).toFixed(0)}% utilizado, {formatCurrency(Math.max(0, budgetContext.totalAllocated - budgetContext.spent))} disponível.
                            </p>
                          </>
                        ) : <p className="mt-2 text-sm text-muted-foreground">Defina um orçamento para acompanhar este grupo.</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border shadow-soft">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Orçamento desta categoria</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Este valor é independente dos orçamentos das subcategorias.</p>
                      </div>
                      {budgetContext?.isRecurring && <Badge variant="secondary" className="rounded-full"><Repeat className="mr-1 h-3.5 w-3.5" />Repete mensalmente</Badge>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <label className="grid gap-2 text-sm font-medium">
                        Valor mensal
                        <Input
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.01"
                          value={budgetDraft}
                          onChange={event => setBudgetDraft(event.target.value)}
                          placeholder="0,00"
                          className="h-12 rounded-2xl text-base tabular-nums"
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={() => id && saveBudget(id, Number(budgetDraft) || 0, budgetContext?.isRecurring)}
                        disabled={!id || savingId === id}
                        className="h-12 rounded-full px-5"
                      >
                        <Check className="mr-2 h-4 w-4" />{savingId === id ? 'Salvando' : 'Salvar orçamento'}
                      </Button>
                    </div>
                    {budgetContext?.prevBudget && !budgetContext.allocated ? <p className="text-sm text-muted-foreground">No mês anterior, o orçamento foi {formatCurrency(budgetContext.prevBudget)}.</p> : null}
                  </CardContent>
                </Card>

                {/* Indicadores secundários */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card className="rounded-2xl border-0 shadow-soft">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Entradas</p>
                        <p className="break-words text-base font-bold">{formatCurrency(totals.income)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-soft">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Saídas</p>
                        <p className="break-words text-base font-bold">{formatCurrency(totals.expense)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-soft">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <CalendarIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Maior dia</p>
                        <p className="break-words text-base font-bold">
                          {heaviestDay ? `Dia ${heaviestDay.day}` : '—'}
                        </p>
                        <p className="break-words text-[10px] text-muted-foreground">
                          {heaviestDay ? formatCurrency(heaviestDay.total) : 'Sem gastos'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-soft">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center shrink-0">
                        <ArrowDownUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Dia + ativo</p>
                        <p className="break-words text-base font-bold">{weekdayStats.peakDay}</p>
                        <p className="break-words text-[10px] text-muted-foreground">
                          {weekdayStats.peakValue > 0 ? formatCurrency(weekdayStats.peakValue) : '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts row */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Trend last 6 months */}
                  <Card className="rounded-2xl border-0 shadow-card">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Evolução · últimos 6 meses</h2>
                        <Badge variant="secondary" className="rounded-lg text-[10px]">Saídas</Badge>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => formatCurrency(Number(v))} domain={[0, 'auto']} />
                            <RTooltip
                              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                              formatter={(v: number) => [formatCurrency(v), 'Total']}
                            />
                            <Line type="monotone" dataKey="total" stroke={accent} strokeWidth={3} dot={{ fill: accent, r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Daily distribution */}
                  <Card className="rounded-2xl border-0 shadow-card">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Gastos por dia do mês</h2>
                        <Badge variant="secondary" className="rounded-lg text-[10px]">{format(selectedDate, 'MMM', { locale: ptBR })}</Badge>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => formatCurrency(Number(v))} domain={[0, 'auto']} />
                            <RTooltip
                              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                              formatter={(v: number) => [formatCurrency(v), 'Gasto']}
                              labelFormatter={(l) => `Dia ${l}`}
                            />
                            <Bar dataKey="total" fill={accent} radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {subCategories.length > 0 && (
                  <section className="space-y-3" aria-labelledby="subcategories-title">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h2 id="subcategories-title" className="text-xl font-semibold">Subcategorias</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Cada orçamento é acompanhado de forma independente.</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">{subCategories.length} cadastrada{subCategories.length === 1 ? '' : 's'}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {subCategories.map(subcategory => {
                        const budget = budgetContext?.children.find(child => child.id === subcategory.id);
                        const allocated = Number(budget?.allocated || 0);
                        const spent = Number(budget?.spent || 0);
                        const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
                        const isOver = allocated > 0 && percentage >= 100;
                        const isWarning = allocated > 0 && percentage >= 80 && percentage < 100;
                        return (
                          <button
                            type="button"
                            key={subcategory.id}
                            onClick={() => navigate(`/categorias/${subcategory.id}`)}
                            className={cn('w-full rounded-2xl border p-4 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', isOver && 'border-destructive/40')}
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${subcategory.color}20` }}>
                                <LucideIcon name={subcategory.icon} className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block break-words text-base font-semibold leading-tight">{subcategory.name}</span>
                                <span className="mt-1 block text-sm text-muted-foreground">Gasto: <span className={cn('whitespace-nowrap font-medium tabular-nums', isOver && 'text-destructive')}>{formatCurrency(spent)}</span></span>
                              </span>
                            </div>
                            <div className="mt-4 space-y-2">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                                <span className="text-muted-foreground">Orçamento</span>
                                <span className="whitespace-nowrap font-semibold tabular-nums">{allocated > 0 ? formatCurrency(allocated) : 'Não definido'}</span>
                              </div>
                              <Progress value={Math.min(100, percentage)} className={cn('h-2', isOver && '[&>div]:bg-destructive', isWarning && '[&>div]:bg-amber-500')} />
                              <span className={cn('block text-xs', isOver ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                                {allocated > 0 ? `${percentage.toFixed(0)}% utilizado` : 'Orçamento não definido'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Top 5 transactions */}
                {topTransactions.length > 0 && (
                  <Card className="rounded-2xl border-0 shadow-card">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-warning" />
                        <h2 className="text-sm font-semibold">Top 5 maiores lançamentos</h2>
                      </div>
                      <ul className="space-y-2">
                        {topTransactions.map((e, idx) => (
                          <li
                            key={e.id}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer"
                            onClick={() => navigate(`/historico?expense=${e.id}`)}
                          >
                            <div className="w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium">{e.description}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {format(parseISO(e.date), "dd 'de' MMM", { locale: ptBR })} · {e.final_category}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-foreground shrink-0">{formatCurrency(transactionAmount(e.value))}</p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Transactions list */}
                <Card className="rounded-2xl border-0 shadow-card">
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Lançamentos do período</h2>
                      <Badge variant="secondary" className="rounded-lg text-[10px]">{expenses.length}</Badge>
                    </div>
                    {expenses.length === 0 ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        Nenhum lançamento nesta categoria no período selecionado.
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {expenses.map(e => {
                          const isIncome = e.type === 'income';
                          const sign = isIncome ? '+' : '-';
                          return (
                            <li key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isIncome
                                  ? 'bg-success/15 text-success'
                                  : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              }`}>
                                {e.credit_card_id ? <CreditCard className="h-4 w-4" /> : isIncome ? <TrendingUp className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium">{e.description}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(e.date), "dd 'de' MMM", { locale: ptBR })}
                                  </p>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                    {e.final_category}
                                  </Badge>
                                  {e.is_recurring && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                                      <Repeat className="h-2.5 w-2.5" /> Recorrente
                                    </Badge>
                                  )}
                                  {!e.is_paid && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning">Pendente</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold ${isIncome ? 'text-success' : 'text-destructive'}`}>
                                  {sign} {formatCurrency(transactionAmount(e.value))}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl shrink-0"
                                onClick={() => navigate(`/historico?expense=${e.id}`)}
                                aria-label="Abrir lançamento"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
