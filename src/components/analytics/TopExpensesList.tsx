import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142, 71%, 45%)', 'hsl(var(--accent))', 'hsl(280, 60%, 55%)'];

export function TopExpensesList({ expenses }: { expenses: any[] }) {
  const data = useMemo(() => {
    const validExpenses = expenses.filter(e => e.type === 'expense');
    const sorted = [...validExpenses].sort((a, b) => b.value - a.value).slice(0, 5);
    return sorted.map(e => ({
      name: e.description || 'Sem descrição',
      value: e.value,
    }));
  }, [expenses]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Maiores Compras</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Maiores Compras</CardTitle>
          <InfoPopover><p>As 5 transações individuais mais caras do período selecionado.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
             <XAxis type="number" tickFormatter={(v: number) => { if (v >= 1000) return `R$${(v/1000).toFixed(0)}k`; return `R$${v.toFixed(0)}`; }} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
             <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <p className="text-xs font-medium">{payload[0].payload.name}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(payload[0].value as number)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
