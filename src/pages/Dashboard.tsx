import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import { CashFlowChart } from '@/components/CashFlowChart';
import { HealthScore } from '@/components/HealthScore';
import { CalendarView } from '@/components/CalendarView';
import { IncomeVsExpenseChart } from '@/components/analytics/IncomeVsExpenseChart';
import { TopExpensesList } from '@/components/analytics/TopExpensesList';
import { CreditUsageChart } from '@/components/analytics/CreditUsageChart';
import { EndOfMonthForecast } from '@/components/analytics/EndOfMonthForecast';
import { DailySpendingChart } from '@/components/analytics/DailySpendingChart';
import { FixedVsVariableChart } from '@/components/analytics/FixedVsVariableChart';
import { SubcategoryTreemap } from '@/components/analytics/SubcategoryTreemap';
import { SavingsRateGauge } from '@/components/analytics/SavingsRateGauge';
import { WeekComparisonChart } from '@/components/analytics/WeekComparisonChart';
import { IncomeSourcesPie } from '@/components/analytics/IncomeSourcesPie';
import { WaterfallChart } from '@/components/analytics/WaterfallChart';
import { SpendingHeatmap } from '@/components/analytics/SpendingHeatmap';
import { BurndownChart } from '@/components/analytics/BurndownChart';
import { NetWorthChart } from '@/components/analytics/NetWorthChart';
import type { Expense } from '@/components/ExpenseTable';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-2xl" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-[300px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-2xl" />
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [budgetTotals, setBudgetTotals] = useState({ totalBudget: 0, totalSpent: 0 });
  const [hasOverdueCards, setHasOverdueCards] = useState(false);
  const [totalRealBalance, setTotalRealBalance] = useState(0);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const fetchCounterRef = useRef(0);

  // Previous month date range
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevNextM = prevMonth === 11 ? 0 : prevMonth + 1;
  const prevNextY = prevMonth === 11 ? prevYear + 1 : prevYear;
  const prevEndDate = `${prevNextY}-${String(prevNextM + 1).padStart(2, '0')}-01`;

  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    const counter = ++fetchCounterRef.current;
    setDataLoading(true);

    try {
      const [
        { data: expData },
        { data: prevExpData },
        { data: catData },
        { data: walletsData },
        { data: allTxns },
        { data: budgetData },
        { data: budgetExpData },
        { data: cards },
      ] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', user.id)
          .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
        supabase.from('expenses').select('*').eq('user_id', user.id)
          .gte('date', prevStartDate).lt('date', prevEndDate),
        supabase.from('categories').select('id, name, parent_id, icon, color')
          .eq('user_id', user.id).order('sort_order'),
        supabase.from('wallets').select('initial_balance').eq('user_id', user.id),
        supabase.from('expenses').select('value, type, credit_card_id')
          .eq('user_id', user.id).eq('is_paid', true),
        supabase.from('budgets').select('category, allocated_amount')
          .eq('user_id', user.id).eq('month_year', startDate),
        supabase.from('expenses').select('final_category, value, type')
          .eq('user_id', user.id).gte('date', startDate).lt('date', endDate),
        supabase.from('credit_cards').select('due_day').eq('user_id', user.id),
      ]);

      if (counter !== fetchCounterRef.current) return;

      setExpenses(expData || []);
      setPrevExpenses(prevExpData || []);
      setDbCategories(catData || []);

      const walletsTotal = (walletsData || []).reduce((s: number, w: any) => s + (w.initial_balance || 0), 0);
      let realBalance = walletsTotal;
      (allTxns || []).forEach((t: any) => {
        if (t.type === 'transfer') return;
        if (t.type === 'income') realBalance += t.value;
        else if (!t.credit_card_id) realBalance -= t.value;
      });
      setTotalRealBalance(realBalance);

      const spent: Record<string, number> = {};
      (budgetExpData || []).forEach((e: any) => {
        if (e.type !== 'income') spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
      });
      const warnings: string[] = [];
      (budgetData || []).forEach((b: any) => {
        if (b.allocated_amount > 0) {
          const pct = (spent[b.category] || 0) / b.allocated_amount * 100;
          if (pct >= 80) warnings.push(getCategoryInfo(b.category).label);
        }
      });
      setBudgetAlerts(warnings);
      setBudgetTotals({
        totalBudget: (budgetData || []).reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0),
        totalSpent: Object.values(spent).reduce((s: number, v: number) => s + v, 0),
      });

      const today = new Date();
      setHasOverdueCards(cards ? cards.some((c: any) => c.due_day < today.getDate()) : false);
    } finally {
      if (counter === fetchCounterRef.current) setDataLoading(false);
    }
  }, [user, startDate, endDate, prevStartDate, prevEndDate]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

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
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            <InstallPwaPrompt />
            <MonthSelector />

            {dataLoading ? (
              <DashboardSkeleton />
            ) : (
              <>
                <AnomalyInsights />

                {budgetAlerts.length > 0 && (
                  <Alert variant="destructive" className="rounded-xl border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="font-medium text-sm">
                      Atenção: Você está quase ultrapassando seu orçamento em{' '}
                      <span className="font-bold">{budgetAlerts.join(' e ')}</span>!
                    </AlertDescription>
                  </Alert>
                )}

                <SummaryCards
                  balance={totalRealBalance}
                  totalIncome={summary.totalIncome}
                  totalExpense={summary.totalExpense}
                  largestCategory={summary.largestCategory}
                  prevBalance={prevSummary.balance}
                  prevIncome={prevSummary.totalIncome}
                  prevExpense={prevSummary.totalExpense}
                  healthScore={
                    <HealthScore
                      totalIncome={summary.totalIncome}
                      totalExpense={summary.totalExpense}
                      totalBudget={budgetTotals.totalBudget}
                      totalSpentInBudget={budgetTotals.totalSpent}
                      hasOverdueCards={hasOverdueCards}
                    />
                  }
                />

                {/* Painel de Gráficos - Grid Estático */}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Painel de Análises</h2>

                {/* Painel de Gráficos - Grid em Duplas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                  {/* Destaque Topo: Fluxo de Caixa (Largura Total) */}
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><CashFlowChart /></div>

                  {/* Pares 1: Maiores Compras e Subcategorias */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><TopExpensesList expenses={expenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SubcategoryTreemap expenses={expenses} categories={dbCategories} /></div>

                  {/* Pares 2: Receita vs Despesas e Cascata */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><IncomeVsExpenseChart /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><WaterfallChart expenses={expenses} startingBalance={totalRealBalance - summary.totalIncome + summary.totalExpense} /></div>

                  {/* Pares 3: Origem e Rotina */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><IncomeSourcesPie expenses={expenses} categories={dbCategories} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><DailySpendingChart expenses={expenses} /></div>

                  {/* Pares 4: Controle de Hábitos */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><WeekComparisonChart expenses={expenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><BurndownChart expenses={expenses} totalBudget={budgetTotals.totalBudget} /></div>

                  {/* Pares 5: Previsão e Calendário */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><EndOfMonthForecast /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><CalendarView /></div>

                  {/* Pares 6: Fixo vs Variável e Mapa de Calor */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><FixedVsVariableChart expenses={expenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SpendingHeatmap expenses={expenses} /></div>

                  {/* Pares 7: Cartão e Poupança */}
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><CreditUsageChart /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SavingsRateGauge totalIncome={summary.totalIncome} totalExpense={summary.totalExpense} /></div>

                  {/* Destaque Rodapé: Patrimônio Líquido (Largura Total) */}
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><NetWorthChart /></div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchAllData} />
    </SidebarProvider>
  );
}
