import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';

interface DayData {
  day: number;
  label: string;
  receitas: number;
  despesas: number;
  saldo: number;
  projected?: boolean;
}

export function CashFlowChart() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear, startDate, endDate } = useSelectedDate();
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchAll = async () => {
      // Fetch all expenses for the selected month (no pagination)
      const { data: monthData } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date');

      // Fetch recurring transactions for projection
      const { data: recurring } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', true);

      setAllExpenses(monthData || []);
      setRecurringExpenses(recurring || []);
      setLoading(false);
    };

    fetchAll();
  }, [user, startDate, endDate]);

  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
  const isFutureMonth = new Date(selectedYear, selectedMonth) > new Date(today.getFullYear(), today.getMonth());
  const todayDay = isCurrentMonth ? today.getDate() : 0;

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const chartData = useMemo(() => {
    const days: DayData[] = [];
    let cumulativeIncome = 0;
    let cumulativeExpense = 0;

    // Build a map of actual transactions by day
    const incomeByDay: Record<number, number> = {};
    const expenseByDay: Record<number, number> = {};

    allExpenses.forEach(e => {
      if (e.type === 'transfer') return;
      const d = new Date(e.date + 'T12:00:00').getDate();
      if (e.type === 'income') {
        incomeByDay[d] = (incomeByDay[d] || 0) + e.value;
      } else if (!e.credit_card_id) {
        expenseByDay[d] = (expenseByDay[d] || 0) + e.value;
      }
    });

    // Build projected recurring amounts for future/remaining days
    const projIncomeByDay: Record<number, number> = {};
    const projExpenseByDay: Record<number, number> = {};

    if (isFutureMonth || isCurrentMonth) {
      recurringExpenses.forEach(r => {
        if (r.type === 'transfer') return;
        // Use the original transaction day as the recurring day
        const recurDay = new Date(r.date + 'T12:00:00').getDate();
        const clampedDay = Math.min(recurDay, daysInMonth);

        // Only project if: future month entirely, or current month but day hasn't passed
        const shouldProject = isFutureMonth || (isCurrentMonth && clampedDay > todayDay);
        // Don't project if there's already a real transaction on that day from the same recurring pattern
        if (!shouldProject) return;

        if (r.type === 'income') {
          projIncomeByDay[clampedDay] = (projIncomeByDay[clampedDay] || 0) + r.value;
        } else if (!r.credit_card_id) {
          projExpenseByDay[clampedDay] = (projExpenseByDay[clampedDay] || 0) + r.value;
        }
      });
    }

    const lastRealDay = isFutureMonth ? 0 : (isCurrentMonth ? todayDay : daysInMonth);

    for (let d = 1; d <= daysInMonth; d++) {
      const isProjected = d > lastRealDay;
      const dayIncome = (incomeByDay[d] || 0) + (isProjected ? (projIncomeByDay[d] || 0) : 0);
      const dayExpense = (expenseByDay[d] || 0) + (isProjected ? (projExpenseByDay[d] || 0) : 0);

      cumulativeIncome += dayIncome;
      cumulativeExpense += dayExpense;

      days.push({
        day: d,
        label: String(d),
        receitas: cumulativeIncome,
        despesas: cumulativeExpense,
        saldo: cumulativeIncome - cumulativeExpense,
        projected: isProjected,
      });
    }

    return days;
  }, [allExpenses, recurringExpenses, daysInMonth, isCurrentMonth, isFutureMonth, todayDay]);

  const lastPoint = chartData[chartData.length - 1];
  const endBalance = lastPoint?.saldo || 0;

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
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Fluxo de Caixa Diário</CardTitle>
          <div className="flex items-center gap-1.5">
            {endBalance >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className={`text-sm font-bold ${endBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {formatCurrency(endBalance)}
            </span>
            {(isFutureMonth || isCurrentMonth) && (
              <span className="text-[10px] text-muted-foreground ml-1">(com projeção)</span>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Receitas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Despesas
          </span>
          {(isFutureMonth || isCurrentMonth) && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" /> Projeção
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={Math.floor(daysInMonth / 8)}
            />
            <YAxis
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as DayData;
                return (
                  <div className="rounded-lg border bg-background p-2.5 text-xs shadow-lg">
                    <p className="font-semibold mb-1">
                      Dia {label} {point?.projected && <span className="text-muted-foreground">(projeção)</span>}
                    </p>
                    <p className="text-emerald-500">Receitas: {formatCurrency(point?.receitas || 0)}</p>
                    <p className="text-destructive">Despesas: {formatCurrency(point?.despesas || 0)}</p>
                    <p className={`font-bold mt-1 ${(point?.saldo || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      Saldo: {formatCurrency(point?.saldo || 0)}
                    </p>
                  </div>
                );
              }}
            />
            {isCurrentMonth && todayDay > 0 && (
              <ReferenceLine
                x={String(todayDay)}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="receitas"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              fill="url(#gradIncome)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="despesas"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              fill="url(#gradExpense)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
