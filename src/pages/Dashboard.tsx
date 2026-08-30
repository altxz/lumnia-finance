import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CircleAlert } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardInsight, type BudgetCategoryStatus } from '@/components/dashboard/DashboardInsight';
import { DashboardRecentActivity } from '@/components/dashboard/DashboardRecentActivity';
import { GuidedTour } from '@/components/GuidedTour';
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt';
import { MonthSelector } from '@/components/MonthSelector';
import { SmartAlertsCarousel, type SmartAlert } from '@/components/SmartAlertsCarousel';
import { SummaryCards } from '@/components/SummaryCards';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StatePanel } from '@/components/ui/state-panel';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { StaggerItem } from '@/components/ui/stagger';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAnomalyAlerts } from '@/hooks/useAnomalyAlerts';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import { useCategories } from '@/hooks/useStaticData';
import { useSummaryHistory } from '@/hooks/useSummaryHistory';
import { normalizeCategoryKey } from '@/lib/categoryMatch';
import { getCategoryLabel } from '@/lib/constants';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';
import { supabase } from '@/lib/supabase';
import { transactionAmount } from '@/lib/transactionAmount';

const CashFlowChart = lazyNamedWithRetry(() => import('@/components/CashFlowChart'), module => module.CashFlowChart);

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200" aria-label="Carregando painel financeiro">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Skeleton className="h-[280px] rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {[1, 2, 3].map(item => <Skeleton key={item} className="h-[152px] rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-[92px] rounded-xl" />
      <Skeleton className="h-[410px] rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <Skeleton className="h-[230px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { startDate, label: selectedPeriodLabel } = useSelectedDate();
  const isOnline = useOnlineStatus();
  const projected = useProjectedTotals();
  const summaryHistory = useSummaryHistory(projected.startingBalance);
  const anomalyAlerts = useAnomalyAlerts();
  const { data: dbCategories = [], isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();

  const { data: extra, isLoading: extraLoading, error: extraError, refetch: refetchExtra } = useQuery({
    queryKey: ['dashboard-extra', user?.id, startDate],
    queryFn: async () => {
      const [{ data: budgetData, error: budgetError }, { data: recurringBudgetData, error: recurringBudgetError }] = await Promise.all([
        supabase.from('budgets').select('category, category_id, allocated_amount')
          .eq('user_id', user!.id).eq('month_year', startDate),
        supabase.from('budgets').select('category, category_id, allocated_amount, month_year')
          .eq('user_id', user!.id).eq('is_recurring', true).lt('month_year', startDate)
          .order('month_year', { ascending: false }),
      ]);
      if (budgetError) throw budgetError;
      if (recurringBudgetError) throw recurringBudgetError;

      const current = budgetData || [];
      const existing = new Set(current.map((budget: any) => budget.category_id ?? budget.category));
      const inherited: any[] = [];
      const seen = new Set<string>();
      (recurringBudgetData || []).forEach((budget: any) => {
        const key = budget.category_id ?? budget.category;
        if (!key || existing.has(key) || seen.has(key)) return;
        seen.add(key);
        inherited.push({ category: budget.category, category_id: budget.category_id, allocated_amount: budget.allocated_amount });
      });
      return { budgets: [...current, ...inherited] };
    },
    enabled: !!user,
  });

  const budgetData = useMemo(() => extra?.budgets ?? [], [extra?.budgets]);
  const budgetSummary = useMemo(() => {
    const spentByCategory: Record<string, number> = {};
    projected.monthExpenses.forEach(expense => {
      if (expense.type === 'income' || expense.type === 'transfer' || expense.description?.startsWith('Pagamento fatura')) return;
      const key = normalizeCategoryKey(expense.final_category);
      spentByCategory[key] = (spentByCategory[key] || 0) + transactionAmount(expense.value);
    });
    const statuses = budgetData.flatMap((budget: any): BudgetCategoryStatus[] => {
      if (!budget.allocated_amount) return [];
      const categoryName = dbCategories.find(category => category.id === budget.category_id)?.name || budget.category;
      const spent = spentByCategory[normalizeCategoryKey(categoryName)] || 0;
      const limit = Number(budget.allocated_amount) || 0;
      return [{ name: getCategoryLabel(categoryName), spent, limit, ratio: limit > 0 ? spent / limit : 0 }];
    });
    return {
      statuses,
      exceeded: statuses.filter(status => status.ratio >= 1),
    };
  }, [budgetData, dbCategories, projected.monthExpenses]);

  const alerts = useMemo<SmartAlert[]>(() => {
    const result = [...anomalyAlerts];
    if (projected.projectedBalance < 0) {
      result.unshift({
        id: 'negative-balance',
        type: 'critical',
        icon: 'wallet',
        title: 'Saldo projetado negativo',
        description: 'As saídas previstas superam o caixa do período. Revise os próximos compromissos.',
      });
    }
    budgetSummary.exceeded.forEach((status, index) => {
      result.push({
        id: `budget-${index}`,
        type: status.ratio >= 1.2 ? 'critical' : 'warning',
        icon: 'budget',
        title: `${status.name} ultrapassou o orçamento`,
        description: `A categoria chegou a ${Math.round(status.ratio * 100)}% do orçamento definido.`,
      });
    });
    return result;
  }, [anomalyAlerts, budgetSummary.exceeded, projected.projectedBalance]);

  if (authLoading) return <PageLoadingSkeleton title="Carregando resumo financeiro" />;
  if (!user) return <Navigate to="/auth" replace />;

  const isLoading = categoriesLoading || extraLoading || projected.loading || summaryHistory.loading;
  const loadError = projected.error || categoriesError || extraError;
  const retry = () => {
    projected.refetch();
    void refetchCategories();
    void refetchExtra();
  };
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
  const firstName = displayName.trim().split(/\s+/)[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 overflow-auto px-3 pb-32 pt-4 sm:px-5 lg:px-8 lg:pb-12 lg:pt-7">
            <div className="mx-auto w-full max-w-[1440px] space-y-4 sm:space-y-5">
              <InstallPwaPrompt />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="type-title-1">{greeting}, {firstName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Confira o resumo de {selectedPeriodLabel}.</p>
                </div>
                <MonthSelector />
              </div>

              {!isOnline && <OfflineBanner />}

              {loadError ? (
                <StatePanel
                  tone={isOnline ? 'error' : 'offline'}
                  icon={<CircleAlert className="h-5 w-5" />}
                  title={isOnline ? 'Não foi possível carregar seu resumo' : 'Resumo indisponível offline'}
                  description={isOnline ? 'Os dados financeiros não foram alterados. Tente carregar novamente quando a conexão estiver estável.' : 'Reconecte-se para atualizar seu resumo financeiro.'}
                  actionLabel="Tentar novamente"
                  onAction={retry}
                  className="min-h-[360px]"
                />
              ) : isLoading ? (
                <DashboardSkeleton />
              ) : (
                <div className="space-y-7 sm:space-y-8">
                  <StaggerItem index={0}>
                    <SummaryCards
                      balance={projected.projectedBalance}
                      totalIncome={projected.totalIncome}
                      totalExpense={projected.totalExpense}
                      largestCategory={projected.largestCategory}
                      prevBalance={projected.startingBalance}
                      prevIncome={projected.previousMonth.totalIncome}
                      prevExpense={projected.previousMonth.totalExpense}
                      debitExpense={projected.debitExpense}
                      invoiceExpense={projected.invoiceTotal}
                      cardPurchases={projected.cardPurchases}
                      pendingInStartingBalance={projected.pendingInStartingBalance}
                      balanceHistory={summaryHistory.points.map(point => ({ label: point.label, value: point.balance }))}
                      incomeHistory={summaryHistory.points.map(point => ({ label: point.label, value: point.income }))}
                      expenseHistory={summaryHistory.points.map(point => ({ label: point.label, value: point.expense }))}
                      categoryHistory={summaryHistory.categorySeries(projected.largestCategory?.categoryKey).map(point => ({ label: point.label, value: point.expense }))}
                    />
                  </StaggerItem>

                  <StaggerItem index={1}>
                    <SmartAlertsCarousel alerts={alerts} />
                  </StaggerItem>

                  <StaggerItem index={2}>
                    <section aria-labelledby="cash-flow-title" className="space-y-3">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <h2 id="cash-flow-title" className="type-title-2">Ritmo do caixa</h2>
                          <p className="mt-1 text-sm text-muted-foreground">Realizado e previsto ao longo do mês.</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')} className="rounded-full text-primary">
                          <BarChart3 className="mr-1.5 h-4 w-4" /> Análises
                        </Button>
                      </div>
                      <div className="h-[390px] sm:h-[430px]">
                        <Suspense fallback={<Skeleton className="h-full rounded-xl" />}>
                          <CashFlowChart />
                        </Suspense>
                      </div>
                    </section>
                  </StaggerItem>

                  <StaggerItem index={3}>
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
                      <DashboardInsight categories={budgetSummary.statuses} />
                      <DashboardRecentActivity expenses={projected.monthExpenses} categories={dbCategories} />
                    </div>
                  </StaggerItem>

                  <StaggerItem index={4}>
                    <div className="flex justify-center pt-1">
                      <Button variant="outline" className="rounded-full" onClick={() => navigate('/analytics')}>
                        Explorar todas as análises <BarChart3 className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </StaggerItem>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      <GuidedTour />
    </SidebarProvider>
  );
}
