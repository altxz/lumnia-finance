import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--success))', 'hsl(var(--accent))', 'hsl(var(--chart-5))'];

export function TopExpensesList({ expenses }: { expenses: any[] }) {
  const data = useMemo(() => {
    const validExpenses = expenses.filter(e => e.type === 'expense' && !isBalanceAdjustment(e));
    const sorted = [...validExpenses].sort((a, b) => b.value - a.value).slice(0, 5);
    return sorted.map(e => ({
      name: (e.description || 'Sem descrição').length > 18
        ? (e.description || 'Sem descrição').slice(0, 16) + '…'
        : (e.description || 'Sem descrição'),
      fullName: e.description || 'Sem descrição',
      value: e.value,
    }));
  }, [expenses]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Maiores Compras</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Maiores Compras</CardTitle>
          <InfoPopover><p>As 5 transações individuais mais caras do período selecionado.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 68, left: 0, bottom: 2 }}>
            <defs>
              {COLORS.map((color, i) => (
                <linearGradient key={i} id={`topExpGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              type="number"
              tickFormatter={(v: number) => { if (v >= 1000) return `R$${(v/1000).toFixed(0)}k`; return `R$${v.toFixed(0)}`; }}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={58}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', textAnchor: 'start' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="glass-soft rounded-xl p-2.5 text-popover-foreground shadow-float">
                    <p className="text-xs font-medium">{payload[0].payload.fullName}</p>
                    <p className="text-sm font-bold" style={{ color: 'hsl(var(--primary))' }}>{formatCurrency(payload[0].value as number)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={32}>
              {data.map((_entry, index) => (
                <Cell key={index} fill={`url(#topExpGrad${index % COLORS.length})`} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number) => formatCurrency(v)}
                style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
