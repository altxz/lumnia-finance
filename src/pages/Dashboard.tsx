import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';

import { useUserSettings } from '@/contexts/UserSettingsContext';

import { SummaryCards } from '@/components/SummaryCards';
const AddExpenseModal = lazy(() => import('@/components/AddExpenseModal').then(m => ({ default: m.AddExpenseModal })));
import { DashboardHeader } from '@/components/DashboardHeader';
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt';
import { SmartAlertsCarousel, SmartAlert } from '@/components/SmartAlertsCarousel';
import { useAnomalyAlerts } from '@/hooks/useAnomalyAlerts';
import { AppSidebar } from '@/components/AppSidebar';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import { GuidedTour } from '@/components/GuidedTour';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';

// Lazy load all chart/widget components
const CashFlowChart = lazy(() => import('@/components/CashFlowChart').then(m => ({ default: m.CashFlowChart })));
const DashboardScoreCarousel = lazy(() => import('@/components/DashboardScoreCarousel').then(m => ({ default: m.DashboardScoreCarousel })));
const CalendarView = lazy(() => import('@/components/CalendarView').then(m => ({ default: m.CalendarView })));
const IncomeVsExpenseChart = lazy(() => import('@/components/analytics/IncomeVsExpenseChart').then(m => ({ default: m.IncomeVsExpenseChart })));
const TopExpensesList = lazy(() => import('@/components/analytics/TopExpensesList').then(m => ({ default: m.TopExpensesList })));
const CreditUsageChart = lazy(() => import('@/components/analytics/CreditUsageChart').then(m => ({ default: m.CreditUsageChart })));
const CreditCardSummary = lazy(() => import('@/components/analytics/CreditCardSummary').then(m => ({ default: m.CreditCardSummary })));
const EndOfMonthForecast = lazy(() => import('@/components/analytics/EndOfMonthForecast').then(m => ({ default: m.EndOfMonthForecast })));
const DailySpendingChart = lazy(() => import('@/components/analytics/DailySpendingChart').then(m => ({ default: m.DailySpendingChart })));
const FixedVsVariableChart = lazy(() => import('@/components/analytics/FixedVsVariableChart').then(m => ({ default: m.FixedVsVariableChart })));
const SubcategoryTreemap = lazy(() => import('@/components/analytics/SubcategoryTreemap').then(m => ({ default: m.SubcategoryTreemap })));
const SavingsRateGauge = lazy(() => import('@/components/analytics/SavingsRateGauge').then(m => ({ default: m.SavingsRateGauge })));
const WeekComparisonChart = lazy(() => import('@/components/analytics/WeekComparisonChart').then(m => ({ default: m.WeekComparisonChart })));
const IncomeSourcesPie = lazy(() => import('@/components/analytics/IncomeSourcesPie').then(m => ({ default: m.IncomeSourcesPie })));
const WaterfallChart = lazy(() => import('@/components/analytics/WaterfallChart').then(m => ({ default: m.WaterfallChart })));
const SpendingHeatmap = lazy(() => import('@/components/analytics/SpendingHeatmap').then(m => ({ default: m.SpendingHeatmap })));
const BurndownChart = lazy(() => import('@/components/analytics/BurndownChart').then(m => ({ default: m.BurndownChart })));
const NetWorthChart = lazy(() => import('@/components/analytics/NetWorthChart').then(m => ({ default: m.NetWorthChart })));

