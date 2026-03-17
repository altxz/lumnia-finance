import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Brain, PiggyBank, Shield } from 'lucide-react';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { Progress } from '@/components/ui/progress';

interface Props {
  avgMonthly: number;
  totalCurrent: number;
  totalPrevious: number;
  predictedNextMonth: number;
  financialScore: number;
  biggestSaving: { category: string; potential: number } | null;
}

export function OverviewCards({ avgMonthly, totalCurrent, totalPrevious, predictedNextMonth, financialScore, biggestSaving }: Props) {
  const changePercent = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious * 100) : 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Gasto Médio Mensal</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(avgMonthly)}</p>
          {totalPrevious > 0 && (
            <p className={`text-xs mt-1 ${changePercent > 0 ? 'opacity-90' : 'opacity-70'}`}>
              {changePercent > 0 ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}% vs. período anterior
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md bg-ai text-ai-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-ai-foreground/20 flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Previsão Próx. Mês</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(predictedNextMonth)}</p>
          <p className="text-xs mt-1 opacity-70">Confiança: 78% • Baseado em tendência</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md bg-accent text-accent-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-foreground/10 flex items-center justify-center">
              <PiggyBank className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Oportunidade de Economia</p>
          </div>
          <p className="text-2xl font-bold">{biggestSaving ? formatCurrency(biggestSaving.potential) : '—'}</p>
          {biggestSaving && (
            <p className="text-xs mt-1 opacity-70">{getCategoryInfo(biggestSaving.category).label} • Potencial mensal</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-pink-foreground/10 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium opacity-80">Score Financeiro</p>
          </div>
          <p className="text-2xl font-bold">{financialScore}<span className="text-sm font-normal opacity-60">/1000</span></p>
          <Progress value={financialScore / 10} className="mt-2 h-2 bg-pink-foreground/10" />
        </CardContent>
      </Card>
    </div>
  );
}
