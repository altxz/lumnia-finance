import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { useBudgetData } from '@/hooks/useBudgetData';
import { BudgetSummaryCards } from '@/components/budget/BudgetSummaryCards';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';

export default function BudgetPage() {
  const { user, loading: authLoading } = useAuth();
  const { label: monthLabel } = useSelectedDate();
  const { tree, totalAllocated, totalSpent, totalIncome, loading, savingId, saveBudget } = useBudgetData();

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <MonthSelector />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orçamento Mensal</h1>

            <BudgetSummaryCards totalIncome={totalIncome} totalAllocated={totalAllocated} totalSpent={totalSpent} />

            {totalIncome > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distribuição da receita</span>
                  <span className="font-medium">{Math.min(100, (totalAllocated / totalIncome * 100)).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (totalAllocated / totalIncome) * 100)} className="h-3" />
              </div>
            )}

            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando...</p>
            ) : tree.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Nenhuma categoria cadastrada. Adicione categorias em Configurações.</p>
            ) : (
              <div className="space-y-3">
                {tree.map(node => (
                  <BudgetCategoryRow key={node.category.id} node={node} saveBudget={saveBudget} savingId={savingId} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
