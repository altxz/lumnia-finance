import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { CHART_SERIES } from '@/lib/chartPalette';

const COLORS = CHART_SERIES;

interface Props {
  expenses: any[];
  categories: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-3 py-2 shadow-card border border-border/60 bg-popover/95 backdrop-blur-xl">
      <p className="text-xs font-semibold text-popover-foreground">{payload[0].name}</p>
      <p className="text-xs text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function TopCategoriesPie({ expenses, categories }: Props) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (e.description?.startsWith('Pagamento fatura')) return;
      if (isBalanceAdjustment(e)) return;
      map[e.final_category] = (map[e.final_category] || 0) + e.value;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return sorted.map(([cat, total]) => {
      const dbCat = categories.find((c: any) => c.name.toLowerCase() === cat);
      const name = cat.toLowerCase() === 'outros' ? 'Outras Despesas' : (dbCat?.name || cat);
      return { name, value: total };
    });
  }, [expenses, categories]);

  const grandTotal = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 5 Categorias</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Top 5 Categorias</CardTitle>
          <InfoPopover><p>As 5 categorias de despesa com maior volume no período selecionado.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <div className="flex items-center gap-2 h-full">
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={82} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 text-xs min-w-[90px]">
            {data.map((entry, i) => {
              const pct = grandTotal > 0 ? ((entry.value / grandTotal) * 100).toFixed(1) : '0';
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate text-muted-foreground">{entry.name}</span>
                  <span className="font-semibold ml-auto">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
