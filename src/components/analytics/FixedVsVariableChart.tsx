import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  expenses: any[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

export function FixedVsVariableChart({ expenses }: Props) {
  const isMobile = useIsMobile();

  const data = useMemo(() => {
    let fixed = 0;
    let variable = 0;
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (isBalanceAdjustment(e)) return;
      if (e.is_recurring) fixed += e.value;
      else variable += e.value;
    });
    if (fixed === 0 && variable === 0) return [];
    return [
      { name: 'Custos Fixos', value: fixed },
      { name: 'Custos Variáveis', value: variable },
    ];
  }, [expenses]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fixos vs Variáveis</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  const header = (
    <CardHeader className="pb-1 px-4 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-1.5">
        <CardTitle className="text-[13px] sm:text-sm font-semibold whitespace-nowrap">Fixos vs Variáveis</CardTitle>
        <InfoPopover><p>Proporção entre contas obrigatórias (aluguel, luz) e gastos flexíveis (lazer, compras).</p></InfoPopover>
      </div>
    </CardHeader>
  );

  // Celular: barra empilhada + valores reais (legível em ~180px de largura).
  if (isMobile) {
    const fixedPct = total > 0 ? (data[0].value / total) * 100 : 0;
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        {header}
        <CardContent className="flex-1 min-h-0 flex flex-col justify-center gap-2.5 px-4 pb-4 pt-0">
          <div>
            <p className="text-2xl font-bold leading-none">{Math.round(fixedPct)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">são custos fixos</p>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <span className="h-full" style={{ width: `${fixedPct}%`, backgroundColor: COLORS[0] }} />
            <span className="h-full flex-1" style={{ backgroundColor: COLORS[1] }} />
          </div>
          <div className="space-y-1">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-muted-foreground truncate">{d.name === 'Custos Fixos' ? 'Fixos' : 'Variáveis'}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatCurrency(d.value)}</span>
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
            <Pie data={data} cx="50%" cy="50%" innerRadius="52%" outerRadius="80%" paddingAngle={4} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
