import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import { SummaryCards } from '@/components/SummaryCards';
import { TransactionFeed } from '@/components/TransactionFeed';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { ImportTransactionsModal } from '@/components/ImportTransactionsModal';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AppSidebar } from '@/components/AppSidebar';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import type { Expense } from '@/components/ExpenseTable';

const PAGE_SIZE = 20;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ category: 'all' });
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false });

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
  }, [user, page, filters, startDate, endDate]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name')
      .then(({ data }) => setWallets(data || []));
  }, [user]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const summary = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    const balance = income - expenseTotal;
    const byCategory: Record<string, number> = {};
    cashExpenses.forEach(e => {
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
            <MonthSelector />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gerencie receitas e despesas com IA</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportModalOpen(true)} className="gap-2 rounded-xl h-10 sm:h-11 px-3 sm:px-5 font-semibold text-sm">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Importar CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
                <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-10 sm:h-11 px-4 sm:px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-sm">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Nova Transação</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </div>
            </div>

            <SummaryCards
              balance={summary.balance}
              totalIncome={summary.totalIncome}
              totalExpense={summary.totalExpense}
              largestCategory={summary.largestCategory}
            />

            <TransactionFeed
              expenses={expenses}
              loading={loading}
              onDeleted={fetchExpenses}
              filters={filters}
              onFilterChange={handleFilterChange}
              page={page}
              totalPages={Math.ceil(totalCount / PAGE_SIZE)}
              onPageChange={setPage}
              wallets={wallets}
            />
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchExpenses} />
      <ImportTransactionsModal open={importModalOpen} onOpenChange={setImportModalOpen} onImported={fetchExpenses} />
    </SidebarProvider>
  );
}
