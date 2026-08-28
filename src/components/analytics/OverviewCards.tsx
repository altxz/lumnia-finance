import { Card, CardContent } from '@/components/ui/card';
import { Brain, PiggyBank, TrendingUp } from 'lucide-react';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import type { AnalyticsForecast } from '@/hooks/useAnalyticsData';

interface Props {
  totalCurrent: number;
  totalPrevious: number;
  comparisonAvailable: boolean;
  forecast: AnalyticsForecast;
  biggestSpending: { category: string; total: number } | null;
}

export function OverviewCards({ totalCurrent, totalPrevious, comparisonAvailable, forecast, biggestSpending }: Props) {
  const changePercent = comparisonAvailable && totalPrevious > 0
    ? ((totalCurrent - totalPrevious) / totalPrevious) * 100
    : null;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      <Card className="rounded-2xl border-0 shadow-card gradient-primary text-primary-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-foreground/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Gastos no período</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalCurrent)}</p>
          {changePercent !== null ? (
            <p className="text-xs mt-1 opacity-80">
              {changePercent >= 0 ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}% em gastos versus o período anterior
            </p>
          ) : (
            <p className="text-xs mt-1 opacity-80">Ative a comparação para avaliar a variação.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-card bg-ai text-ai-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-ai-foreground/20 flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Previsão para o próximo mês</p>
          </div>
          {forecast.value !== null ? (
            <>
              <p className="text-2xl font-bold">{formatCurrency(forecast.value)}</p>
              <p className="text-xs mt-1 opacity-75">Baseada em {forecast.basisMonths} meses com movimentação, recorrências e parcelas.</p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold">Base ainda insuficiente</p>
              <p className="text-xs mt-1 opacity-75">Registre movimentações em pelo menos dois meses para liberar uma previsão responsável.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-card bg-accent text-accent-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-foreground/10 flex items-center justify-center">
              <PiggyBank className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Maior gasto do período</p>
          </div>
          <p className="text-2xl font-bold">{biggestSpending ? formatCurrency(biggestSpending.total) : 'Sem dados'}</p>
          {biggestSpending && (
            <p className="text-xs mt-1 opacity-75">{getCategoryLabel(biggestSpending.category)}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
