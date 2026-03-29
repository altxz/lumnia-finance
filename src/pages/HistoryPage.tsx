import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Download, ArrowUpCircle, ArrowDownCircle, CalendarClock, Wallet, Repeat } from 'lucide-react';
import { CATEGORIES, formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { TransactionFeed } from '@/components/TransactionFeed';
import { TransactionSummaryHeader } from '@/components/TransactionSummaryHeader';
import type { Expense } from '@/components/ExpenseTable';

const PAGE_SIZE = 30;

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => ({
    category: searchParams.get('category') || 'all',
    type: searchParams.get('type') || 'all',
  }));

  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [startingMonthBalance, setStartingMonthBalance] = useState(0);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);

  // Subscriptions state
  const [subItems, setSubItems] = useState<Expense[]>([]);
  const [subLoading, setSubLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', startDate).lt('date', endDate)
      .order('date', { ascending: false });
    setAllExpenses((data || []) as Expense[]);
    setLoading(false);
  }, [user, startDate, endDate]);

  const fetchWalletsAndBalance = useCallback(async () => {
    if (!user) return;
    const { data: walletsData } = await supabase
      .from('wallets').select('id, name, initial_balance').eq('user_id', user.id).order('name');
    const wList = walletsData || [];
    setWallets(wList.map(w => ({ id: w.id, name: w.name })));

    const walletsTotal = wList.reduce((s, w: any) => s + (w.initial_balance || 0), 0);
    const { data: allTxns } = await supabase
      .from('expenses').select('value, type, credit_card_id, date')
      .eq('user_id', user.id).eq('is_paid', true);

    let priorBalance = walletsTotal;
    (allTxns || []).forEach((t: any) => {
      if (t.type === 'transfer') return;
      if (t.date >= startDate) return;
      if (t.type === 'income') priorBalance += t.value;
      else if (!t.credit_card_id) priorBalance -= t.value;
    });
    setStartingMonthBalance(priorBalance);
  }, [user, startDate]);

  const fetchCreditCards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('credit_cards').select('*').eq('user_id', user.id);
    setCreditCards((data || []) as CreditCardType[]);
  }, [user]);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    const { data } = await supabase
      .from('expenses').select('*').eq('user_id', user.id)
      .eq('is_recurring', true).order('value', { ascending: false });
    setSubItems((data || []) as Expense[]);
    setSubLoading(false);
  }, [user]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchWalletsAndBalance(); }, [fetchWalletsAndBalance]);
  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);
  useEffect(() => { fetchCreditCards(); }, [fetchCreditCards]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Apply filters
  const filteredExpenses = useMemo(() => {
    let result = allExpenses;
    if (filters.type !== 'all') result = result.filter(e => e.type === filters.type);
    if (filters.category !== 'all') result = result.filter(e => e.final_category === filters.category);
    if (search.trim()) result = result.filter(e => e.description.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [allExpenses, filters, search]);

  const totalPages = Math.ceil(filteredExpenses.length / PAGE_SIZE);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = 'Data,Descrição,Valor,Tipo,Categoria\n';
    const rows = allExpenses.map(e =>
      `${e.date},"${e.description}",${e.value},${e.type},${e.final_category}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transacoes.csv'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!', description: 'O arquivo foi baixado com sucesso.' });
  };

  const subStats = useMemo(() => {
    const income = subItems.filter(i => i.type === 'income');
    const expense = subItems.filter(i => i.type !== 'income');
    const annualise = (i: Expense) => i.frequency === 'annual' ? i.value : i.value * 12;
    const monthlyOf = (i: Expense) => i.frequency === 'annual' ? i.value / 12 : i.value;
    return {
      totalAnnualExpense: expense.reduce((s, i) => s + annualise(i), 0),
      totalAnnualIncome: income.reduce((s, i) => s + annualise(i), 0),
      totalMonthlyExpense: expense.reduce((s, i) => s + monthlyOf(i), 0),
      totalMonthlyIncome: income.reduce((s, i) => s + monthlyOf(i), 0),
    };
  }, [subItems]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            <MonthSelector />
            <TransactionSummaryHeader expenses={allExpenses} startingMonthBalance={startingMonthBalance} />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Extrato completo de lançamentos</p>
              </div>
              <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2 rounded-xl self-start sm:self-auto">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            <Tabs defaultValue="entries" className="w-full">
              <TabsList className="w-full max-w-md">
                <TabsTrigger value="entries" className="flex-1 text-xs sm:text-sm">Lançamentos</TabsTrigger>
                <TabsTrigger value="subscriptions" className="flex-1 text-xs sm:text-sm">Assinaturas Fixas</TabsTrigger>
              </TabsList>

              {/* ════════ TAB: Lançamentos ════════ */}
              <TabsContent value="entries" className="space-y-4 sm:space-y-6">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center">
                  <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar..." className="pl-9 rounded-xl h-10 text-sm" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                      <SelectTrigger className="w-[120px] sm:w-[160px] rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas categorias</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
                      <SelectTrigger className="w-[120px] sm:w-[160px] rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos tipos</SelectItem>
                        <SelectItem value="income">📈 Receitas</SelectItem>
                        <SelectItem value="expense">📉 Despesas</SelectItem>
                        <SelectItem value="transfer">🔄 Transferências</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Transaction Feed grouped by day */}
                <TransactionFeed
                  expenses={paginatedExpenses}
                  allExpenses={filteredExpenses}
                  loading={loading}
                  onDeleted={fetchExpenses}
                  filters={{ category: filters.category }}
                  onFilterChange={() => {}}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  wallets={wallets}
                  startingMonthBalance={startingMonthBalance}
                  creditCards={creditCards}
                  currentMonth={startDate}
                />
              </TabsContent>

              {/* ════════ TAB: Assinaturas Fixas ════════ */}
              <TabsContent value="subscriptions" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="rounded-2xl border-0 shadow-md bg-destructive text-destructive-foreground">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5" /></div>
                      <div><p className="text-xs font-medium opacity-80">Saídas / mês</p><p className="text-xl font-bold">{formatCurrency(subStats.totalMonthlyExpense)}</p></div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-md bg-green-600 text-white">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5" /></div>
                      <div><p className="text-xs font-medium opacity-80">Entradas / mês</p><p className="text-xl font-bold">{formatCurrency(subStats.totalMonthlyIncome)}</p></div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-foreground/10 flex items-center justify-center"><CalendarClock className="h-5 w-5" /></div>
                      <div><p className="text-xs font-medium opacity-80">Custo anual (saídas)</p><p className="text-xl font-bold">{formatCurrency(subStats.totalAnnualExpense)}</p></div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
                      <div><p className="text-xs font-medium opacity-80">Receita anual</p><p className="text-xl font-bold">{formatCurrency(subStats.totalAnnualIncome)}</p></div>
                    </CardContent>
                  </Card>
                </div>

                {subLoading ? (
                  <p className="text-muted-foreground text-center py-12">Carregando...</p>
                ) : subItems.length === 0 ? (
                  <Card className="rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Repeat className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">Nenhuma transação recorrente</p>
                      <p className="text-sm mt-1">Marque transações como recorrentes ao criá-las.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {subItems.map(item => {
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
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.frequency === 'annual' ? 'Anual' : 'Mensal'}</Badge>
                                    <Badge variant={isIncome ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{isIncome ? 'Receita' : 'Despesa'}</Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-lg font-bold ${isIncome ? 'text-green-600' : 'text-destructive'}`}>
                                  {isIncome ? '+' : '-'}{formatCurrency(item.value)}
                                  <span className="text-[10px] font-normal text-muted-foreground">/{item.frequency === 'annual' ? 'ano' : 'mês'}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">≈ {formatCurrency(annualValue)}/ano</p>
                                {item.frequency === 'annual' && <p className="text-xs text-muted-foreground">≈ {formatCurrency(monthlyValue)}/mês</p>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Saldo do mês anterior */}
            <Card className="rounded-2xl border-0 shadow-md p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Saldo do mês anterior</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Como você iniciou este mês</p>
                  </div>
                </div>
                <span className={`text-lg sm:text-xl font-bold ${startingMonthBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {startingMonthBalance >= 0 ? '+' : ''}{formatCurrency(startingMonthBalance)}
                </span>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
