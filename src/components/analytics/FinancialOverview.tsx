import { ArrowDownRight, ArrowUpRight, Equal, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import type { MonthlyData } from '@/hooks/useAnalyticsData';
import { chartAxisProps, chartGridProps } from '@/components/ui/chart';
import { EXPENSE_COLOR, INCOME_COLOR } from '@/lib/chartPalette';

interface Props {
  monthlyData: MonthlyData[];
  totalIncome: number;
  totalExpense: number;
  previousIncome: number;
  previousExpense: number;
  comparisonAvailable: boolean;
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function comparisonText(current: number, previous: number, comparisonAvailable: boolean) {
  if (!comparisonAvailable || previous === 0) return 'Sem comparação disponível';

  const difference = current - previous;
  const direction = difference > 0 ? '↑' : difference < 0 ? '↓' : '•';
  const percentage = (difference / Math.abs(previous)) * 100;

  if (Math.abs(percentage) > 250 || previous < 0) {
    return `${direction} ${formatCurrency(Math.abs(difference))} versus o período anterior`;
  }

  return `${direction} ${Math.abs(percentage).toFixed(0)}% versus o período anterior`;
}

function Metric({ label, value, previous, comparisonAvailable, icon: Icon, tone }: {
  label: string;
  value: number;
  previous: number;
  comparisonAvailable: boolean;
  icon: typeof ArrowUpRight;
  tone: 'income' | 'expense' | 'result';
}) {
  const valueClass = tone === 'income' ? 'text-success' : tone === 'expense' ? 'text-destructive' : 'text-foreground';
  const iconClass = tone === 'income' ? 'bg-success/10 text-success' : tone === 'expense' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary';

  return (
    <div className="min-w-0 rounded-2xl bg-muted/45 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="break-normal">{label}</span>
      </div>
      <p className={`mt-3 whitespace-nowrap text-xl font-semibold tracking-[-0.025em] tabular-nums sm:text-2xl ${valueClass}`}>
        {tone === 'result' && value > 0 ? '+' : ''}{formatCurrency(value)}
      </p>
      <p className="mt-1.5 min-h-5 text-xs text-muted-foreground">
        {comparisonText(value, previous, comparisonAvailable)}
      </p>
    </div>
  );
}

function OverviewTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip-surface min-w-[11rem]">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4 py-0.5 text-xs">
          <span className="text-muted-foreground">{item.name}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums" style={{ color: item.color }}>{formatCurrency(Number(item.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

export function FinancialOverview({ monthlyData, totalIncome, totalExpense, previousIncome, previousExpense, comparisonAvailable }: Props) {
  const result = totalIncome - totalExpense;
  const previousResult = previousIncome - previousExpense;
  const chartData = monthlyData.map(month => ({
    label: month.label.replace('.', ''),
    receitas: month.income,
    despesas: month.total,
    resultado: month.net,
  }));

  return (
    <section className="space-y-4 sm:space-y-5" aria-labelledby="financial-overview-title">
      <div className="flex flex-col gap-1">
        <p className="type-label text-primary">Visão do período</p>
        <h2 id="financial-overview-title" className="type-title-2 text-foreground">Receitas, despesas e resultado</h2>
        <p className="type-body text-muted-foreground">Entenda o movimento financeiro sem misturar previsões com valores realizados.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Metric
          label="Receitas"
          value={totalIncome}
          previous={previousIncome}
          comparisonAvailable={comparisonAvailable}
          icon={ArrowUpRight}
          tone="income"
        />
        <Metric
          label="Despesas"
          value={totalExpense}
          previous={previousExpense}
          comparisonAvailable={comparisonAvailable}
          icon={ArrowDownRight}
          tone="expense"
        />
        <Metric
          label="Resultado"
          value={result}
          previous={previousResult}
          comparisonAvailable={comparisonAvailable}
          icon={Equal}
          tone="result"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-card">
        <CardHeader className="gap-4 px-5 pb-2 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold">Evolução mensal</CardTitle>
            <p className="text-sm text-muted-foreground">Barras mostram receitas e despesas. A linha representa o resultado de cada mês.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <TrendingUp className="h-4 w-4" />
            <span className="whitespace-nowrap">{result >= 0 ? '+' : ''}{formatCurrency(result)}</span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-0 sm:px-4 sm:pb-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 text-xs text-muted-foreground sm:px-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Receitas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Despesas</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-primary" />Resultado</span>
          </div>
          <div className="h-[248px] sm:h-[300px]" role="img" aria-label="Gráfico mensal de receitas, despesas e resultado">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
                <CartesianGrid {...chartGridProps} vertical={false} />
                <XAxis {...chartAxisProps} dataKey="label" interval="preserveStartEnd" />
                <YAxis {...chartAxisProps} tickFormatter={compactCurrency} width={58} />
                <Tooltip content={<OverviewTooltip />} cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.045 }} />
                <Bar dataKey="receitas" name="Receitas" fill={INCOME_COLOR} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="despesas" name="Despesas" fill={EXPENSE_COLOR} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
