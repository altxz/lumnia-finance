import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SummaryCards } from '@/components/SummaryCards';
import { TransactionFeed } from '@/components/TransactionFeed';
import { AddExpenseModal } from '@/components/AddExpenseModal';

import { DashboardHeader } from '@/components/DashboardHeader';
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt';
import { AnomalyInsights } from '@/components/analytics/AnomalyInsights';
import { AppSidebar } from '@/components/AppSidebar';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo, CATEGORIES } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import { CashFlowChart } from '@/components/CashFlowChart';
import { HealthScore } from '@/components/HealthScore';
import { CalendarView } from '@/components/CalendarView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Expense } from '@/components/ExpenseTable';

const PAGE_SIZE = 20;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ category: 'all' });
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [budgetTotals, setBudgetTotals] = useState({ totalBudget: 0, totalSpent: 0 });
  const [hasOverdueCards, setHasOverdueCards] = useState(false);
  const [startingMonthBalance, setStartingMonthBalance] = useState(0);

  // Compute previous month date range
  const { selectedMonth, selectedYear } = useSelectedDate();
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevNextM = prevMonth === 11 ? 0 : prevMonth + 1;
  const prevNextY = prevMonth === 11 ? prevYear + 1 : prevYear;
  const prevEndDate = `${prevNextY}-${String(prevNextM + 1).padStart(2, '0')}-01`;

  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });

    if (filters.category !== 'all') {
      query = query.eq('final_category', filters.category);
    }

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (!error) {
      setExpenses(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [user, page, filters, startDate, endDate]);

  // Fetch previous month expenses for trend comparison
  const fetchPrevExpenses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', prevStartDate)
      .lt('date', prevEndDate);
    setPrevExpenses(data || []);
  }, [user, prevStartDate, prevEndDate]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchPrevExpenses(); }, [fetchPrevExpenses]);

  // Fetch wallets + starting month balance
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: walletsData } = await supabase
        .from('wallets').select('id, name, initial_balance').eq('user_id', user.id).order('name');
      const wList = walletsData || [];
      setWallets(wList.map(w => ({ id: w.id, name: w.name })));

      const walletsTotal = wList.reduce((s, w: any) => s + (w.initial_balance || 0), 0);

      // Sum all paid non-transfer transactions before this month
      const { data: priorTxns } = await supabase
        .from('expenses')
        .select('value, type, credit_card_id')
        .eq('user_id', user.id)
        .eq('is_paid', true)
        .lt('date', startDate);

      let priorBalance = walletsTotal;
      (priorTxns || []).forEach((t: any) => {
        if (t.type === 'transfer') return;
        if (t.type === 'income') priorBalance += t.value;
        else if (!t.credit_card_id) priorBalance -= t.value;
      });
      setStartingMonthBalance(priorBalance);
    })();
  }, [user, startDate]);

  // Fetch budget alerts — check which categories are ≥80% spent
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: budgetData }, { data: expData }] = await Promise.all([
        supabase.from('budgets').select('category, allocated_amount').eq('user_id', user.id).eq('month_year', startDate),
        supabase.from('expenses').select('final_category, value, type').eq('user_id', user.id).gte('date', startDate).lt('date', endDate),
      ]);
      if (!budgetData || !expData) { setBudgetAlerts([]); return; }
      const spent: Record<string, number> = {};
      expData.forEach((e: any) => { if (e.type !== 'income') spent[e.final_category] = (spent[e.final_category] || 0) + e.value; });
      const warnings: string[] = [];
      budgetData.forEach((b: any) => {
        if (b.allocated_amount > 0) {
          const pct = (spent[b.category] || 0) / b.allocated_amount * 100;
          if (pct >= 80) warnings.push(getCategoryInfo(b.category).label);
        }
      });
      setBudgetAlerts(warnings);
      const tBudget = budgetData.reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0);
      const tSpent = Object.values(spent).reduce((s: number, v: number) => s + v, 0);
      setBudgetTotals({ totalBudget: tBudget, totalSpent: tSpent });
    })();
  }, [user, startDate, endDate]);

  // Check overdue credit card bills
  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date();
      const { data: cards } = await supabase.from('credit_cards').select('due_day').eq('user_id', user.id);
      if (!cards) { setHasOverdueCards(false); return; }
      const overdue = cards.some((c: any) => c.due_day < today.getDate());
      setHasOverdueCards(overdue);
    })();
  }, [user]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const summary = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    const balance = income - expenseTotal;
    const byCategory: Record<string, number> = {};
    cashExpenses.forEach(e => {
      byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value;
    });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      balance,
      totalIncome: income,
      totalExpense: expenseTotal,
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1] } : null,
    };
  }, [expenses]);

  const prevSummary = useMemo(() => {
    const nonTransfers = prevExpenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    return { totalIncome: income, totalExpense: expenseTotal, balance: income - expenseTotal };
  }, [prevExpenses]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-medium">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <InstallPwaPrompt />
            <MonthSelector />

            <AnomalyInsights />

            {budgetAlerts.length > 0 && (
              <Alert variant="destructive" className="rounded-xl border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-medium text-sm">
                  Atenção: Estás quase a ultrapassar o teu orçamento em{' '}
                  <span className="font-bold">{budgetAlerts.join(' e ')}</span>!
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gerencie receitas e despesas com IA</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-10 sm:h-11 px-4 sm:px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-sm hidden md:flex">
                  <PlusCircle className="h-4 w-4" />
                  Nova Transação
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
              <SummaryCards
              balance={summary.balance}
              totalIncome={summary.totalIncome}
              totalExpense={summary.totalExpense}
              largestCategory={summary.largestCategory}
              prevBalance={prevSummary.balance}
              prevIncome={prevSummary.totalIncome}
              prevExpense={prevSummary.totalExpense}
            />
              <HealthScore
                totalIncome={summary.totalIncome}
                totalExpense={summary.totalExpense}
                totalBudget={budgetTotals.totalBudget}
                totalSpentInBudget={budgetTotals.totalSpent}
                hasOverdueCards={hasOverdueCards}
              />
            </div>

            <CashFlowChart />

            <Tabs defaultValue="lancamentos" className="space-y-4">
              <TabsList className="rounded-xl">
                <TabsTrigger value="lancamentos" className="rounded-lg text-sm">Lançamentos</TabsTrigger>
                <TabsTrigger value="recorrentes" className="rounded-lg text-sm">Assinaturas Fixas</TabsTrigger>
                <TabsTrigger value="calendario" className="rounded-lg text-sm">Calendário</TabsTrigger>
              </TabsList>
              <TabsContent value="lancamentos">
                <TransactionFeed
                  expenses={expenses}
                  loading={loading}
                  onDeleted={fetchExpenses}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  page={page}
                  totalPages={Math.ceil(totalCount / PAGE_SIZE)}
                  onPageChange={setPage}
                  wallets={wallets}
                  startingMonthBalance={startingMonthBalance}
                />
              </TabsContent>
              <TabsContent value="recorrentes">
                <p className="text-center py-12 text-muted-foreground">Em breve: gestão de assinaturas fixas.</p>
              </TabsContent>
              <TabsContent value="calendario">
                <CalendarView />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchExpenses} />
      
    </SidebarProvider>
  );
}
