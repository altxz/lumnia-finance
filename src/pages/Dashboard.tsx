import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { SummaryCards } from '@/components/SummaryCards';
import { ExpenseTable, Expense } from '@/components/ExpenseTable';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ period: '1', category: 'all' });

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (filters.period !== 'all') {
      const months = parseInt(filters.period);
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);
      query = query.gte('date', fromDate.toISOString().split('T')[0]);
    }
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
  }, [user, page, filters]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const summary = useMemo(() => {
    // We use all fetched expenses for the current filter for summary
    const total = expenses.reduce((sum, e) => sum + e.value, 0);
    const byCategory: Record<string, number> = {};
    expenses.forEach(e => {
      byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value;
    });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      totalMonth: total,
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1] } : null,
      projectedSavings: Math.max(0, 5000 - total), // placeholder target
    };
  }, [expenses]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
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
          <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
                <p className="text-sm text-muted-foreground">Gerencie e categorize suas despesas com inteligência artificial</p>
              </div>
              <Button variant="success" onClick={() => setModalOpen(true)} className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Nova Despesa
              </Button>
            </div>

            <SummaryCards
              totalMonth={summary.totalMonth}
              largestCategory={summary.largestCategory}
              projectedSavings={summary.projectedSavings}
            />

            <ExpenseTable
              expenses={expenses}
              loading={loading}
              onDeleted={fetchExpenses}
              filters={filters}
              onFilterChange={handleFilterChange}
              page={page}
              totalPages={Math.ceil(totalCount / PAGE_SIZE)}
              onPageChange={setPage}
            />
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchExpenses} />
    </SidebarProvider>
  );
}
