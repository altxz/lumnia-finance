import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { buildDailyBalanceMap, transferCashDelta } from '@/lib/projectedBalanceMath';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import { format, startOfDay } from 'date-fns';
import { InfoPopover } from '@/components/ui/info-popover';
import { useIsMobile } from '@/hooks/use-mobile';


type TimeFilter = 'month' | 'past15' | 'next15';

interface DayData {
  label: string;
  dateStr: string;
  receitas: number;
  despesas: number;
  saldo: number;
  projected?: boolean;
}

interface CashFlowChartProps {
  creditCards?: any[];
  wallets?: { id: string; name: string; initial_balance: number; asset_type?: string }[];
}

export function CashFlowChart(_props: CashFlowChartProps = {}) {
  const { selectedMonth, selectedYear, startDate, isCurrentMonth } = useSelectedDate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  const {
    monthExpenses,
    invoiceExpenses,
    creditCards,
    startingBalance,
    projectedBalance,
    investmentWalletIds,
    loading,
  } = useProjectedTotals();

  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const lastDay = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

  // Curva do mês inteiro, com o MESMO motor da página de Transações.
  const fullMonthData = useMemo(() => {
    const invIds = new Set(investmentWalletIds);

    const { balanceMap, invoiceTotalByDay } = buildDailyBalanceMap({
      monthExpenses,
      invoiceExpenses,
      creditCards,
      startDate,
      endDate: lastDay,
      startingBalance,
      isCreditCardPayment: (expense) => isTrackedCreditCardPayment(expense, creditCards),
      investmentWalletIds,
    });

    // Barras: entradas e saídas por dia, seguindo as mesmas regras de caixa.
    const incomeByDay: Record<string, number> = {};
    const expenseByDay: Record<string, number> = {};

    monthExpenses.forEach((e: any) => {
      if (e.credit_card_id) return;
      if (!e.date || e.date < startDate || e.date > lastDay) return;

      if (e.type === 'transfer') {
        const delta = transferCashDelta(e, invIds);
        if (!delta) return;
        if (delta > 0) incomeByDay[e.date] = (incomeByDay[e.date] || 0) + delta;
        else expenseByDay[e.date] = (expenseByDay[e.date] || 0) - delta;
        return;
      }

      if (isTrackedCreditCardPayment(e, creditCards)) return;

      const value = Number(e.value) || 0;
      if (e.type === 'income') incomeByDay[e.date] = (incomeByDay[e.date] || 0) + value;
      else expenseByDay[e.date] = (expenseByDay[e.date] || 0) + value;
    });

    // Pagamento da fatura entra como saída no dia do vencimento.
    Object.entries(invoiceTotalByDay).forEach(([day, total]) => {
      if (!total) return;
      expenseByDay[day] = (expenseByDay[day] || 0) + total;
    });

    const points: DayData[] = [];
    let running = startingBalance;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (balanceMap[dateStr] !== undefined) running = balanceMap[dateStr];
      points.push({
        label: `${String(d).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}`,
        dateStr,
        receitas: Math.round((incomeByDay[dateStr] || 0) * 100) / 100,
        despesas: Math.round((expenseByDay[dateStr] || 0) * 100) / 100,
        saldo: Math.round(running * 100) / 100,
        projected: dateStr > todayStr,
      });
    }
    return points;
  }, [monthExpenses, invoiceExpenses, creditCards, startingBalance, startDate, lastDay, monthKey, daysInMonth, selectedMonth, investmentWalletIds, todayStr]);

  const chartData = useMemo(() => {
    if (timeFilter === 'month' || !isCurrentMonth) return fullMonthData;
    const todayIndex = fullMonthData.findIndex(p => p.dateStr === todayStr);
    if (todayIndex < 0) return fullMonthData;
    if (timeFilter === 'past15') return fullMonthData.slice(Math.max(0, todayIndex - 14), todayIndex + 1);
    return fullMonthData.slice(todayIndex, Math.min(fullMonthData.length, todayIndex + 15));
  }, [fullMonthData, timeFilter, isCurrentMonth, todayStr]);

  const lastPoint = chartData[chartData.length - 1];
  const firstPoint = chartData[0];
  const endBalance = timeFilter === 'month' ? projectedBalance : (lastPoint?.saldo ?? 0);
  const baseBalance = timeFilter === 'month' ? startingBalance : (firstPoint?.saldo ?? 0);
  const balanceChange = endBalance - baseBalance;
  const todayLabel = format(today, 'dd/MM');

  const isMobile = useIsMobile();
  const tickInterval = Math.max(1, Math.floor(chartData.length / (isMobile ? 5 : 8)));


  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="h-[320px] flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Carregando gráfico...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Fluxo de Caixa</CardTitle>
            <InfoPopover><p>Saldo dia a dia do mês selecionado com o mesmo cálculo da página de Transações: receitas, despesas em débito (pagas e pendentes), recorrências projetadas e o pagamento das faturas no vencimento.</p></InfoPopover>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="h-8 w-[130px] sm:w-[160px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês completo</SelectItem>
                <SelectItem value="past15">Últimos 15 dias</SelectItem>
                <SelectItem value="next15">Próximos 15 dias</SelectItem>
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
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Receitas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Despesas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Saldo
          </span>
          <span>Saldo previsto: <strong className={endBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}>{formatCurrency(endBalance)}</strong></span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4 px-2 sm:px-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: isMobile ? 0 : 10, left: 0, bottom: 0 }}>
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
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(0)}`)}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 28 : 40}
              orientation="left"
            />
            <YAxis
              yAxisId="line"
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(0)}`)}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 28 : 40}
              orientation="right"
              domain={['auto', 'auto']}
            />

            <Tooltip
              cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as DayData;
                return (
                  <div className="rounded-lg border bg-background p-2.5 text-xs shadow-float">
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
            {isCurrentMonth && (
              <ReferenceLine
                yAxisId="bars"
                x={todayLabel}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
            )}
            <Bar yAxisId="bars" dataKey="receitas" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} barSize={8} opacity={0.85} />
            <Bar yAxisId="bars" dataKey="despesas" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} barSize={8} opacity={0.85} />
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
