import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';

interface HealthScoreProps {
  totalIncome: number;
  totalExpense: number;
  totalBudget: number;
  totalSpentInBudget: number;
  hasOverdueCards: boolean;
}

function getScoreColor(score: number) {
  if (score < 40) return 'hsl(0, 72%, 51%)';
  if (score < 70) return 'hsl(45, 93%, 47%)';
  return 'hsl(142, 71%, 45%)';
}

function getMessage(score: number) {
  if (score < 40) return 'Cuidado! Reveja seus gastos.';
  if (score < 70) return 'Você está no caminho certo!';
  return 'Excelente! Finanças saudáveis!';
}

export function HealthScore({ totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards }: HealthScoreProps) {
  const score = useMemo(() => {
    let s = 50;
    if (totalIncome > totalExpense) s += 20;
    if (totalBudget > 0 && totalSpentInBudget <= totalBudget) s += 20;
    if (!hasOverdueCards) s += 10;
    return Math.min(100, Math.max(0, s));
  }, [totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards]);

  const color = getScoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Saúde Financeira
          </CardTitle>
          <InfoPopover><p>Pontuação geral da sua saúde financeira baseada em receitas, despesas, orçamento e cartões.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pt-0">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={radius} fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color }}>{score}</span>
            <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>
        <p className="text-sm font-medium text-center" style={{ color }}>{getMessage(score)}</p>
      </CardContent>
    </Card>
  );
}
