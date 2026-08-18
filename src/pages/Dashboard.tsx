import { useState, useEffect, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useStaticData';

import { useUserSettings } from '@/contexts/UserSettingsContext';

import { SummaryCards } from '@/components/SummaryCards';
const AddExpenseModal = lazyNamedWithRetry(() => import('@/components/AddExpenseModal'), m => m.AddExpenseModal);
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
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';

// Lazy load all chart/widget components
const CashFlowChart = lazyNamedWithRetry(() => import('@/components/CashFlowChart'), m => m.CashFlowChart);
const DashboardScoreCarousel = lazyNamedWithRetry(() => import('@/components/DashboardScoreCarousel'), m => m.DashboardScoreCarousel);
const CalendarView = lazyNamedWithRetry(() => import('@/components/CalendarView'), m => m.CalendarView);
const IncomeVsExpenseChart = lazyNamedWithRetry(() => import('@/components/analytics/IncomeVsExpenseChart'), m => m.IncomeVsExpenseChart);
const TopExpensesList = lazyNamedWithRetry(() => import('@/components/analytics/TopExpensesList'), m => m.TopExpensesList);
const CreditUsageChart = lazyNamedWithRetry(() => import('@/components/analytics/CreditUsageChart'), m => m.CreditUsageChart);
const CreditCardSummary = lazyNamedWithRetry(() => import('@/components/analytics/CreditCardSummary'), m => m.CreditCardSummary);
const EndOfMonthForecast = lazyNamedWithRetry(() => import('@/components/analytics/EndOfMonthForecast'), m => m.EndOfMonthForecast);
const DailySpendingChart = lazyNamedWithRetry(() => import('@/components/analytics/DailySpendingChart'), m => m.DailySpendingChart);
const FixedVsVariableChart = lazyNamedWithRetry(() => import('@/components/analytics/FixedVsVariableChart'), m => m.FixedVsVariableChart);
const SubcategoryTreemap = lazyNamedWithRetry(() => import('@/components/analytics/SubcategoryTreemap'), m => m.SubcategoryTreemap);
const SavingsRateGauge = lazyNamedWithRetry(() => import('@/components/analytics/SavingsRateGauge'), m => m.SavingsRateGauge);
const WeekComparisonChart = lazyNamedWithRetry(() => import('@/components/analytics/WeekComparisonChart'), m => m.WeekComparisonChart);
const IncomeSourcesPie = lazyNamedWithRetry(() => import('@/components/analytics/IncomeSourcesPie'), m => m.IncomeSourcesPie);
const WaterfallChart = lazyNamedWithRetry(() => import('@/components/analytics/WaterfallChart'), m => m.WaterfallChart);
const SpendingHeatmap = lazyNamedWithRetry(() => import('@/components/analytics/SpendingHeatmap'), m => m.SpendingHeatmap);
const BurndownChart = lazyNamedWithRetry(() => import('@/components/analytics/BurndownChart'), m => m.BurndownChart);
const NetWorthChart = lazyNamedWithRetry(() => import('@/components/analytics/NetWorthChart'), m => m.NetWorthChart);
import { TileGrid, Tile } from '@/components/analytics/TileGrid';

function ChartFallback() {
  return <Skeleton className="h-full w-full rounded-2xl" />;
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

  // Previous month date range
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevNextM = prevMonth === 11 ? 0 : prevMonth + 1;
  const prevNextY = prevMonth === 11 ? prevYear + 1 : prevYear;
  const prevEndDate = `${prevNextY}-${String(prevNextM + 1).padStart(2, '0')}-01`;

  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  // Categorias vêm do cache compartilhado (30 min)
  const { data: dbCategories = [], isLoading: categoriesLoading } = useCategories();

  // Mês anterior + orçamentos do mês: cacheados por chave estável
  const { data: extra, isLoading: extraLoading } = useQuery({
    queryKey: ['dashboard-extra', user?.id, startDate, prevStartDate],
    queryFn: async () => {
      const [{ data: prevExpData }, { data: budgetData }] = await Promise.all([
        supabase.from('expenses').select('id, value, type, credit_card_id, final_category').eq('user_id', user!.id)
          .gte('date', prevStartDate).lt('date', prevEndDate),
        supabase.from('budgets').select('category, allocated_amount')
          .eq('user_id', user!.id).eq('month_year', startDate),
      ]);
      return { prevExpenses: prevExpData || [], budgets: budgetData || [] };
    },
    enabled: !!user,
  });

  const prevExpenses = extra?.prevExpenses ?? [];
  const budgetDataRaw = extra?.budgets ?? [];
  const dataLoading = categoriesLoading || extraLoading;

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

                <Suspense fallback={<TileGrid><Tile size="wide"><ChartFallback /></Tile><Tile size="medium"><ChartFallback /></Tile><Tile size="medium"><ChartFallback /></Tile></TileGrid>}>
                <TileGrid>
                  <Tile size="wide"><Suspense fallback={<ChartFallback />}><CreditCardSummary cards={projected.creditCards} allExpenses={projected.invoiceExpenses} wallets={projected.wallets} refetch={projected.refetch} /></Suspense></Tile>
                  <Tile size="wide"><Suspense fallback={<ChartFallback />}><CashFlowChart creditCards={projected.creditCards} wallets={projected.wallets} /></Suspense></Tile>

                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><TopExpensesList expenses={projected.monthExpenses} /></Suspense></Tile>
                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><SubcategoryTreemap expenses={projected.monthExpenses} categories={dbCategories} /></Suspense></Tile>

                  <Tile size="small"><Suspense fallback={<ChartFallback />}><FixedVsVariableChart expenses={projected.monthExpenses} /></Suspense></Tile>
                  <Tile size="small"><Suspense fallback={<ChartFallback />}><IncomeSourcesPie expenses={projected.monthExpenses} categories={dbCategories} /></Suspense></Tile>
                  <Tile size="small"><Suspense fallback={<ChartFallback />}><IncomeVsExpenseChart totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></Suspense></Tile>
                  <Tile size="small"><Suspense fallback={<ChartFallback />}><SavingsRateGauge totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></Suspense></Tile>

                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><DailySpendingChart expenses={projected.monthExpenses} /></Suspense></Tile>
                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><WaterfallChart expenses={projected.monthExpenses} startingBalance={projected.startingBalance} /></Suspense></Tile>

                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><WeekComparisonChart expenses={projected.monthExpenses} /></Suspense></Tile>
                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><BurndownChart expenses={projected.monthExpenses} totalBudget={budgetTotals.totalBudget} /></Suspense></Tile>

                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><EndOfMonthForecast /></Suspense></Tile>
                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><CalendarView expenses={projected.monthExpenses} wallets={projected.wallets} /></Suspense></Tile>

                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><SpendingHeatmap expenses={projected.monthExpenses} /></Suspense></Tile>
                  <Tile size="medium"><Suspense fallback={<ChartFallback />}><CreditUsageChart cards={cardsForUsage} unpaidExpenses={unpaidCCExpenses} /></Suspense></Tile>

                  <Tile size="wide"><Suspense fallback={<ChartFallback />}><NetWorthChart /></Suspense></Tile>
                </TileGrid>
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
