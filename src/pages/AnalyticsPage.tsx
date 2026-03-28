import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { CategoryCharts } from '@/components/analytics/CategoryCharts';
import { InsightsSection } from '@/components/analytics/InsightsSection';
import { TrendsCharts } from '@/components/analytics/TrendsCharts';
import { ExpenseTreemap } from '@/components/analytics/ExpenseTreemap';
import { EmergencyFundCard } from '@/components/analytics/EmergencyFundCard';
import { NetWorthChart } from '@/components/analytics/NetWorthChart';
import { GoalsSection } from '@/components/analytics/GoalsSection';
import { useAnalyticsData, AnalyticsFilters } from '@/hooks/useAnalyticsData';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '6', compare: false });
  const data = useAnalyticsData(filters);

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground font-medium">Carregando...</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            {/* Header + Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <p className="text-sm text-muted-foreground mt-1">Insights preditivos e visualizações interativas</p>
              </div>
              <div className="flex items-center gap-4">
                <Select value={filters.period} onValueChange={v => setFilters(f => ({ ...f, period: v }))}>
                  <SelectTrigger className="w-[160px] rounded-xl">
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
                  <Switch checked={filters.compare} onCheckedChange={v => setFilters(f => ({ ...f, compare: v }))} id="compare" />
                  <Label htmlFor="compare" className="text-sm cursor-pointer">Comparar</Label>
                </div>
              </div>
            </div>

            {data.loading ? (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-[130px] rounded-2xl" />)}
                </div>
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {[1,2].map(i => <Skeleton key={i} className="h-[320px] rounded-2xl" />)}
                </div>
              </div>
            ) : (
              <>
                <OverviewCards
                  avgMonthly={data.avgMonthly}
                  totalCurrent={data.totalCurrentPeriod}
                  totalPrevious={data.totalPreviousPeriod}
                  predictedNextMonth={data.predictedNextMonth}
                  financialScore={data.financialScore}
                  biggestSaving={data.biggestSavingOpportunity}
                />
                <CategoryCharts categoryStats={data.categoryStats} compare={filters.compare} />
                <ExpenseTreemap categoryStats={data.categoryStats} />
                <InsightsSection
                  avgMonthly={data.avgMonthly}
                  categoryStats={data.categoryStats}
                  weekdayAnalysis={data.weekdayAnalysis}
                  predictedNextMonth={data.predictedNextMonth}
                />
                <TrendsCharts monthlyData={data.monthlyData} predictedNextMonth={data.predictedNextMonth} />
                <GoalsSection avgMonthly={data.avgMonthly} totalCurrentPeriod={data.totalCurrentPeriod} />
                <EmergencyFundCard />
                <NetWorthChart />
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
