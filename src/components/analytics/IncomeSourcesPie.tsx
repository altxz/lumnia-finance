import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  expenses: any[];
  categories: any[];
}

const COLORS = ['hsl(var(--success))', 'hsl(var(--success))', 'hsl(var(--chart-8))', 'hsl(var(--chart-6))', 'hsl(var(--chart-6))'];

export function IncomeSourcesPie({ expenses, categories }: Props) {
  const isMobile = useIsMobile();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type !== 'income') return;
      if (isBalanceAdjustment(e)) return;
      map[e.final_category] = (map[e.final_category] || 0) + e.value;
    });
    if (Object.keys(map).length === 0) return [];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => {
        const dbCat = categories.find((c: any) => c.name.toLowerCase() === cat);
        return { name: dbCat?.name || cat, value: total };
      });
  }, [expenses, categories]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fontes de Renda</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem receitas</CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  const header = (
    <CardHeader className="pb-1 px-4 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-1.5">
        <CardTitle className="text-[13px] sm:text-sm font-semibold whitespace-nowrap">Fontes de Renda</CardTitle>
        <InfoPopover><p>Distribuição de onde vem o seu dinheiro (ex: Salário, Rendimentos, Freelance).</p></InfoPopover>
      </div>
    </CardHeader>
  );

  // Celular: rosca à esquerda + lista com valores à direita (usa a largura toda).
  if (isMobile) {
    const top = data.slice(0, 4);
    const rest = data.slice(4);
    const restTotal = rest.reduce((s, d) => s + d.value, 0);
    const rows = restTotal > 0 ? [...top, { name: 'Outras', value: restTotal }] : top;

    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        {header}
        <CardContent className="flex-1 min-h-0 flex items-center gap-3 px-4 pb-4 pt-0">
          <div className="relative h-[120px] w-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie data={data} cx="50%" cy="50%" innerRadius="60%" outerRadius="94%" paddingAngle={3} dataKey="value">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] text-muted-foreground">Total</span>
              <span className="text-[11px] font-bold tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {rows.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: d.name === 'Outras' ? 'hsl(var(--muted-foreground))' : COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-muted-foreground">{d.name}</span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      {header}
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie data={data} cx="50%" cy="50%" innerRadius="48%" outerRadius="80%" paddingAngle={3} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
