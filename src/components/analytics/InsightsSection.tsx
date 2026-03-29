import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, AlertTriangle, Lightbulb } from 'lucide-react';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { CategoryStats } from '@/hooks/useAnalyticsData';
import { InfoPopover } from '@/components/ui/info-popover';

interface Props {
  avgMonthly: number;
  categoryStats: CategoryStats[];
  weekdayAnalysis: { day: number; avg: number; count: number }[];
  predictedNextMonth: number;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function InsightsSection({ avgMonthly, categoryStats, weekdayAnalysis, predictedNextMonth }: Props) {
  const weekendAvg = weekdayAnalysis.filter(d => d.day === 0 || d.day === 6).reduce((s, d) => s + d.avg, 0) / 2;
  const weekdayAvg = weekdayAnalysis.filter(d => d.day > 0 && d.day < 6).reduce((s, d) => s + d.avg, 0) / 5;
  const weekendDiff = weekdayAvg > 0 ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100) : 0;

  const peakDay = weekdayAnalysis.sort((a, b) => b.avg - a.avg)[0];
  const topCategory = categoryStats[0];

  const patterns = [
    weekendDiff > 10 && `Você gasta mais nos finais de semana (+${weekendDiff}%)`,
    peakDay && `Dia com maior gasto médio: ${DAY_NAMES[peakDay.day]}`,
    topCategory && `${getCategoryInfo(topCategory.category).label} representa ${(topCategory.total / (avgMonthly * 3) * 100).toFixed(0)}% dos gastos`,
  ].filter(Boolean);

  const alerts = [
    predictedNextMonth > avgMonthly * 1.1 && `Projeção de ${formatCurrency(predictedNextMonth)} está acima da média`,
    topCategory && topCategory.change > 15 && `${getCategoryInfo(topCategory.category).label} subiu ${topCategory.change.toFixed(0)}% vs. período anterior`,
  ].filter(Boolean);

  const recommendations = [
    topCategory && `Revise gastos com ${getCategoryInfo(topCategory.category).label} — economia potencial de ${formatCurrency(topCategory.total * 0.15)}/período`,
    weekendDiff > 20 && `Planeje atividades de fim de semana com antecedência para reduzir gastos impulsivos`,
    `Defina metas mensais por categoria para manter controle`,
  ].filter(Boolean);

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-ai" /> Padrões Descobertos
            </CardTitle>
            <InfoPopover><p>Padrões de comportamento financeiro identificados automaticamente com base nos seus dados.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {patterns.length > 0 ? patterns.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-ai font-bold mt-0.5">•</span>
              <span className="text-muted-foreground">{p}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Adicione mais despesas para descobrir padrões.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas Inteligentes
            </CardTitle>
            <InfoPopover><p>Avisos automáticos quando seus gastos fogem do padrão habitual.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length > 0 ? alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-destructive font-bold mt-0.5">⚠</span>
              <span className="text-muted-foreground">{a}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhum alerta no momento. Tudo dentro do esperado!</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" /> Recomendações
            </CardTitle>
            <InfoPopover><p>Sugestões personalizadas para melhorar suas finanças com base nos seus hábitos.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-accent font-bold mt-0.5">💡</span>
              <span className="text-muted-foreground">{r}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
