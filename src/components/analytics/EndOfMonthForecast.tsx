import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { InfoPopover } from '@/components/ui/info-popover';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import { buildDailyBalanceMap } from '@/lib/projectedBalanceMath';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';

interface EndOfMonthForecastProps {
  creditCards?: any[];
  wallets?: { initial_balance: number }[];
}

export function EndOfMonthForecast(_props: EndOfMonthForecastProps = {}) {
  const { selectedMonth, selectedYear, startDate, endDate, isCurrentMonth } = useSelectedDate();
  const {
    monthExpenses,
    invoiceExpenses,
    creditCards,
    startingBalance,
    projectedBalance,
  } = useProjectedTotals();

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const todayDay = isCurrentMonth ? new Date().getDate() : null;

  const chartData = useMemo(() => {
    const lastDay = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const { balanceMap } = buildDailyBalanceMap({
      monthExpenses,
      invoiceExpenses,
      creditCards,
      startDate,
      endDate: lastDay,
      startingBalance,
      isCreditCardPayment: (expense) => isTrackedCreditCardPayment(expense, creditCards),
    });

    const points: { day: number; saldo: number }[] = [];
    let running = startingBalance;

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (balanceMap[key] !== undefined) running = balanceMap[key];
      points.push({ day: d, saldo: Math.round(running * 100) / 100 });
    }

    return points;
  }, [monthExpenses, invoiceExpenses, creditCards, startingBalance, startDate, endDate, selectedMonth, selectedYear, daysInMonth]);

  const endBalance = projectedBalance;
  const todayPoint = todayDay ? chartData.find(p => p.day === todayDay) : undefined;

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">Previsão Fim de Mês</CardTitle>
            <InfoPopover><p>Projeção diária do saldo usando o mesmo cálculo da página de Transações: receitas, despesas em débito (pagas e pendentes), recorrências e o pagamento das faturas no vencimento.</p></InfoPopover>
          </div>
          <span className={`text-sm font-bold shrink-0 ${endBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{formatCurrency(endBalance)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Dia ${l}`} />
            {todayPoint && (
              <ReferenceDot x={todayPoint.day} y={todayPoint.saldo} r={5} fill="hsl(var(--primary))" stroke="none" />
            )}
            <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
