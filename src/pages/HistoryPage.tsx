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
import { Search, Download, ArrowUpCircle, ArrowDownCircle, CalendarClock, Repeat, TriangleAlert, WifiOff } from 'lucide-react';
import { CATEGORIES, formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { TransactionFeed } from '@/components/TransactionFeed';
import { TransactionSummaryHeader } from '@/components/TransactionSummaryHeader';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import type { Expense } from '@/components/ExpenseTable';
import { useCategories } from '@/hooks/useStaticData';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { StatePanel } from '@/components/ui/state-panel';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { StaggerItem } from '@/components/ui/stagger';



export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const projected = useProjectedTotals();
  const { data: categories = [] } = useCategories();
  const isOnline = useOnlineStatus();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => ({
    category: searchParams.get('category') || 'all',
    type: searchParams.get('type') || 'all',
  }));

  // Subscriptions state
  const [subItems, setSubItems] = useState<Expense[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    setSubError(null);
    try {
      const { data, error } = await supabase
        .from('expenses').select('id, description, value, date, type, final_category, is_recurring, frequency, is_paid, wallet_id, credit_card_id').eq('user_id', user.id)
        .eq('is_recurring', true).order('value', { ascending: false });
      if (error) throw error;
      setSubItems((data || []) as Expense[]);
    } catch (error) {
      setSubError(error instanceof Error ? error.message : 'Não foi possível carregar as recorrências.');
    } finally {
      setSubLoading(false);
    }
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

  const hasActiveFilters = search.trim().length > 0 || filters.category !== 'all' || filters.type !== 'all';
  const invoiceDisplayFilter = useCallback((expense: Expense) => {
    if (filters.type !== 'all' && expense.type !== filters.type) return false;
    if (filters.category !== 'all' && expense.final_category !== filters.category) return false;
    if (search.trim() && !expense.description.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }, [filters.category, filters.type, search]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters({ category: 'all', type: 'all' });
  }, []);

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

  if (authLoading) return <PageLoadingSkeleton title="Carregando transações" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 overflow-auto bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 space-y-7 sm:space-y-8">
              {!isOnline && <OfflineBanner />}

              {projected.error && (
                <StatePanel
                  tone="error"
                  icon={<TriangleAlert className="h-5 w-5" />}
                  title="Não foi possível atualizar as transações"
                  description="Os dados exibidos podem estar desatualizados. Tente novamente quando a conexão estiver estável."
                  actionLabel="Tentar novamente"
                  onAction={projected.refetch}
                  className="min-h-0 rounded-3xl py-6"
                />
              )}

              <StaggerItem index={0}>
                <header className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-primary">Atividade</p>
                    <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-foreground">
                      Movimentações do mês
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground">
                      Consulte, encontre e ajuste cada lançamento em um único lugar.
                    </p>
                  </div>
                  <MonthSelector />
                  <TransactionSummaryHeader
                    totalIncome={projected.totalIncome}
                    totalExpense={projected.totalExpense}
                    projectedBalance={projected.projectedBalance}
                    loading={projected.loading}
                  />
                </header>
              </StaggerItem>

            <StaggerItem index={1}>
            <section className="surface-card p-4 sm:p-6 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Transações</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Extrato completo do período</p>
                  </div>
                  <Button
                    onClick={exportCSV}
                    variant="ghost"
                    size="icon"
                    aria-label="Exportar CSV"
                    className="h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Download className="h-4.5 w-4.5" />
                  </Button>
                </div>

                <Tabs defaultValue="entries" className="w-full">
                  <TabsList className="w-full rounded-2xl bg-muted p-1 h-auto">
                    <TabsTrigger value="entries" className="flex-1 text-sm rounded-xl py-2.5">Lançamentos</TabsTrigger>
                    <TabsTrigger value="subscriptions" className="flex-1 text-sm rounded-xl py-2.5">Recorrentes</TabsTrigger>
                  </TabsList>

                  {/* ════════ TAB: Lançamentos ════════ */}
                  <TabsContent value="entries" className="space-y-5 mt-5">
                    {/* Filtros como chips */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={e => { setSearch(e.target.value); }}
                          placeholder="Buscar por descrição"
                          className="pl-10 rounded-2xl h-11 text-sm bg-muted/50 border-border"
                        />
                      </div>
                      <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                        <SelectTrigger className="w-full h-11 rounded-2xl text-sm bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Categorias</SelectItem>
                          {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
                        <SelectTrigger className="w-full h-11 rounded-2xl text-sm bg-muted/50 border-border"><SelectValue /></SelectTrigger>

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
                      categories={categories}
                      invoiceDisplayFilter={hasActiveFilters ? invoiceDisplayFilter : undefined}
                      emptyTitle={hasActiveFilters ? 'Nenhum resultado para estes filtros' : 'Nenhuma transação neste período'}
                      emptyDescription={hasActiveFilters
                        ? 'Ajuste a busca, categoria ou tipo para ampliar os resultados.'
                        : 'Os lançamentos aparecerão aqui quando forem registrados.'}
                      onClearFilters={hasActiveFilters ? clearFilters : undefined}
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
                    ) : subError ? (
                      <StatePanel
                        tone={isOnline ? 'error' : 'offline'}
                        icon={isOnline ? <TriangleAlert className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                        title={isOnline ? 'Não foi possível carregar as recorrências' : 'Recorrências indisponíveis offline'}
                        description={isOnline ? 'Tente novamente para recuperar seus lançamentos recorrentes.' : 'Reconecte-se para atualizar esta lista.'}
                        actionLabel="Tentar novamente"
                        onAction={fetchSubscriptions}
                        className="min-h-52 border-0 bg-transparent shadow-none"
                      />
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
            </section>
            </StaggerItem>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

