import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

interface BudgetItem {
  category: string;
  allocated_amount: number;
}

interface Props {
  budgets: BudgetItem[];
  expenses: any[];
}

export function BudgetVsActualChart({ budgets, expenses }: Props) {
  const { rows, totalPlanned, totalActual } = useMemo(() => {
    const spent: Record<string, number> = {};
    (expenses || []).forEach((e: any) => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (e.description?.startsWith('Pagamento fatura')) return;
      spent[e.final_category] = (spent[e.final_category] || 0) + Number(e.value || 0);
    });

    const merged: Record<string, number> = {};
    (budgets || []).forEach(b => {
      if (!b.category || !(b.allocated_amount > 0)) return;
      merged[b.category] = (merged[b.category] || 0) + Number(b.allocated_amount);
    });

    const rows = Object.entries(merged)
      .map(([category, planejado]) => ({
        category,
        planejado,
        realizado: spent[category] || 0,
      }))
      .sort((a, b) => b.planejado - a.planejado);

    return {
      rows,
      totalPlanned: rows.reduce((s, r) => s + r.planejado, 0),
      totalActual: rows.reduce((s, r) => s + r.realizado, 0),
    };
  }, [budgets, expenses]);

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Orçado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4">
          <p className="text-sm text-muted-foreground py-8 text-center">
            Configure um orçamento para visualizar a comparação.
          </p>
        </CardContent>
      </Card>
    );
  }

  const pct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
  const chartHeight = Math.max(rows.length * 42, 160);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Orçado vs Realizado</CardTitle>
          <InfoPopover><p>Compara, por categoria, o valor planejado no orçamento do mês com o valor real já gasto.</p></InfoPopover>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(totalActual)} de {formatCurrency(totalPlanned)} · {pct.toFixed(0)}% do orçamento
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4 overflow-y-auto">
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={92}
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as typeof rows[number];
                  const diff = row.planejado - row.realizado;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
                      <p className="font-semibold text-popover-foreground">{label}</p>
                      <p className="text-muted-foreground">Planejado: {formatCurrency(row.planejado)}</p>
                      <p className="text-muted-foreground">Realizado: {formatCurrency(row.realizado)}</p>
                      <p className={diff >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                        {diff >= 0 ? `Resta ${formatCurrency(diff)}` : `Excedeu ${formatCurrency(Math.abs(diff))}`}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="planejado" name="Planejado" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey="realizado" name="Realizado" radius={[0, 4, 4, 0]} barSize={10}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.realizado > r.planejado ? 'hsl(var(--destructive))' : 'hsl(var(--chart-2))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
