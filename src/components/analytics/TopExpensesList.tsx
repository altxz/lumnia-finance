import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

const BAR_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--success))',
  'hsl(var(--accent))',
  'hsl(var(--chart-5))',
];

export function TopExpensesList({ expenses }: { expenses: any[] }) {
  const data = useMemo(() => {
    const validExpenses = expenses.filter(e => e.type === 'expense' && !isBalanceAdjustment(e));
    const sorted = [...validExpenses].sort((a, b) => b.value - a.value).slice(0, 5);
    return sorted.map(e => ({
      name: e.description || 'Sem descrição',
      value: e.value,
    }));
  }, [expenses]);

  const maxValue = useMemo(() => data.reduce((max, d) => Math.max(max, d.value), 0), [data]);

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
      <CardContent className="flex-1 min-h-0 pb-4 px-4 flex flex-col justify-center gap-3">
        {data.map((item, index) => {
          const color = BAR_COLORS[index % BAR_COLORS.length];
          const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 4) : 0;
          return (
            <div key={`${item.name}-${index}`} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={item.name}>
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {item.name}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatCurrency(item.value)}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    backgroundImage: `linear-gradient(90deg, ${color.replace(')', ' / 0.65)')}, ${color})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
