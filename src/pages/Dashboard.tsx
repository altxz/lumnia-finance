import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SummaryCards } from '@/components/SummaryCards';
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
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import { CashFlowChart } from '@/components/CashFlowChart';
import { HealthScore } from '@/components/HealthScore';
import { CalendarView } from '@/components/CalendarView';
import { IncomeVsExpenseChart } from '@/components/analytics/IncomeVsExpenseChart';
import { TopCategoriesPie } from '@/components/analytics/TopCategoriesPie';
import { CreditUsageChart } from '@/components/analytics/CreditUsageChart';
import { EndOfMonthForecast } from '@/components/analytics/EndOfMonthForecast';
import { DailySpendingChart } from '@/components/analytics/DailySpendingChart';
import { FixedVsVariableChart } from '@/components/analytics/FixedVsVariableChart';
import { SubcategoryTreemap } from '@/components/analytics/SubcategoryTreemap';
import { SavingsRateGauge } from '@/components/analytics/SavingsRateGauge';
import { WeekComparisonChart } from '@/components/analytics/WeekComparisonChart';
import { IncomeSourcesPie } from '@/components/analytics/IncomeSourcesPie';
import type { Expense } from '@/components/ExpenseTable';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [budgetTotals, setBudgetTotals] = useState({ totalBudget: 0, totalSpent: 0 });
  const [hasOverdueCards, setHasOverdueCards] = useState(false);
  const [totalRealBalance, setTotalRealBalance] = useState(0);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Previous month date range
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
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });
    setExpenses(data || []);
  }, [user, startDate, endDate]);

  const fetchPrevExpenses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('expenses').select('*').eq('user_id', user.id)
      .gte('date', prevStartDate).lt('date', prevEndDate);
    setPrevExpenses(data || []);
  }, [user, prevStartDate, prevEndDate]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchPrevExpenses(); }, [fetchPrevExpenses]);

  useEffect(() => {
    if (!user) return;
    supabase.from('categories').select('id, name, parent_id, icon, color')
      .eq('user_id', user.id).order('sort_order')
      .then(({ data }) => setDbCategories(data || []));
  }, [user]);

  // Total real balance
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: walletsData } = await supabase
        .from('wallets').select('initial_balance').eq('user_id', user.id);
      const walletsTotal = (walletsData || []).reduce((s, w: any) => s + (w.initial_balance || 0), 0);
      const { data: allTxns } = await supabase
        .from('expenses').select('value, type, credit_card_id')
        .eq('user_id', user.id).eq('is_paid', true);
      let realBalance = walletsTotal;
      (allTxns || []).forEach((t: any) => {
        if (t.type === 'transfer') return;
        if (t.type === 'income') realBalance += t.value;
        else if (!t.credit_card_id) realBalance -= t.value;
      });
      setTotalRealBalance(realBalance);
    })();
  }, [user, startDate]);

  // Budget alerts
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
      setBudgetTotals({
        totalBudget: budgetData.reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0),
        totalSpent: Object.values(spent).reduce((s: number, v: number) => s + v, 0),
      });
    })();
  }, [user, startDate, endDate]);

  // Overdue cards
  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date();
      const { data: cards } = await supabase.from('credit_cards').select('due_day').eq('user_id', user.id);
      setHasOverdueCards(cards ? cards.some((c: any) => c.due_day < today.getDate()) : false);
    })();
  }, [user]);

  const summary = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    const byCategory: Record<string, number> = {};
    cashExpenses.forEach(e => { byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value; });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      balance: income - expenseTotal,
      totalIncome: income,
      totalExpense: expenseTotal,
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1], categoryKey: largest[0] } : null,
    };
  }, [expenses]);

  const prevSummary = useMemo(() => {
    const nonTransfers = prevExpenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    return { totalIncome: income, totalExpense: expenseTotal, balance: income - expenseTotal };
  }, [prevExpenses]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
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

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
              <SummaryCards
                balance={totalRealBalance}
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

            {/* Analytics Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              <IncomeVsExpenseChart />
              <TopCategoriesPie expenses={expenses} categories={dbCategories} />
              <SavingsRateGauge totalIncome={summary.totalIncome} totalExpense={summary.totalExpense} />
              <EndOfMonthForecast />
              <DailySpendingChart expenses={expenses} />
              <CreditUsageChart />
              <FixedVsVariableChart expenses={expenses} />
              <SubcategoryTreemap expenses={expenses} categories={dbCategories} />
              <WeekComparisonChart expenses={expenses} />
              <IncomeSourcesPie expenses={expenses} categories={dbCategories} />
            </div>

            <CalendarView />
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchExpenses} />
    </SidebarProvider>
  );
}
