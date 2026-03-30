import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { InfoPopover } from '@/components/ui/info-popover';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg border border-white/10" style={{ background: 'rgba(30,30,40,0.92)' }}>
      <p className="text-xs text-white/70 mb-1">Dia {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color || '#fff' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

interface Props {
  expenses: any[];
}

export function DailySpendingChart({ expenses }: Props) {
  const { selectedMonth, selectedYear } = useSelectedDate();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const data = useMemo(() => {
    const byDay: Record<number, number> = {};

    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      const d = new Date(e.date + 'T12:00:00');
      if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;
      const day = d.getDate();
      byDay[day] = (byDay[day] || 0) + e.value;
    });

    const points: { day: number; gasto: number; media: number }[] = [];
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      total += byDay[d] || 0;
      points.push({ day: d, gasto: byDay[d] || 0, media: Math.round((total / d) * 100) / 100 });
    }
    return points;
  }, [expenses, daysInMonth, selectedMonth, selectedYear]);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Média Diária de Gastos</CardTitle>
          <InfoPopover><p>Seu ritmo de gasto dia a dia, baseado na data em que cada despesa foi realizada.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradDailySpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradDailyAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="gasto" name="Gasto" stroke="hsl(210, 80%, 55%)" strokeWidth={1.5} fill="url(#gradDailySpend)" dot={false} />
            <Area type="monotone" dataKey="media" name="Média" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradDailyAvg)" dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
