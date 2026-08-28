import { AlertTriangle, CalendarDays, CircleGauge, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import type { CategoryStats } from '@/hooks/useAnalyticsData';

interface Props {
  totalCurrentPeriod: number;
  avgMonthly: number;
  categoryStats: CategoryStats[];
  weekdayAnalysis: { day: number; avg: number; count: number }[];
  predictedNextMonth: number | null;
}

interface Insight {
  key: string;
  title: string;
  description: string;
  tone: 'primary' | 'destructive' | 'success';
  icon: typeof CircleGauge;
}

function weightedAverage(days: { avg: number; count: number }[]) {
  const totalCount = days.reduce((sum, day) => sum + day.count, 0);
  if (totalCount === 0) return null;
  return days.reduce((sum, day) => sum + day.avg * day.count, 0) / totalCount;
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

function formatChange(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

function categoryIncreaseTitle(category: CategoryStats) {
  const label = getCategoryLabel(category.category);
  const increase = category.total - category.previousTotal;

  if ((category.change ?? 0) > 250) {
    return `${label} teve um aumento de ${formatCurrency(increase)}`;
  }

  return `${label} ficou ${formatChange(category.change ?? 0)} acima do período anterior`;
}

export function InsightsSection({ totalCurrentPeriod, avgMonthly, categoryStats, weekdayAnalysis, predictedNextMonth }: Props) {
  const topCategory = categoryStats[0];
  const topCategoryShare = topCategory && totalCurrentPeriod > 0 ? topCategory.total / totalCurrentPeriod : null;
  const weekendAverage = weightedAverage(weekdayAnalysis.filter((day) => day.day === 0 || day.day === 6));
  const weekdayAverage = weightedAverage(weekdayAnalysis.filter((day) => day.day > 0 && day.day < 6));
  const weekendDifference = weekendAverage !== null && weekdayAverage !== null && weekdayAverage > 0
    ? (weekendAverage - weekdayAverage) / weekdayAverage
    : null;

  const insights: Insight[] = [
    topCategory && topCategoryShare !== null && topCategoryShare >= 0.2
      ? {
          key: 'concentration',
          title: `${getCategoryLabel(topCategory.category)} concentra ${formatPercentage(topCategoryShare)} das despesas`,
          description: `${formatCurrency(topCategory.total)} distribuídos em ${topCategory.count} ${topCategory.count === 1 ? 'lançamento' : 'lançamentos'} no período.`,
          tone: 'primary',
          icon: CircleGauge,
        }
      : null,
    topCategory?.change !== null && topCategory && topCategory.change >= 15
      ? {
          key: 'category-increase',
          title: categoryIncreaseTitle(topCategory),
          description: `O gasto passou de ${formatCurrency(topCategory.previousTotal)} para ${formatCurrency(topCategory.total)}.`,
          tone: 'destructive',
          icon: TrendingUp,
        }
      : null,
    weekendDifference !== null && weekendDifference >= 0.15
      ? {
          key: 'weekend',
          title: `O gasto médio no fim de semana está ${formatPercentage(weekendDifference)} acima dos dias úteis`,
          description: `Média de ${formatCurrency(weekendAverage ?? 0)} no fim de semana, frente a ${formatCurrency(weekdayAverage ?? 0)} nos dias úteis.`,
          tone: 'destructive',
          icon: CalendarDays,
        }
      : null,
    predictedNextMonth !== null && avgMonthly > 0 && predictedNextMonth >= avgMonthly * 1.1
      ? {
          key: 'forecast',
          title: 'A previsão do próximo mês está acima da média observada',
          description: `${formatCurrency(predictedNextMonth)} estimados, frente a uma média de ${formatCurrency(avgMonthly)} por mês.`,
          tone: 'destructive',
          icon: AlertTriangle,
        }
      : null,
  ].filter((insight): insight is Insight => insight !== null).slice(0, 3);

  const toneClasses: Record<Insight['tone'], { icon: string; title: string }> = {
    primary: { icon: 'bg-primary/12 text-primary', title: 'text-foreground' },
    destructive: { icon: 'bg-destructive/12 text-destructive', title: 'text-foreground' },
    success: { icon: 'bg-success/12 text-success', title: 'text-foreground' },
  };

  return (
    <section className="space-y-5" aria-labelledby="insights-title">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Leitura do período</p>
        <h2 id="insights-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">O que merece atenção</h2>
      </div>
      {insights.length > 0 ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {insights.map((insight) => {
            const Icon = insight.icon;
            const tone = toneClasses[insight.tone];
            return (
              <Card key={insight.key} className="rounded-3xl border-border/80 shadow-card">
                <CardContent className="flex h-full flex-col p-5 sm:p-6">
                  <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-full ${tone.icon}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className={`break-words text-base font-semibold leading-6 ${tone.title}`}>{insight.title}</p>
                  <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{insight.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-3xl border-border/80 shadow-card">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6">
            <CardTitle className="text-lg font-semibold tracking-tight">Sem variações relevantes por enquanto</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 text-sm leading-6 text-muted-foreground sm:px-6 sm:pb-6">
            Continue registrando seus lançamentos para que comparações entre categorias e períodos se tornem mais representativas.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
