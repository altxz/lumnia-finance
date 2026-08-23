import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { buildWaterfall, type WaterfallItem } from '@/lib/waterfallMath';

interface WaterfallChartProps {
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  debitExpense: number;
  invoiceTotal: number;
  invoicePaid: number;
  invoiceProjected: number;
  cardPurchases: number;
  byCategory: Record<string, number>;
  projectedBalance: number;
}

function resolveCategoryName(cat: string): string {
  const info = getCategoryInfo(cat);
  if (info.value === 'outros' && cat.toLowerCase() !== 'outros') {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  return info.label;
}

const COLORS: Record<WaterfallItem['type'], string> = {
  start: 'hsl(var(--primary))',
  income: 'hsl(var(--success))',
  expense: 'hsl(var(--destructive))',
  invoice: 'hsl(var(--chart-2))',
  end: 'hsl(var(--primary))',
};

export function WaterfallChart({
  startingBalance,
  totalIncome,
  totalExpense,
  debitExpense,
  invoiceTotal,
  invoicePaid,
  invoiceProjected,
  cardPurchases,
  byCategory,
}: WaterfallChartProps) {
  const data = useMemo(
    () =>
      buildWaterfall({
        startingBalance,
        totalIncome,
        totalExpense,
        debitExpense,
        invoiceTotal,
        byCategory,
        resolveName: resolveCategoryName,
      }),
    [startingBalance, totalIncome, totalExpense, debitExpense, invoiceTotal, byCategory],
  );

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Cascata do Mês</CardTitle>
          <InfoPopover>
            <p>
              Mostra como o saldo inicial se transforma no saldo previsto do fim do mês: receitas somam,
              despesas em débito e a fatura do cartão subtraem. As compras no cartão não aparecem como
              saída direta porque saem do caixa quando a fatura é paga.
            </p>
          </InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-2 flex flex-col">
        <div className="flex-1 min-h-0">
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
                    <div className="chart-tooltip-surface">
                      <p className="font-semibold mb-1">{item.name}</p>
                      <p style={{ color: COLORS[item.type] }}>
                        {item.amount >= 0 ? '+' : ''}
                        {formatCurrency(item.amount)}
                      </p>
                      {item.type === 'invoice' && (
                        <p className="mt-1 text-muted-foreground">
                          Pago: {formatCurrency(invoicePaid)} · Projetado: {formatCurrency(invoiceProjected)}
                        </p>
                      )}
                      {item.type === 'end' && (
                        <p className="mt-1 text-muted-foreground">
                          {formatCurrency(startingBalance)} + {formatCurrency(totalIncome)} −{' '}
                          {formatCurrency(totalExpense)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={0} />
              <Bar dataKey="value" stackId="waterfall" radius={[8, 8, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.type === 'end' && entry.amount < 0 ? 'hsl(var(--destructive))' : COLORS[entry.type]}
                    opacity={entry.type === 'expense' ? 0.85 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {cardPurchases > 0 && (
          <p className="pt-1 text-[10px] leading-tight text-muted-foreground">
            Compras no cartão neste mês: {formatCurrency(cardPurchases)} (entram como fatura).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
