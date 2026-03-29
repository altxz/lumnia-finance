import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';

interface Props {
  expenses: any[];
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function WeekComparisonChart({ expenses }: Props) {
  const data = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Start of current week (Sunday)
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dayOfWeek);
    thisWeekStart.setHours(0, 0, 0, 0);
    // Start of last week
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeek: Record<number, number> = {};
    const lastWeek: Record<number, number> = {};

    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer' || e.credit_card_id) return;
      const d = new Date(e.date + 'T12:00:00');
      if (d >= thisWeekStart) {
        thisWeek[d.getDay()] = (thisWeek[d.getDay()] || 0) + e.value;
      } else if (d >= lastWeekStart && d < thisWeekStart) {
        lastWeek[d.getDay()] = (lastWeek[d.getDay()] || 0) + e.value;
      }
    });

    return DAYS.map((name, i) => ({
      name,
      atual: thisWeek[i] || 0,
      anterior: lastWeek[i] || 0,
    }));
  }, [expenses]);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Semana Atual vs Anterior</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={45} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="atual" name="Esta semana" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="anterior" name="Semana passada" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
