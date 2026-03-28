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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Download, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Loader2, Repeat, ArrowUpCircle, ArrowDownCircle, CalendarClock, Wallet } from 'lucide-react';
import { CATEGORIES, getCategoryInfo, formatCurrency, formatDate } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import type { Expense } from '@/components/ExpenseTable';

interface ExpenseWithStatus {
  id: string;
  date: string;
  description: string;
  value: number;
  category_ai: string | null;
  final_category: string;
  created_at: string;
  status: 'correct' | 'corrected' | 'manual';
}

const PAGE_SIZE = 15;

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: 'all', category: 'all' });
  const [allExpenses, setAllExpenses] = useState<ExpenseWithStatus[]>([]);

  // Subscriptions state
  const [subItems, setSubItems] = useState<Expense[]>([]);
  const [subLoading, setSubLoading] = useState(true);

  const classifyExpense = (e: { category_ai: string | null; final_category: string }): 'correct' | 'corrected' | 'manual' => {
    if (!e.category_ai) return 'manual';
    return e.category_ai === e.final_category ? 'correct' : 'corrected';
  };

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let allQuery = supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', startDate).lt('date', endDate)
      .order('date', { ascending: false });
    const { data: allData } = await allQuery;
    const all = (allData || []).map(e => ({ ...e, status: classifyExpense(e) }));
    setAllExpenses(all);

    let filtered = all;
    if (filters.status !== 'all') filtered = filtered.filter(e => e.status === filters.status);
    if (filters.category !== 'all') filtered = filtered.filter(e => e.final_category === filters.category);
    if (search.trim()) filtered = filtered.filter(e => e.description.toLowerCase().includes(search.toLowerCase()));

    setTotalCount(filtered.length);
    const start = (page - 1) * PAGE_SIZE;
    setExpenses(filtered.slice(start, start + PAGE_SIZE));
    setLoading(false);
  }, [user, page, filters, search, startDate, endDate]);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .order('value', { ascending: false });
    setSubItems((data || []) as Expense[]);
    setSubLoading(false);
  }, [user]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const analytics = useMemo(() => {
    const total = allExpenses.length;
    const withAi = allExpenses.filter(e => e.category_ai);
    const correct = withAi.filter(e => e.status === 'correct').length;
    const corrected = withAi.filter(e => e.status === 'corrected').length;
    const accuracy = withAi.length ? Math.round(correct / withAi.length * 100) : 0;

    const byCat: Record<string, { correct: number; total: number }> = {};
    withAi.forEach(e => {
      if (!byCat[e.final_category]) byCat[e.final_category] = { correct: 0, total: 0 };
      byCat[e.final_category].total++;
      if (e.status === 'correct') byCat[e.final_category].correct++;
    });
    const accuracyByCategory = Object.entries(byCat).map(([cat, data]) => ({
      name: getCategoryInfo(cat).label,
      accuracy: Math.round(data.correct / data.total * 100),
      total: data.total,
    })).sort((a, b) => a.accuracy - b.accuracy);

    const correctionsByCat: Record<string, number> = {};
    allExpenses.filter(e => e.status === 'corrected').forEach(e => {
      correctionsByCat[e.final_category] = (correctionsByCat[e.final_category] || 0) + 1;
    });
    const topCorrections = Object.entries(correctionsByCat)
      .map(([cat, count]) => ({ name: getCategoryInfo(cat).label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total, accuracy, correct, corrected, manual: total - withAi.length, accuracyByCategory, topCorrections };
  }, [allExpenses]);

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

  const exportCSV = () => {
    const headers = 'Data,Descrição,Valor,Categoria IA,Categoria Final,Status\n';
    const rows = allExpenses.map(e =>
      `${e.date},"${e.description}",${e.value},${e.category_ai || ''},${e.final_category},${e.status}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'historico-despesas.csv'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!', description: 'O arquivo foi baixado com sucesso.' });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const chartConfig = {
    accuracy: { label: 'Precisão', color: 'hsl(var(--ai))' },
    count: { label: 'Correções', color: 'hsl(var(--pink))' },
  };

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Lançamentos, assinaturas e análise IA</p>
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
                    <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                      <SelectTrigger className="w-[120px] sm:w-[160px] rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos status</SelectItem>
                        <SelectItem value="correct">✅ IA correta</SelectItem>
                        <SelectItem value="corrected">⚠️ Corrigida</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                      <SelectTrigger className="w-[120px] sm:w-[160px] rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas categorias</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* History Table */}
                {/* Mobile card view */}
                <div className="md:hidden space-y-2">
                  {loading ? (
                    <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
                  ) : expenses.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</p>
                  ) : expenses.map(exp => {
                    const finalInfo = getCategoryInfo(exp.final_category);
                    return (
                      <Card key={exp.id} className="rounded-xl">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{exp.description}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">{formatDate(exp.date)}</span>
                                <Badge variant={finalInfo.variant} className="text-[10px] px-1.5 py-0">{finalInfo.label}</Badge>
                                {exp.status === 'correct' && <span className="text-xs">✅</span>}
                                {exp.status === 'corrected' && <span className="text-xs">⚠️</span>}
                                {exp.status === 'manual' && <span className="text-xs">✏️</span>}
                              </div>
                            </div>
                            <span className="text-sm font-bold shrink-0">{formatCurrency(exp.value)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block rounded-2xl border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="font-semibold">Descrição</TableHead>
                        <TableHead className="text-right font-semibold">Valor</TableHead>
                        <TableHead className="font-semibold">Cat. Original (IA)</TableHead>
                        <TableHead className="font-semibold">Cat. Final</TableHead>
                        <TableHead className="font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : expenses.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : expenses.map(exp => {
                        const origInfo = exp.category_ai ? getCategoryInfo(exp.category_ai) : null;
                        const finalInfo = getCategoryInfo(exp.final_category);
                        return (
                          <TableRow key={exp.id}>
                            <TableCell className="font-medium">{formatDate(exp.date)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{exp.description}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(exp.value)}</TableCell>
                            <TableCell>{origInfo ? <Badge variant={origInfo.variant}>{origInfo.label}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                            <TableCell><Badge variant={finalInfo.variant}>{finalInfo.label}</Badge></TableCell>
                            <TableCell className="text-center">
                              {exp.status === 'correct' && <Tooltip><TooltipTrigger><span className="text-lg">✅</span></TooltipTrigger><TooltipContent>IA categorizou corretamente</TooltipContent></Tooltip>}
                              {exp.status === 'corrected' && <Tooltip><TooltipTrigger><span className="text-lg">⚠️</span></TooltipTrigger><TooltipContent>Corrigida pelo usuário</TooltipContent></Tooltip>}
                              {exp.status === 'manual' && <Tooltip><TooltipTrigger><span className="text-lg">✏️</span></TooltipTrigger><TooltipContent>Categorizada manualmente</TooltipContent></Tooltip>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-muted-foreground">Página {page} de {totalPages} ({totalCount})</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl"><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ════════ TAB: Assinaturas Fixas ════════ */}
              <TabsContent value="subscriptions" className="space-y-6">
                {/* Summary cards */}
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

                {/* Subscriptions List */}
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
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
