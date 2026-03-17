import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { SummaryCards } from '@/components/SummaryCards';
import { ExpenseTable, Expense } from '@/components/ExpenseTable';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
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
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const expenseTotal = nonTransfers.filter(e => e.type !== 'income').reduce((s, e) => s + e.value, 0);
    const balance = income - expenseTotal;
    const byCategory: Record<string, number> = {};
    nonTransfers.filter(e => e.type !== 'income').forEach(e => {
      byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value;
    });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      balance,
      totalIncome: income,
      totalExpense: expenseTotal,
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1] } : null,
    };
  }, [expenses]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-medium">Carregando...</div>
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
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
                <p className="text-sm text-muted-foreground mt-1">Gerencie receitas e despesas com inteligência artificial</p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" />
                Nova Transação
              </Button>
            </div>

            <SummaryCards
              balance={summary.balance}
              totalIncome={summary.totalIncome}
              totalExpense={summary.totalExpense}
              largestCategory={summary.largestCategory}
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
