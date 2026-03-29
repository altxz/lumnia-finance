import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import type { Expense } from '@/components/ExpenseTable';
import { InfoPopover } from '@/components/ui/info-popover';

interface BurndownChartProps {
  expenses: Expense[];
  totalBudget: number;
}

export function BurndownChart({ expenses, totalBudget }: BurndownChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    // Daily spend map
    const dailySpend: Record<number, number> = {};
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (e.credit_card_id) return;
      const d = new Date(e.date + 'T12:00:00');
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        dailySpend[day] = (dailySpend[day] || 0) + e.value;
      }
    });

    const budget = totalBudget > 0 ? totalBudget : 1;
    let cumSpent = 0;

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const ideal = budget - (budget / daysInMonth) * i;
      cumSpent += dailySpend[day] || 0;
      const real = day <= today ? budget - cumSpent : undefined;

      return { day, ideal: Math.max(ideal, 0), real: real != null ? Math.max(real, 0) : undefined };
    });
  }, [expenses, totalBudget]);

  if (totalBudget <= 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Burndown de Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4">
          <p className="text-sm text-muted-foreground py-8 text-center">
            Configure um orçamento para visualizar o burndown.
          </p>
        </CardContent>
      </Card>
    );
  }

  const lastReal = chartData.filter(d => d.real !== undefined).at(-1);
  const lastIdeal = lastReal ? chartData.find(d => d.day === lastReal.day)?.ideal ?? 0 : 0;
  const isAbove = lastReal ? (lastReal.real ?? 0) >= lastIdeal : true;

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Burndown de Orçamento</CardTitle>
          <InfoPopover><p>Mostra a velocidade com que você está consumindo seu orçamento geral do mês comparado à linha ideal.</p></InfoPopover>
        </div>
        <p className="text-xs text-muted-foreground">
          {isAbove ? '✅ Ritmo de gastos dentro da meta' : '⚠️ Gastos acima do ritmo ideal'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              width={45}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ideal = payload.find(p => p.dataKey === 'ideal')?.value as number | undefined;
                const real = payload.find(p => p.dataKey === 'real')?.value as number | undefined;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
                    <p className="font-semibold text-popover-foreground">Dia {label}</p>
                    {ideal != null && (
                      <p className="text-muted-foreground">Meta: {formatCurrency(ideal)}</p>
                    )}
                    {real != null && (
                      <p className={real >= (ideal ?? 0) ? 'text-emerald-500' : 'text-destructive'}>
                        Real: {formatCurrency(real)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} className="stroke-border" />
            <Line
              dataKey="ideal"
              name="Meta"
              strokeDasharray="5 5"
              className="stroke-muted-foreground"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              dataKey="real"
              name="Real"
              stroke={isAbove ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
