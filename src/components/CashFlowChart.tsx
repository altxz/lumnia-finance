import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { addDays, format, startOfDay, eachDayOfInterval, isBefore, isAfter, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

type TimeFilter = 'month' | '7days' | '30days';

interface DayData {
  label: string;
  dateStr: string;
  receitas: number;
  despesas: number;
  saldo: number;
  projected?: boolean;
}

export function CashFlowChart() {
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [wallets, setWallets] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [unpaidCreditExpenses, setUnpaidCreditExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = startOfDay(new Date());

  // Compute date range based on filter
  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    if (timeFilter === '7days') {
      return { rangeStart: addDays(now, -7), rangeEnd: addDays(now, 7) };
    }
    if (timeFilter === '30days') {
      return { rangeStart: now, rangeEnd: addDays(now, 30) };
    }
    // 'month' — current calendar month
    const y = now.getFullYear();
    const m = now.getMonth();
    return { rangeStart: new Date(y, m, 1), rangeEnd: new Date(y, m + 1, 0) };
  }, [timeFilter]);

  const rangeStartStr = format(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchAll = async () => {
      const [walletsRes, expensesRes, recurringRes, cardsRes, unpaidRes] = await Promise.all([
        supabase.from('wallets').select('initial_balance').eq('user_id', user.id),
        // All user expenses (we need history before range for running balance)
        supabase.from('expenses').select('*').eq('user_id', user.id).order('date'),
        supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_recurring', true),
        supabase.from('credit_cards').select('id, name, due_day').eq('user_id', user.id),
        supabase.from('expenses').select('value, credit_card_id, invoice_month')
          .eq('user_id', user.id).eq('is_paid', false).not('credit_card_id', 'is', null),
      ]);

      setWallets(walletsRes.data || []);
      setAllExpenses(expensesRes.data || []);
      setRecurringExpenses(recurringRes.data || []);
      setCreditCards(cardsRes.data || []);
      setUnpaidCreditExpenses(unpaidRes.data || []);
      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const chartData = useMemo(() => {
    // 1) Base balance from wallets
    const walletsBase = wallets.reduce((s, w) => s + Number(w.initial_balance || 0), 0);

    // 2) Compute running balance up to rangeStart from all real transactions
    let preRangeBalance = walletsBase;
    const txByDate: Record<string, { income: number; expense: number }> = {};

    allExpenses.forEach(e => {
      if (e.type === 'transfer') return;
      const dStr = e.date;
      if (dStr < rangeStartStr) {
        // Before range: accumulate into pre-range balance
        if (e.type === 'income' && e.is_paid) preRangeBalance += Number(e.value);
        else if (e.type === 'expense' && e.is_paid && !e.credit_card_id) preRangeBalance -= Number(e.value);
      } else if (dStr <= rangeEndStr) {
        if (!txByDate[dStr]) txByDate[dStr] = { income: 0, expense: 0 };
        if (e.type === 'income') txByDate[dStr].income += Number(e.value);
        else if (!e.credit_card_id) txByDate[dStr].expense += Number(e.value);
      }
    });

    // 3) Build projected data for future days
    const projByDate: Record<string, { income: number; expense: number }> = {};
    const todayStr = format(today, 'yyyy-MM-dd');

    // Recurring projections
    recurringExpenses.forEach(r => {
      if (r.type === 'transfer') return;
      const origDay = parseISO(r.date).getDate();
      // Project into each month in range
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const monthsSeen = new Set<string>();
      days.forEach(d => {
        const mk = format(d, 'yyyy-MM');
        if (monthsSeen.has(mk)) return;
        monthsSeen.add(mk);
        const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const clampedDay = Math.min(origDay, daysInM);
        const projDate = new Date(d.getFullYear(), d.getMonth(), clampedDay);
        const projStr = format(projDate, 'yyyy-MM-dd');
        if (projStr <= todayStr || projStr < rangeStartStr || projStr > rangeEndStr) return;
        if (!projByDate[projStr]) projByDate[projStr] = { income: 0, expense: 0 };
        if (r.type === 'income') projByDate[projStr].income += Number(r.value);
        else if (!r.credit_card_id) projByDate[projStr].expense += Number(r.value);
      });
    });

    // Credit card bill projections
    const billByCard: Record<string, number> = {};
    unpaidCreditExpenses.forEach(e => {
      if (e.credit_card_id) {
        billByCard[e.credit_card_id] = (billByCard[e.credit_card_id] || 0) + Number(e.value);
      }
    });
    creditCards.forEach(card => {
      const bill = billByCard[card.id];
      if (!bill || bill <= 0) return;
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const monthsSeen = new Set<string>();
      days.forEach(d => {
        const mk = format(d, 'yyyy-MM');
        if (monthsSeen.has(mk)) return;
        monthsSeen.add(mk);
        const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const dueDay = Math.min(card.due_day || 10, daysInM);
        const dueDate = new Date(d.getFullYear(), d.getMonth(), dueDay);
        const dueStr = format(dueDate, 'yyyy-MM-dd');
        if (dueStr <= todayStr || dueStr < rangeStartStr || dueStr > rangeEndStr) return;
        if (!projByDate[dueStr]) projByDate[dueStr] = { income: 0, expense: 0 };
        projByDate[dueStr].expense += bill;
      });
    });

    // 4) Build day-by-day chart
    const daysList = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    let runningBalance = preRangeBalance;
    const result: DayData[] = [];

    daysList.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      const isFuture = isAfter(d, today);
      const real = txByDate[dStr] || { income: 0, expense: 0 };
      const proj = isFuture ? (projByDate[dStr] || { income: 0, expense: 0 }) : { income: 0, expense: 0 };

      const dayIncome = real.income + proj.income;
      const dayExpense = real.expense + proj.expense;
      runningBalance += dayIncome - dayExpense;

      result.push({
        label: format(d, 'dd/MM'),
        dateStr: dStr,
        receitas: dayIncome,
        despesas: dayExpense,
        saldo: runningBalance,
        projected: isFuture,
      });
    });

    return result;
  }, [wallets, allExpenses, recurringExpenses, unpaidCreditExpenses, creditCards, rangeStartStr, rangeEndStr, today]);

  const lastPoint = chartData[chartData.length - 1];
  const firstPoint = chartData[0];
  const endBalance = lastPoint?.saldo || 0;
  const startBalance = firstPoint?.saldo || 0;
  const balanceChange = endBalance - startBalance;
  const todayStr = format(today, 'dd/MM');

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="h-[320px] flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Carregando gráfico...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Fluxo de Caixa</CardTitle>
          <div className="flex items-center gap-2 sm:gap-3">
            <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="h-8 w-[130px] sm:w-[160px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="7days">7 dias (±7)</SelectItem>
                <SelectItem value="30days">Próximos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              {balanceChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-xs sm:text-sm font-bold ${balanceChange >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {balanceChange >= 0 ? '+' : ''}{formatCurrency(balanceChange)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Receitas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Despesas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Saldo
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
             <XAxis
               dataKey="label"
               tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
               axisLine={false}
               tickLine={false}
               interval={tickInterval}
             />
             <YAxis
               yAxisId="bars"
               tickFormatter={(v) => {
                 if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                 return `R$${v.toFixed(0)}`;
               }}
               tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
               axisLine={false}
               tickLine={false}
               width={40}
               orientation="left"
             />
             <YAxis
               yAxisId="line"
               tickFormatter={(v) => {
                 if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                 return `R$${v.toFixed(0)}`;
               }}
               tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
               axisLine={false}
               tickLine={false}
               width={40}
               orientation="right"
               domain={['auto', 'auto']}
             />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as DayData;
                return (
                  <div className="rounded-lg border bg-background p-2.5 text-xs shadow-lg">
                    <p className="font-semibold mb-1.5">
                      {label} {point?.projected && <span className="text-muted-foreground">(projeção)</span>}
                    </p>
                    <p className="text-emerald-500">Entradas: +{formatCurrency(point?.receitas || 0)}</p>
                    <p className="text-destructive">Saídas: -{formatCurrency(point?.despesas || 0)}</p>
                    <hr className="my-1.5 border-border" />
                    <p className={`font-bold ${(point?.saldo || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      Saldo: {formatCurrency(point?.saldo || 0)}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              yAxisId="bars"
              x={todayStr}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Bar yAxisId="bars" dataKey="receitas" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} barSize={8} opacity={0.85} />
            <Bar yAxisId="bars" dataKey="despesas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} barSize={8} opacity={0.85} />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="saldo"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
