import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Download, ArrowUpCircle, ArrowDownCircle, CalendarClock, Repeat } from 'lucide-react';
import { CATEGORIES, formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { TransactionFeed } from '@/components/TransactionFeed';
import { TransactionSummaryHeader } from '@/components/TransactionSummaryHeader';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import type { Expense } from '@/components/ExpenseTable';



export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const projected = useProjectedTotals();


  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => ({
    category: searchParams.get('category') || 'all',
    type: searchParams.get('type') || 'all',
  }));

  // Subscriptions state
  const [subItems, setSubItems] = useState<Expense[]>([]);
  const [subLoading, setSubLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    const { data } = await supabase
      .from('expenses').select('id, description, value, date, type, final_category, is_recurring, frequency, is_paid, wallet_id, credit_card_id').eq('user_id', user.id)
      .eq('is_recurring', true).order('value', { ascending: false });
    setSubItems((data || []) as Expense[]);
    setSubLoading(false);
  }, [user]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const filteredExpenses = useMemo(() => {
    let result = projected.monthExpenses;
    if (filters.type !== 'all') result = result.filter(e => e.type === filters.type);
    if (filters.category !== 'all') result = result.filter(e => e.final_category === filters.category);
    if (search.trim()) result = result.filter(e => e.description.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [projected.monthExpenses, filters, search]);

  const exportCSV = () => {
    const headers = 'Data,Descrição,Valor,Tipo,Categoria\n';
    const rows = projected.monthExpenses.map(e =>
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
          <main className="flex-1 overflow-auto relative">
            {/* Brand glows */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-[110px]" />
              <div className="absolute top-40 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-[110px]" />
            </div>

            {/* Topo leve: mês + resumo */}
            <div className="relative z-10 px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4">
              <MonthSelector />
              <div className="mx-auto w-full max-w-5xl">
                <TransactionSummaryHeader
                  totalIncome={projected.totalIncome}
                  totalExpense={projected.totalExpense}
                  projectedBalance={projected.projectedBalance}
                />
              </div>
            </div>

            {/* Painel de vidro deslizante */}
            <section className="relative z-10 mt-5 sm:mt-7 glass-panel rounded-t-[32px] px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-32">
              <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Transações</h1>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Extrato completo de lançamentos</p>
                  </div>
                  <Button
                    onClick={exportCSV}
                    variant="ghost"
                    size="icon"
                    aria-label="Exportar CSV"
                    className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Download className="h-4.5 w-4.5" />
                  </Button>
                </div>

                <Tabs defaultValue="entries" className="w-full">
                  <TabsList className="w-full max-w-sm rounded-2xl bg-muted/50 p-1 h-auto">
                    <TabsTrigger value="entries" className="flex-1 text-xs sm:text-sm rounded-xl py-2">Lançamentos</TabsTrigger>
                    <TabsTrigger value="subscriptions" className="flex-1 text-xs sm:text-sm rounded-xl py-2">Assinaturas</TabsTrigger>
                  </TabsList>

                  {/* ════════ TAB: Lançamentos ════════ */}
                  <TabsContent value="entries" className="space-y-5 mt-5">
                    {/* Filtros como chips */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="relative flex-1 min-w-[160px] sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={e => { setSearch(e.target.value); }}
                          placeholder="Buscar..."
                          className="pl-9 rounded-full h-9 text-xs sm:text-sm bg-muted/40 border-border/60"
                        />
                      </div>
                      <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                        <SelectTrigger className="w-[142px] sm:w-[170px] h-9 rounded-full text-[11px] sm:text-sm bg-muted/40 border-border/60"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Categorias</SelectItem>
                          {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
                        <SelectTrigger className="w-[128px] sm:w-[150px] h-9 rounded-full text-[11px] sm:text-sm bg-muted/40 border-border/60"><SelectValue /></SelectTrigger>

                        <SelectContent>
                          <SelectItem value="all">Todos tipos</SelectItem>
                          <SelectItem value="income">Receitas</SelectItem>
                          <SelectItem value="expense">Despesas</SelectItem>
                          <SelectItem value="transfer">Transferências</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Transaction Feed grouped by day */}
                    <TransactionFeed
                      expenses={filteredExpenses}
                      allExpenses={projected.monthExpenses}
                      invoiceExpenses={projected.invoiceExpenses}
                      loading={projected.loading}
                      onDeleted={projected.refetch}
                      filters={{ category: filters.category }}
                      onFilterChange={() => {}}
                      wallets={projected.wallets}
                      investmentWalletIds={projected.investmentWalletIds}
                      startingMonthBalance={projected.startingBalance}
                      creditCards={projected.creditCards}
                      currentMonth={startDate}
                    />

                    {/* Saldo do mês anterior */}
                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">Saldo do mês anterior</p>
                          <p className="text-[11px] text-muted-foreground">Como você iniciou este mês</p>
                        </div>
                      </div>
                      <span className={`text-sm sm:text-base font-bold tabular-nums shrink-0 ${projected.startingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {formatCurrency(projected.startingBalance)}
                      </span>
                    </div>
                  </TabsContent>

                  {/* ════════ TAB: Assinaturas Fixas ════════ */}
                  <TabsContent value="subscriptions" className="space-y-5 mt-5">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
                      {[
                        { label: 'Saídas / mês', value: subStats.totalMonthlyExpense, tone: 'text-destructive' },
                        { label: 'Entradas / mês', value: subStats.totalMonthlyIncome, tone: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Custo anual', value: subStats.totalAnnualExpense, tone: 'text-destructive' },
                        { label: 'Receita anual', value: subStats.totalAnnualIncome, tone: 'text-primary' },
                      ].map(card => (
                        <div key={card.label} className="glass-soft rounded-2xl px-3 py-3 sm:px-4 sm:py-4 min-w-0">
                          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">{card.label}</p>
                          <p className={`mt-1 text-sm sm:text-lg font-bold tabular-nums truncate ${card.tone}`}>{formatCurrency(card.value)}</p>
                        </div>
                      ))}
                    </div>

                    {subLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-2xl bg-muted/50 animate-pulse" />)}
                      </div>
                    ) : subItems.length === 0 ? (
                      <div className="py-14 text-center text-muted-foreground">
                        <Repeat className="h-9 w-9 mx-auto mb-3 opacity-40" />
                        <p className="font-medium text-foreground">Nenhuma transação recorrente</p>
                        <p className="text-sm mt-1">Marque transações como recorrentes ao criá-las.</p>
                      </div>
                    ) : (
                      <div className="hairline rounded-2xl overflow-hidden">
                        {subItems.map(item => {
                          const isIncome = item.type === 'income';
                          const annualValue = item.frequency === 'annual' ? item.value : item.value * 12;
                          return (
                            <div key={item.id} className="flex items-center gap-3 py-3 px-1 sm:px-2 transition-colors hover:bg-muted/40">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${isIncome ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                                {isIncome
                                  ? <ArrowUpCircle className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                                  : <ArrowDownCircle className="h-4.5 w-4.5 text-destructive" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {item.frequency === 'annual' ? 'Anual' : 'Mensal'} • {isIncome ? 'Receita' : 'Despesa'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                  {isIncome ? '+' : '-'}{formatCurrency(item.value)}
                                </p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">≈ {formatCurrency(annualValue)}/ano</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </section>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

