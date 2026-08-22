import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonthSelector } from '@/components/MonthSelector';
import {
  ArrowLeft,
  Loader2,
  Tag,
  TrendingDown,
  TrendingUp,
  ArrowDownUp,
  Pencil,
  Calendar as CalendarIcon,
  Receipt,
  Repeat,
  Wallet as WalletIcon,
  CreditCard,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { icons } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, LineChart, Line, CartesianGrid } from 'recharts';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
}

interface Expense {
  id: string;
  description: string;
  date: string;
  value: number;
  type: 'expense' | 'income' | 'transfer';
  final_category: string;
  is_paid: boolean;
  credit_card_id: string | null;
  is_recurring: boolean;
  wallet_id: string | null;
  payment_method: string | null;
  project_id: string | null;
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const IconComp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComp) return <Tag className={className} />;
  return <IconComp className={className} />;
}

export default function CategoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, label, selectedMonth, selectedYear } = useSelectedDate();
  const selectedDate = useMemo(() => new Date(selectedYear, selectedMonth, 1), [selectedYear, selectedMonth]);
  const navigate = useNavigate();

  const [category, setCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);

    const { data: cat } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!cat) { setLoading(false); return; }
    setCategory(cat as Category);

    // Parent category info (if this is a subcategory)
    if (cat.parent_id) {
      const { data: p } = await supabase
        .from('categories')
        .select('id, name, icon, color, parent_id')
        .eq('id', cat.parent_id)
        .maybeSingle();
      setParentCategory((p as Category) || null);
    } else {
      setParentCategory(null);
    }

    // Subcategories so we can also include their transactions
    const { data: subs } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('user_id', user.id)
      .eq('parent_id', cat.id);
    setSubCategories((subs || []) as Category[]);

    const namesToMatch = [cat.name, ...(subs || []).map(s => s.name)];
    const lowered = namesToMatch.map(n => n.toLowerCase());
    const allNames = Array.from(new Set([...namesToMatch, ...lowered]));

    const select = 'id, description, date, value, type, final_category, is_paid, credit_card_id, is_recurring, wallet_id, payment_method, project_id';

    // Current period
    const { data: exps } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .in('final_category', allNames)
      .order('date', { ascending: false });

    // Previous period (same month, last year-month)
    const prevStart = format(startOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd');
    const prevEnd = format(endOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd');
    const { data: prevExps } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', prevStart)
      .lte('date', prevEnd)
      .in('final_category', allNames);

    // Last 6 months trend
    const sixMonthsAgoStart = format(startOfMonth(subMonths(selectedDate, 5)), 'yyyy-MM-dd');
    const trendEnd = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    const { data: trendExps } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user.id)
      .gte('date', sixMonthsAgoStart)
      .lte('date', trendEnd)
      .in('final_category', allNames);

    const dedupedCurrent = hideMaterializedRecurringTemplates((exps || []) as Expense[]);
    const dedupedPrev = hideMaterializedRecurringTemplates((prevExps || []) as Expense[]);
    const dedupedTrend = hideMaterializedRecurringTemplates((trendExps || []) as Expense[]);

    setExpenses(dedupedCurrent);
    setPreviousExpenses(dedupedPrev);

    // Build trend by month
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(selectedDate, i);
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM', { locale: ptBR }), total: 0 });
    }
    dedupedTrend.forEach(e => {
      if (e.type === 'transfer') return;
      const monthKey = e.date.slice(0, 7);
      const m = months.find(x => x.key === monthKey);
      if (m) m.total += Number(e.value);
    });
    setTrendData(months.map(m => ({ month: m.label, total: m.total })));

    setLoading(false);
  }, [user, id, startDate, endDate, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, paid = 0, pending = 0, recurringCount = 0;
    expenses.forEach(e => {
      if (e.type === 'income') income += Number(e.value);
      else if (e.type !== 'transfer') {
        expense += Number(e.value);
        if (e.is_paid) paid += Number(e.value);
        else pending += Number(e.value);
      }
      if (e.is_recurring) recurringCount += 1;
    });
    const net = income - expense;
    const count = expenses.length;
    const avgTicket = expense > 0 && count > 0 ? expense / count : 0;
    return { income, expense, paid, pending, net, count, recurringCount, avgTicket };
  }, [expenses]);

  // Monthly comparison
  const previousExpense = useMemo(() => {
    return previousExpenses.reduce((s, e) => e.type === 'expense' ? s + Number(e.value) : s, 0);
  }, [previousExpenses]);

  const variation = useMemo(() => {
    if (previousExpense === 0) return null;
    return ((totals.expense - previousExpense) / previousExpense) * 100;
  }, [totals.expense, previousExpense]);

  // Group by sub-category for the breakdown panel
  const breakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type === 'transfer') return;
      const key = e.final_category;
      map[key] = (map[key] || 0) + Number(e.value);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Top 5 largest transactions
  const topTransactions = useMemo(() => {
    return [...expenses]
      .filter(e => e.type !== 'transfer')
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 5);
  }, [expenses]);

  // Daily distribution chart
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    return days.map(d => {
      const total = expenses
        .filter(e => e.type === 'expense' && isSameDay(parseISO(e.date), d))
        .reduce((s, e) => s + Number(e.value), 0);
      return { day: format(d, 'dd'), total };
    });
  }, [expenses, selectedDate]);

  // Day of week distribution
  const weekdayStats = useMemo(() => {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach(e => {
      if (e.type !== 'expense') return;
      const dow = parseISO(e.date).getDay();
      totals[dow] += Number(e.value);
    });
    const max = Math.max(...totals);
    const peakIdx = totals.indexOf(max);
    return { totals, dayNames, peakDay: max > 0 ? dayNames[peakIdx] : '—', peakValue: max };
  }, [expenses]);

  // Average expense day-of-month
  const heaviestDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    const peak = dailyData.reduce((a, b) => b.total > a.total ? b : a, dailyData[0]);
    return peak.total > 0 ? peak : null;
  }, [dailyData]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const accent = category?.color || 'hsl(var(--primary))';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/categorias')} className="rounded-xl h-10 w-10 shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {category ? (
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent + '20' }}
                    >
                      <LucideIcon name={category.icon || 'tag'} className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">{category.name}</h1>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {parentCategory && (
                          <Badge variant="secondary" className="rounded-lg text-[10px] px-1.5 py-0 max-w-[140px] truncate">
                            ↳ {parentCategory.name}
                          </Badge>
                        )}
                        {subCategories.length > 0 && (
                          <Badge variant="outline" className="rounded-lg text-[10px] px-1.5 py-0">{subCategories.length} subs</Badge>
                        )}
                        <p className="text-[10px] sm:text-xs text-muted-foreground capitalize truncate">{label}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Categoria</h1>
                )}
              </div>
              <div className="flex justify-center sm:justify-end">
                <MonthSelector />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Hero KPI banner */}
                <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
                  <CardContent
                    className="p-4 sm:p-6 lg:p-8 relative"
                    style={{ background: `linear-gradient(135deg, ${accent}15, ${accent}05)` }}
                  >
                    <div className="grid gap-4 sm:gap-6 md:grid-cols-3 items-center">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total gasto no período</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1 break-words" style={{ color: accent }}>
                          {formatCurrency(totals.expense)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {variation === null ? (
                            <Badge variant="secondary" className="rounded-lg text-xs">
                              <Minus className="h-3 w-3 mr-1" /> Sem dados anteriores
                            </Badge>
                          ) : variation > 0 ? (
                            <Badge variant="secondary" className="rounded-lg text-xs bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                              <ArrowUpRight className="h-3 w-3 mr-1" /> +{variation.toFixed(1)}% vs mês anterior
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-lg text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                              <ArrowDownRight className="h-3 w-3 mr-1" /> {variation.toFixed(1)}% vs mês anterior
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Ticket médio</p>
                          <p className="text-xl font-bold">{formatCurrency(totals.avgTicket)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Lançamentos</p>
                          <p className="text-xl font-bold">{totals.count}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <p className="text-xs text-muted-foreground flex-1">Pago</p>
                          <p className="text-sm font-semibold">{formatCurrency(totals.paid)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <p className="text-xs text-muted-foreground flex-1">Pendente</p>
                          <p className="text-sm font-semibold">{formatCurrency(totals.pending)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Repeat className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground flex-1">Recorrentes</p>
                          <p className="text-sm font-semibold">{totals.recurringCount}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Indicadores secundários */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Entradas</p>
                        <p className="text-base font-bold truncate">{formatCurrency(totals.income)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Saídas</p>
                        <p className="text-base font-bold truncate">{formatCurrency(totals.expense)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <CalendarIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Maior dia</p>
                        <p className="text-base font-bold truncate">
                          {heaviestDay ? `Dia ${heaviestDay.day}` : '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {heaviestDay ? formatCurrency(heaviestDay.total) : 'Sem gastos'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center shrink-0">
                        <ArrowDownUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Dia + ativo</p>
                        <p className="text-base font-bold truncate">{weekdayStats.peakDay}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {weekdayStats.peakValue > 0 ? formatCurrency(weekdayStats.peakValue) : '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts row */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Trend last 6 months */}
                  <Card className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Evolução · últimos 6 meses</h2>
                        <Badge variant="secondary" className="rounded-lg text-[10px]">Saídas</Badge>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => formatCurrency(Number(v))} domain={[0, 'auto']} />
                            <RTooltip
                              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                              formatter={(v: number) => [formatCurrency(v), 'Total']}
                            />
                            <Line type="monotone" dataKey="total" stroke={accent} strokeWidth={3} dot={{ fill: accent, r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Daily distribution */}
                  <Card className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Gastos por dia do mês</h2>
                        <Badge variant="secondary" className="rounded-lg text-[10px]">{format(selectedDate, 'MMM', { locale: ptBR })}</Badge>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => formatCurrency(Number(v))} domain={[0, 'auto']} />
                            <RTooltip
                              contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                              formatter={(v: number) => [formatCurrency(v), 'Gasto']}
                              labelFormatter={(l) => `Dia ${l}`}
                            />
                            <Bar dataKey="total" fill={accent} radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Breakdown by subcategory */}
                {subCategories.length > 0 && breakdown.length > 0 && (
                  <Card className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Distribuição por subcategoria</h2>
                        <Badge variant="outline" className="rounded-lg text-[10px]">{breakdown.length} grupos</Badge>
                      </div>
                      <div className="space-y-2.5">
                        {breakdown.map(([name, value]) => {
                          const pct = totals.expense + totals.income > 0
                            ? (value / (totals.expense + totals.income)) * 100
                            : 0;
                          const sub = subCategories.find(s => s.name.toLowerCase() === name.toLowerCase());
                          return (
                            <button
                              type="button"
                              key={name}
                              onClick={() => sub && navigate(`/categorias/${sub.id}`)}
                              className={`w-full text-left space-y-1 p-2 rounded-xl transition-colors ${sub ? 'hover:bg-secondary/60 cursor-pointer' : ''}`}
                              disabled={!sub}
                            >
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="font-medium capitalize truncate flex-1">{name}</span>
                                <span className="text-muted-foreground shrink-0">{formatCurrency(value)} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: sub?.color || accent }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top 5 transactions */}
                {topTransactions.length > 0 && (
                  <Card className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <h2 className="text-sm font-semibold">Top 5 maiores lançamentos</h2>
                      </div>
                      <ul className="space-y-2">
                        {topTransactions.map((e, idx) => (
                          <li
                            key={e.id}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer"
                            onClick={() => navigate(`/historico?expense=${e.id}`)}
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: accent + '20', color: accent }}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{e.description}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {format(parseISO(e.date), "dd 'de' MMM", { locale: ptBR })} · {e.final_category}
                              </p>
                            </div>
                            <p className="text-sm font-bold shrink-0" style={{ color: accent }}>{formatCurrency(Number(e.value))}</p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Transactions list */}
                <Card className="rounded-2xl border-0 shadow-md">
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Lançamentos do período</h2>
                      <Badge variant="secondary" className="rounded-lg text-[10px]">{expenses.length}</Badge>
                    </div>
                    {expenses.length === 0 ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        Nenhum lançamento nesta categoria no período selecionado.
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {expenses.map(e => {
                          const isIncome = e.type === 'income';
                          const sign = isIncome ? '+' : '-';
                          return (
                            <li key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isIncome
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              }`}>
                                {e.credit_card_id ? <CreditCard className="h-4 w-4" /> : isIncome ? <TrendingUp className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{e.description}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(e.date), "dd 'de' MMM", { locale: ptBR })}
                                  </p>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                    {e.final_category}
                                  </Badge>
                                  {e.is_recurring && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                                      <Repeat className="h-2.5 w-2.5" /> Recorrente
                                    </Badge>
                                  )}
                                  {!e.is_paid && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">Pendente</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {sign} {formatCurrency(Number(e.value))}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl shrink-0"
                                onClick={() => navigate(`/historico?expense=${e.id}`)}
                                aria-label="Abrir lançamento"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
