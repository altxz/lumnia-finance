import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useUserSettings } from '@/contexts/UserSettingsContext';

import { SummaryCards } from '@/components/SummaryCards';
import { AddExpenseModal } from '@/components/AddExpenseModal';
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
import { CashFlowChart } from '@/components/CashFlowChart';
import { HealthScore } from '@/components/HealthScore';
import { CalendarView } from '@/components/CalendarView';
import { IncomeVsExpenseChart } from '@/components/analytics/IncomeVsExpenseChart';
import { TopExpensesList } from '@/components/analytics/TopExpensesList';
import { CreditUsageChart } from '@/components/analytics/CreditUsageChart';
import { CreditCardSummary } from '@/components/analytics/CreditCardSummary';
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
import { useProjectedTotals } from '@/hooks/useProjectedTotals';

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
  const [showOnboarding, setShowOnboarding] = useState(false);
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

  // Show onboarding only once: after settings are loaded and onboarding not completed
  useEffect(() => {
    if (!settingsLoading && user && !userSettings.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user, settingsLoading, userSettings.onboarding_completed]);

  const [budgetDataRaw, setBudgetDataRaw] = useState<any[]>([]);

  // Compute budget alerts and spending from projected.monthExpenses (avoid duplicate query)
  useEffect(() => {
    if (projected.loading || budgetDataRaw.length === 0) return;
    const spent: Record<string, number> = {};
    projected.monthExpenses.forEach((e: any) => {
      if (e.type !== 'income') spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
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

  const prevSummary = useMemo(() => {
    const nonTransfers = prevExpenses.filter((e: any) => e.type !== 'transfer');
    const income = nonTransfers.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s: number, e: any) => s + e.value, 0);
    return { totalIncome: income, totalExpense: expenseTotal, balance: income - expenseTotal };
  }, [prevExpenses]);

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
            <OnboardingWizard
              open={showOnboarding}
              onComplete={() => { setShowOnboarding(false); refetchSettings(); fetchExtraData(); }}
            />
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
                  healthScore={
                    <HealthScore
                      totalIncome={projected.totalIncome}
                      totalExpense={projected.totalExpense}
                      totalBudget={budgetTotals.totalBudget}
                      totalSpentInBudget={budgetTotals.totalSpent}
                      hasOverdueCards={hasOverdueCardsComputed}
                    />
                  }
                />

                {/* Painel de Gráficos */}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Painel de Análises</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><CreditCardSummary cards={projected.creditCards} allExpenses={projected.invoiceExpenses} wallets={projected.wallets} refetch={projected.refetch} /></div>
                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><CashFlowChart creditCards={projected.creditCards} wallets={projected.wallets} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><TopExpensesList expenses={projected.monthExpenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SubcategoryTreemap expenses={projected.monthExpenses} categories={dbCategories} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><IncomeVsExpenseChart totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><WaterfallChart expenses={projected.monthExpenses} startingBalance={projected.startingBalance} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><IncomeSourcesPie expenses={projected.monthExpenses} categories={dbCategories} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><DailySpendingChart expenses={projected.monthExpenses} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><WeekComparisonChart expenses={projected.monthExpenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><BurndownChart expenses={projected.monthExpenses} totalBudget={budgetTotals.totalBudget} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><EndOfMonthForecast creditCards={projected.creditCards} wallets={projected.wallets} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><CalendarView expenses={projected.monthExpenses} wallets={projected.wallets} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><FixedVsVariableChart expenses={projected.monthExpenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SpendingHeatmap expenses={projected.monthExpenses} /></div>

                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><CreditUsageChart cards={cardsForUsage} unpaidExpenses={unpaidCCExpenses} /></div>
                  <div className="flex flex-col min-h-[280px] sm:min-h-[350px]"><SavingsRateGauge totalIncome={projected.totalIncome} totalExpense={projected.totalExpense} /></div>

                  <div className="lg:col-span-2 flex flex-col min-h-[280px] sm:min-h-[350px]"><NetWorthChart /></div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={projected.refetch} />
    </SidebarProvider>
  );
}
