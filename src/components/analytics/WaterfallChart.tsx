import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import type { Expense } from '@/components/ExpenseTable';

interface WaterfallChartProps {
  expenses: Expense[];
  startingBalance: number;
}

interface WaterfallItem {
  name: string;
  /** invisible base to stack on top of */
  base: number;
  /** visible bar value (always positive for rendering) */
  value: number;
  /** actual signed amount for tooltip */
  amount: number;
  fill: string;
  type: 'start' | 'income' | 'expense' | 'end';
}

export function WaterfallChart({ expenses, startingBalance }: WaterfallChartProps) {
  const data = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const totalIncome = nonTransfers
      .filter(e => e.type === 'income')
      .reduce((s, e) => s + e.value, 0);

    // Top 3 expense categories
    const byCat: Record<string, number> = {};
    nonTransfers
      .filter(e => e.type === 'expense' && !e.credit_card_id)
      .forEach(e => {
        byCat[e.final_category] = (byCat[e.final_category] || 0) + e.value;
      });

    const sortedCats = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1]);
    const top3 = sortedCats.slice(0, 3);
    const otherTotal = sortedCats.slice(3).reduce((s, [, v]) => s + v, 0);

    const totalExpense = sortedCats.reduce((s, [, v]) => s + v, 0);
    const endBalance = startingBalance + totalIncome - totalExpense;

    const items: WaterfallItem[] = [];

    // 1) Starting balance
    items.push({
      name: 'Saldo Inicial',
      base: 0,
      value: Math.abs(startingBalance),
      amount: startingBalance,
      fill: 'hsl(var(--primary))',
      type: 'start',
    });

    // 2) Income (rises from starting balance)
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

    // 3) Top 3 expense categories (descending)
    top3.forEach(([cat, val]) => {
      cursor -= val;
      items.push({
        name: getCategoryInfo(cat).label,
        base: cursor,
        value: val,
        amount: -val,
        fill: 'hsl(var(--destructive))',
        type: 'expense',
      });
    });

    // 4) Other expenses
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

    // 5) End balance
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
    <Card className="rounded-2xl border-0 shadow-md col-span-1 md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Cascata do Mês</CardTitle>
        <p className="text-xs text-muted-foreground">Como o saldo inicial se transformou no saldo final</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                return `R$${v.toFixed(0)}`;
              }}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as WaterfallItem;
                return (
                  <div className="rounded-lg border bg-background p-2.5 text-xs shadow-lg">
                    <p className="font-semibold mb-1">{item.name}</p>
                    <p className={
                      item.type === 'income' ? 'text-emerald-500' :
                      item.type === 'expense' ? 'text-destructive' :
                      'text-primary'
                    }>
                      {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            {/* Invisible base */}
            <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={0} />
            {/* Visible bar */}
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
