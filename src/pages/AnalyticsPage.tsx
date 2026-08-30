import { useEffect, useState, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAnalyticsData, AnalyticsFilters } from '@/hooks/useAnalyticsData';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/state-panel';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { StaggerItem } from '@/components/ui/stagger';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { TriangleAlert } from 'lucide-react';

const FinancialOverview = lazyNamedWithRetry(() => import('@/components/analytics/FinancialOverview'), m => m.FinancialOverview);
const CategoryCharts = lazyNamedWithRetry(() => import('@/components/analytics/CategoryCharts'), m => m.CategoryCharts);
const InsightsSection = lazyNamedWithRetry(() => import('@/components/analytics/InsightsSection'), m => m.InsightsSection);
const TrendsCharts = lazyNamedWithRetry(() => import('@/components/analytics/TrendsCharts'), m => m.TrendsCharts);
const EmergencyFundCard = lazyNamedWithRetry(() => import('@/components/analytics/EmergencyFundCard'), m => m.EmergencyFundCard);
const NetWorthChart = lazyNamedWithRetry(() => import('@/components/analytics/NetWorthChart'), m => m.NetWorthChart);

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '6', compare: false });
  const [showSecondarySections, setShowSecondarySections] = useState(false);
  const data = useAnalyticsData(filters);

  useEffect(() => {
    setShowSecondarySections(false);
    if (data.loading || data.error || !data.hasData) return;
    const timer = window.setTimeout(() => setShowSecondarySections(true), 180);
    return () => window.clearTimeout(timer);
  }, [data.error, data.hasData, data.loading, filters.compare, filters.period]);

  if (authLoading) return (
    <PageLoadingSkeleton title="Carregando análises" />
  );
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            {/* Header + Filters */}
            <PageHeader
              eyebrow="Inteligência financeira"
              title="Análises"
              description="Tendências, comparações e projeções para apoiar suas decisões."
              actions={<>
                <Select value={filters.period} onValueChange={value => setFilters(current => ({
                  period: value as AnalyticsFilters['period'],
                  compare: value === 'all' ? false : current.compare,
                }))}>
                  <SelectTrigger className="min-w-[154px] sm:min-w-[170px] rounded-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Últimos 12 meses</SelectItem>
                    <SelectItem value="all">Todo período</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={filters.compare}
                    disabled={filters.period === 'all'}
                    onCheckedChange={value => setFilters(current => ({ ...current, compare: value }))}
                    id="compare"
                  />
                  <Label htmlFor="compare" className="text-sm cursor-pointer">Comparar</Label>
                </div>
              </>}
            />

            {!isOnline && <OfflineBanner />}

            {data.loading ? (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-[130px] rounded-2xl" />)}
                </div>
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {[1,2].map(i => <Skeleton key={i} className="h-[320px] rounded-2xl" />)}
                </div>
              </div>
            ) : data.error ? (
              <StatePanel
                tone={isOnline ? 'error' : 'offline'}
                icon={<TriangleAlert className="h-5 w-5" />}
                title={isOnline ? 'Não foi possível carregar as análises' : 'Análises indisponíveis offline'}
                description={isOnline ? data.error : 'Reconecte-se para atualizar suas análises.'}
                actionLabel="Tentar novamente"
                onAction={() => void data.refetch()}
                className="min-h-0 rounded-3xl py-6"
              />
            ) : !data.hasData ? (
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-6 space-y-2">
                  <h2 className="text-lg font-semibold">Ainda não há gastos analisáveis neste período</h2>
                  <p className="text-sm text-muted-foreground">Adicione despesas ou escolha outro período para visualizar tendências e comparações.</p>
                </CardContent>
              </Card>
            ) : (
              <Suspense fallback={<div className="space-y-4"><Skeleton className="h-[130px] rounded-2xl" /><Skeleton className="h-[320px] rounded-2xl" /></div>}>
                <StaggerItem index={0}>
                  <FinancialOverview
                    monthlyData={data.monthlyData}
                    totalIncome={data.totalIncomePeriod}
                    totalExpense={data.totalCurrentPeriod}
                    previousIncome={data.totalPreviousIncomePeriod}
                    previousExpense={data.totalPreviousPeriod}
                    comparisonAvailable={data.period.comparisonAvailable}
                  />
                </StaggerItem>
                <StaggerItem index={1}>
                  <InsightsSection
                    totalCurrentPeriod={data.totalCurrentPeriod}
                    avgMonthly={data.avgMonthly}
                    categoryStats={data.categoryStats}
                    weekdayAnalysis={data.weekdayAnalysis}
                    predictedNextMonth={data.predictedNextMonth}
                  />
                </StaggerItem>
                {showSecondarySections ? <>
                  <StaggerItem index={0}><CategoryCharts categoryStats={data.categoryStats} compare={filters.compare} /></StaggerItem>
                  <StaggerItem index={1}><TrendsCharts monthlyData={data.monthlyData} forecast={data.forecast} /></StaggerItem>
                  <StaggerItem index={2}><EmergencyFundCard /></StaggerItem>
                  <StaggerItem index={3}><NetWorthChart /></StaggerItem>
                </> : (
                  <div className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Carregando análises complementares">
                    <Skeleton className="h-[280px] rounded-2xl" />
                    <Skeleton className="h-[280px] rounded-2xl" />
                  </div>
                )}
              </Suspense>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
