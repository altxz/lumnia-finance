import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { chartAxisProps, chartGridProps } from '@/components/ui/chart';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-3 py-2 shadow-card border border-border/60 bg-popover/95 backdrop-blur-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color || 'hsl(var(--popover-foreground))' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

interface Props {
  totalIncome: number;
  totalExpense: number;
}

export function IncomeVsExpenseChart({ totalIncome, totalExpense }: Props) {
  const isMobile = useIsMobile();
  const data = [{ name: 'Mês Atual', receitas: totalIncome, despesas: totalExpense }];

  const header = (
    <CardHeader className="pb-1 px-4 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-1.5">
        <CardTitle className="text-[13px] sm:text-sm font-semibold whitespace-nowrap">Receita vs Despesas</CardTitle>
        <InfoPopover><p>Comparação direta entre o volume total de dinheiro que entrou e o que saiu, considerando faturas de cartão pelo mês de vencimento.</p></InfoPopover>
      </div>
    </CardHeader>
  );

  // Celular: barras horizontais com valores — muito mais legível que um gráfico minúsculo.
  if (isMobile) {
    const max = Math.max(totalIncome, totalExpense, 1);
    const saldo = totalIncome - totalExpense;
    const rows = [
      { label: 'Receitas', value: totalIncome, color: 'hsl(var(--success))' },
      { label: 'Despesas', value: totalExpense, color: 'hsl(var(--destructive))' },
    ];
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        {header}
        <CardContent className="flex-1 min-h-0 flex flex-col justify-center gap-3 px-4 pb-4 pt-0">
          {rows.map(r => (
            <div key={r.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{r.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: r.color }}>{formatCurrency(r.value)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }} />
              </div>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t pt-2">
            <span className="text-[11px] text-muted-foreground">Resultado</span>
            <span className={`text-sm font-bold tabular-nums ${saldo >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {saldo >= 0 ? '+' : ''}{formatCurrency(saldo)}
            </span>
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
          <BarChart data={data} barGap={6} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" />
                <stop offset="100%" stopColor="hsl(var(--success))" />
              </linearGradient>
              <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--destructive))" />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis {...chartAxisProps} dataKey="name" />
            <YAxis {...chartAxisProps} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={34} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif' }} />
            <Bar dataKey="receitas" name="Receitas" fill="url(#gradIncome)" radius={[10, 10, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="url(#gradExpense)" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
