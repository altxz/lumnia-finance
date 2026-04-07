import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import type { Expense } from '@/components/ExpenseTable';
import { InfoPopover } from '@/components/ui/info-popover';

interface WaterfallChartProps {
  expenses: Expense[];
  startingBalance: number;
}

interface WaterfallItem {
  name: string;
  base: number;
  value: number;
  amount: number;
  fill: string;
  type: 'start' | 'income' | 'expense' | 'end';
}

function resolveCategoryName(cat: string): string {
  const info = getCategoryInfo(cat);
  // If it fell back to 'Outros' but the original isn't 'outros', format the raw string
  if (info.value === 'outros' && cat.toLowerCase() !== 'outros') {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  return info.label;
}

export function WaterfallChart({ expenses, startingBalance }: WaterfallChartProps) {
  const data = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const totalIncome = nonTransfers
      .filter(e => e.type === 'income')
      .reduce((s, e) => s + e.value, 0);

    // Top 5 expense categories
    const byCat: Record<string, number> = {};
    nonTransfers
      .filter(e => e.type === 'expense' && !e.credit_card_id && !e.description?.startsWith('Pagamento fatura'))
      .forEach(e => {
        byCat[e.final_category] = (byCat[e.final_category] || 0) + e.value;
      });

    const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const top5 = sortedCats.slice(0, 5);
    const otherTotal = sortedCats.slice(5).reduce((s, [, v]) => s + v, 0);
    const totalExpense = sortedCats.reduce((s, [, v]) => s + v, 0);
    const endBalance = startingBalance + totalIncome - totalExpense;

    const items: WaterfallItem[] = [];

    items.push({
      name: 'Saldo Inicial',
      base: 0,
      value: Math.abs(startingBalance),
      amount: startingBalance,
      fill: 'hsl(var(--primary))',
      type: 'start',
    });

    let cursor = startingBalance;
    items.push({
      name: 'Receitas',
      base: Math.min(cursor, cursor + totalIncome),
      value: totalIncome,
      amount: totalIncome,
      fill: 'hsl(142, 71%, 45%)',
      type: 'income',
    });
    cursor += totalIncome;

    top5.forEach(([cat, val]) => {
      cursor -= val;
      items.push({
        name: resolveCategoryName(cat),
        base: cursor,
        value: val,
        amount: -val,
        fill: 'hsl(var(--destructive))',
        type: 'expense',
      });
    });

    if (otherTotal > 0) {
      cursor -= otherTotal;
      items.push({
        name: 'Outras',
        base: cursor,
        value: otherTotal,
        amount: -otherTotal,
        fill: 'hsl(var(--destructive))',
        type: 'expense',
      });
    }

    items.push({
      name: 'Saldo Final',
      base: 0,
      value: Math.abs(endBalance),
      amount: endBalance,
      fill: endBalance >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
      type: 'end',
    });

    return items;
  }, [expenses, startingBalance]);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Cascata do Mês</CardTitle>
          <InfoPopover><p>Explica visualmente como o seu saldo inicial se transformou no saldo atual, barra a barra.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                return `R$${v.toFixed(0)}`;
              }}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as WaterfallItem;
                return (
                  <div className="rounded-xl border-0 p-2.5 text-xs shadow-lg" style={{ backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff' }}>
                    <p className="font-semibold mb-1">{item.name}</p>
                    <p style={{
                      color: item.type === 'income' ? 'hsl(142, 71%, 45%)' :
                        item.type === 'expense' ? 'hsl(0, 84%, 60%)' :
                        'hsl(var(--primary))'
                    }}>
                      {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={0} />
            <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} opacity={entry.type === 'expense' ? 0.85 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
