import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/constants';
import { Repeat, ArrowUpCircle, ArrowDownCircle, CalendarClock, Wallet } from 'lucide-react';
import type { Expense } from '@/components/ExpenseTable';

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .order('value', { ascending: false });
    setItems((data || []) as Expense[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const stats = useMemo(() => {
    const income = items.filter(i => i.type === 'income');
    const expense = items.filter(i => i.type !== 'income');

    const annualise = (i: Expense) => i.frequency === 'annual' ? i.value : i.value * 12;
    const monthlyOf = (i: Expense) => i.frequency === 'annual' ? i.value / 12 : i.value;

    const totalAnnualExpense = expense.reduce((s, i) => s + annualise(i), 0);
    const totalAnnualIncome = income.reduce((s, i) => s + annualise(i), 0);
    const totalMonthlyExpense = expense.reduce((s, i) => s + monthlyOf(i), 0);
    const totalMonthlyIncome = income.reduce((s, i) => s + monthlyOf(i), 0);

    return { totalAnnualExpense, totalAnnualIncome, totalMonthlyExpense, totalMonthlyIncome, income, expense };
  }, [items]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Assinaturas & Recorrentes</h1>
              <p className="text-sm text-muted-foreground mt-1">Todas as transações marcadas como recorrentes</p>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border-0 shadow-md bg-destructive text-destructive-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium opacity-80">Saídas / mês</p>
                    <p className="text-xl font-bold">{formatCurrency(stats.totalMonthlyExpense)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-green-600 text-white">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium opacity-80">Entradas / mês</p>
                    <p className="text-xl font-bold">{formatCurrency(stats.totalMonthlyIncome)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-foreground/10 flex items-center justify-center"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium opacity-80">Custo anual (saídas)</p>
                    <p className="text-xl font-bold">{formatCurrency(stats.totalAnnualExpense)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium opacity-80">Receita anual</p>
                    <p className="text-xl font-bold">{formatCurrency(stats.totalAnnualIncome)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* List */}
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando...</p>
            ) : items.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Repeat className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhuma transação recorrente</p>
                  <p className="text-sm mt-1">Marque transações como recorrentes ao criá-las.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(item => {
                  const isIncome = item.type === 'income';
                  const annualValue = item.frequency === 'annual' ? item.value : item.value * 12;
                  const monthlyValue = item.frequency === 'annual' ? item.value / 12 : item.value;

                  return (
                    <Card key={item.id} className="rounded-2xl hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-green-100 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
                              {isIncome ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{item.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {item.frequency === 'annual' ? 'Anual' : 'Mensal'}
                                </Badge>
                                <Badge variant={isIncome ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                  {isIncome ? 'Receita' : 'Despesa'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-lg font-bold ${isIncome ? 'text-green-600' : 'text-destructive'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(item.value)}
                              <span className="text-[10px] font-normal text-muted-foreground">/{item.frequency === 'annual' ? 'ano' : 'mês'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ≈ {formatCurrency(annualValue)}/ano
                            </p>
                            {item.frequency === 'annual' && (
                              <p className="text-xs text-muted-foreground">
                                ≈ {formatCurrency(monthlyValue)}/mês
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