function ChartFallback() {
  return <Skeleton className="h-full w-full min-h-[280px] rounded-2xl" />;
}

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
  const { settings: userSettings, loading: settingsLoading, refetch: refetchSettings } = useUserSettings();
  const projected = useProjectedTotals();
  const anomalyAlerts = useAnomalyAlerts();
  const [modalOpen, setModalOpen] = useState(false);
  
  const [budgetTotals, setBudgetTotals] = useState({ totalBudget: 0, totalSpent: 0 });
  
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

  const [prevExpenses, setPrevExpenses] = useState<any[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  const fetchExtraData = useCallback(async () => {
    if (!user) return;
    const counter = ++fetchCounterRef.current;
    setDataLoading(true);

    try {
      const [
        { data: prevExpData },
        { data: catData },
        { data: budgetData },
      ] = await Promise.all([
        supabase.from('expenses').select('id, value, type, credit_card_id, final_category').eq('user_id', user.id)
          .gte('date', prevStartDate).lt('date', prevEndDate),
        supabase.from('categories').select('id, name, parent_id, icon, color')
          .eq('user_id', user.id).order('sort_order'),
        supabase.from('budgets').select('category, allocated_amount')
          .eq('user_id', user.id).eq('month_year', startDate),
      ]);

      if (counter !== fetchCounterRef.current) return;

      setPrevExpenses(prevExpData || []);
      setDbCategories(catData || []);

      // Budget spending computed from projected.monthExpenses in a useMemo below
      setBudgetTotals(prev => ({
        ...prev,
        totalBudget: (budgetData || []).reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0),
      }));

      // Store budget data for useMemo computation
      setBudgetDataRaw(budgetData || []);
    } finally {
      if (counter === fetchCounterRef.current) setDataLoading(false);
    }
  }, [user, startDate, endDate, prevStartDate, prevEndDate]);

  useEffect(() => { fetchExtraData(); }, [fetchExtraData]);


  const [budgetDataRaw, setBudgetDataRaw] = useState<any[]>([]);

  // Compute budget alerts and spending from projected.monthExpenses (avoid duplicate query)
  useEffect(() => {
    if (projected.loading || budgetDataRaw.length === 0) return;
    const spent: Record<string, number> = {};
    projected.monthExpenses.forEach((e: any) => {
      if (e.type !== 'income' && !e.description?.startsWith('Pagamento fatura')) spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
    });
    const warnings: string[] = [];
    budgetDataRaw.forEach((b: any) => {
      if (b.allocated_amount > 0) {
        const pct = (spent[b.category] || 0) / b.allocated_amount * 100;
        if (pct >= 80) warnings.push(getCategoryInfo(b.category).label);
      }
    });
    setBudgetAlerts(warnings);
    setBudgetTotals({
      totalBudget: budgetDataRaw.reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0),
      totalSpent: Object.values(spent).reduce((s: number, v: number) => s + v, 0),
    });
  }, [projected.monthExpenses, projected.loading, budgetDataRaw]);

  // Compute hasOverdueCards from projected.creditCards (avoid duplicate query)
  const hasOverdueCardsComputed = useMemo(() => {
    const today = new Date();
    return projected.creditCards.some((c: any) => c.due_day < today.getDate());
  }, [projected.creditCards]);

  // Derive unpaid CC expenses for CreditUsageChart
  const unpaidCCExpenses = useMemo(() =>
    projected.invoiceExpenses
      .filter(e => !e.is_paid)
      .map(e => ({ value: e.value, credit_card_id: e.credit_card_id! })),
    [projected.invoiceExpenses]
  );

  // Cards with limit info for CreditUsageChart
  const cardsForUsage = useMemo(() =>
    projected.creditCards.map(c => ({ id: c.id, name: c.name, limit_amount: c.limit_amount })),
    [projected.creditCards]
  );

  // Previous month summary including CC invoices
  const prevSummary = useMemo(() => {
    const nonTransfers = prevExpenses.filter((e: any) => e.type !== 'transfer');
    const income = nonTransfers.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s: number, e: any) => s + e.value, 0);

    // Include CC invoice totals for previous month
    let ccTotal = 0;
    if (projected.creditCards.length > 0) {
      const ccPool = projected.invoiceExpenses;
      projected.creditCards.forEach((card: any) => {
        const period = getInvoicePeriod(card, prevYear, prevMonth);
        const invoice = matchExpensesToInvoice(ccPool, period);
        ccTotal += invoice.total;
      });
    }

    const totalExp = expenseTotal + ccTotal;
    return { totalIncome: income, totalExpense: totalExp, balance: income - totalExp };
  }, [prevExpenses, projected.creditCards, projected.invoiceExpenses, prevYear, prevMonth]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const isLoading = dataLoading || projected.loading;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <InstallPwaPrompt />
            <MonthSelector />

            {isLoading ? (
              <DashboardSkeleton />
            ) : (
              <>
                {(() => {
                  const allAlerts: SmartAlert[] = [...anomalyAlerts];
                  if (projected.projectedBalance < 0) {
                    allAlerts.unshift({
                      id: 'negative-balance',
                      type: 'critical',
                      icon: 'wallet',
                      title: 'Saldo previsto negativo',
                      description: `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projected.projectedBalance)}. Revise suas despesas.`,
                    });
                  }
                  budgetAlerts.forEach((label, i) => {
                    allAlerts.push({
                      id: `budget-${i}`,
                      type: 'warning',
                      icon: 'budget',
                      title: `Orçamento: ${label}`,
                      description: 'Você está próximo de ultrapassar o limite definido para esta categoria.',
                    });
                  });
                  return <SmartAlertsCarousel alerts={allAlerts} />;
                })()}

                <SummaryCards
                  balance={projected.projectedBalance}
                  totalIncome={projected.totalIncome}
                  totalExpense={projected.totalExpense}
                  largestCategory={projected.largestCategory}
                  prevBalance={prevSummary.balance}
                  prevIncome={prevSummary.totalIncome}
                  prevExpense={prevSummary.totalExpense}
                  pendingInStartingBalance={projected.pendingInStartingBalance}
                  healthScore={
                    <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
                      <DashboardScoreCarousel
                        totalIncome={projected.totalIncome}
                        totalExpense={projected.totalExpense}
                        totalBudget={budgetTotals.totalBudget}
                        totalSpentInBudget={budgetTotals.totalSpent}
                        hasOverdueCards={hasOverdueCardsComputed}
                        creditCards={projected.creditCards}
                        monthExpenses={projected.monthExpenses}
                      />
                    </Suspense>
                  }
                />

                {/* Painel de Gráficos */}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Painel de Análises</h2>

                <Suspense fallback={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6"><ChartFallback /><ChartFallback /><ChartFallback /><ChartFallback /></div>}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><CreditCardSummary cards={projected.creditCards} allExpenses={projected.invoiceExpenses} wallets={projected.wallets} refetch={projected.refetch} /></Suspense></div>
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><CashFlowChart creditCards={projected.creditCards} wallets={projected.wallets} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><TopExpensesList expenses={projected.monthExpenses} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><SubcategoryTreemap expenses={projected.monthExpenses} categories={dbCategories} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><IncomeVsExpenseChart totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><WaterfallChart expenses={projected.monthExpenses} startingBalance={projected.startingBalance} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><IncomeSourcesPie expenses={projected.monthExpenses} categories={dbCategories} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><DailySpendingChart expenses={projected.monthExpenses} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><WeekComparisonChart expenses={projected.monthExpenses} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><BurndownChart expenses={projected.monthExpenses} totalBudget={budgetTotals.totalBudget} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><EndOfMonthForecast creditCards={projected.creditCards} wallets={projected.wallets} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><CalendarView expenses={projected.monthExpenses} wallets={projected.wallets} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><FixedVsVariableChart expenses={projected.monthExpenses} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><SpendingHeatmap expenses={projected.monthExpenses} /></Suspense></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><CreditUsageChart cards={cardsForUsage} unpaidExpenses={unpaidCCExpenses} /></Suspense></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><SavingsRateGauge totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></Suspense></div>

                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><Suspense fallback={<ChartFallback />}><NetWorthChart /></Suspense></div>
                </div>
                </Suspense>
              </>
            )}
          </main>
        </div>
      </div>
      {modalOpen && (
        <Suspense fallback={null}>
          <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={projected.refetch} />
        </Suspense>
      )}
      <GuidedTour />
    </SidebarProvider>
  );
}
