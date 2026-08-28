import { ArrowDownRight, ArrowUpRight, CalendarClock, Sparkles } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import type { AnalyticsForecast, MonthlyData } from '@/hooks/useAnalyticsData';
import { chartAxisProps, chartGridProps } from '@/components/ui/chart';
import { EXPENSE_COLOR } from '@/lib/chartPalette';

interface Props {
  monthlyData: MonthlyData[];
  forecast: AnalyticsForecast;
}

interface TrendDatum {
  label: string;
  observado?: number;
  previsao?: number;
}

function compactCurrency(value: number) {
  if (Math.abs(value) < 1000) return `R$ ${Math.round(value)}`;
  return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
}

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const values = payload.filter((entry) => typeof entry.value === 'number');
  if (values.length === 0) return null;

  return (
    <div className="chart-tooltip-surface min-w-44 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {values.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-popover-foreground">{formatCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendsCharts({ monthlyData, forecast }: Props) {
  const hasExpenseHistory = monthlyData.some((month) => month.total > 0);
  const chartData: TrendDatum[] = monthlyData.map((month) => ({ label: month.label, observado: Math.round(month.total) }));
  const lastMonth = monthlyData.at(-1);

  if (forecast.status === 'ready' && forecast.value !== null && lastMonth) {
    const lastDatum = chartData.at(-1);
    if (lastDatum) lastDatum.previsao = Math.round(lastMonth.total);
    chartData.push({ label: 'Próximo mês', previsao: Math.round(forecast.value) });
  }

  const changeFromLastMonth = forecast.value !== null && lastMonth && lastMonth.total > 0
    ? ((forecast.value - lastMonth.total) / lastMonth.total) * 100
    : null;
  const isHigherForecast = (changeFromLastMonth ?? 0) > 0;

  return (
    <section className="space-y-5" aria-labelledby="forecast-title">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Ritmo financeiro</p>
        <h2 id="forecast-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Evolução e próximo mês</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">A previsão separa compromissos já agendados da média das despesas variáveis.</p>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <Card className="min-w-0 rounded-3xl border-border/80 shadow-card">
          <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
            <CardTitle className="text-lg font-semibold tracking-tight">Despesas observadas</CardTitle>
            <p className="text-sm leading-5 text-muted-foreground">Valores consolidados em cada mês do período selecionado.</p>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-0 sm:px-4 sm:pb-5">
            {hasExpenseHistory ? (
              <div className="h-72 min-w-0" role="img" aria-label="Gráfico de evolução das despesas mensais e previsão quando disponível">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid {...chartGridProps} vertical={false} />
                    <XAxis {...chartAxisProps} dataKey="label" minTickGap={24} />
                    <YAxis {...chartAxisProps} width={62} tickFormatter={compactCurrency} />
                    <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="observado" name="Despesas" stroke={EXPENSE_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: EXPENSE_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                    {forecast.status === 'ready' && forecast.value !== null ? (
                      <Line type="monotone" dataKey="previsao" name="Previsão" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
                <CalendarClock className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium text-foreground">Ainda não há histórico de despesas</p>
                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Quando houver lançamentos, a evolução mensal aparecerá aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/80 shadow-card">
          <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg font-semibold tracking-tight">Previsão do próximo mês</CardTitle>
            </div>
            <p className="text-sm leading-5 text-muted-foreground">Estimativa baseada nos seus próprios lançamentos.</p>
          </CardHeader>
          <CardContent className="flex min-h-72 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
            {forecast.status === 'ready' && forecast.value !== null ? (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">{formatCurrency(forecast.value)}</p>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">Inclui despesas recorrentes e parcelas já previstas, além da média das variáveis.</p>
                {changeFromLastMonth !== null ? (
                  <div className="mt-auto rounded-2xl bg-muted/45 p-4">
                    <div className="flex items-start gap-3">
                      {isHigherForecast ? <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" /> : <ArrowDownRight className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />}
                      <div>
                        <p className={isHigherForecast ? 'font-semibold text-destructive' : 'font-semibold text-success'}>
                          {isHigherForecast ? `${changeFromLastMonth.toFixed(0)}% acima` : `${Math.abs(changeFromLastMonth).toFixed(0)}% abaixo`} do último mês
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Comparação com {formatCurrency(lastMonth?.total ?? 0)} em {lastMonth?.label}.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-auto rounded-2xl bg-muted/45 p-4 text-xs leading-5 text-muted-foreground">A comparação aparecerá quando o mês atual tiver despesas registradas.</p>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Base de cálculo: {forecast.basisMonths} {forecast.basisMonths === 1 ? 'mês com dados' : 'meses com dados'}.</p>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
                <CalendarClock className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium text-foreground">Previsão ainda indisponível</p>
                <p className="mt-1 max-w-xs text-sm leading-5 text-muted-foreground">
                  {forecast.status === 'insufficient-history'
                    ? 'Registre despesas em pelo menos dois meses para criar uma previsão confiável.'
                    : 'Registre despesas para que possamos estimar o próximo mês.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
