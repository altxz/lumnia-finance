import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

interface Props {
  avgMonthly: number;
  totalCurrentPeriod: number;
}

export function GoalsSection({ avgMonthly, totalCurrentPeriod }: Props) {
  const [goalAmount, setGoalAmount] = useState(10000);
  const [monthlySaving, setMonthlySaving] = useState(500);

  const monthsToGoal = monthlySaving > 0 ? Math.ceil(goalAmount / monthlySaving) : 0;
  const currentMonthProgress = Math.min(100, (totalCurrentPeriod / (avgMonthly || 1)) * 100);

  const presetGoals = [
    { label: 'Meta Mensal', target: 3000, current: totalCurrentPeriod, unit: 'gastos' },
    { label: 'Reserva de Emergência', target: avgMonthly * 6, current: avgMonthly * 2, unit: 'economizado' },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {presetGoals.map((g, i) => {
            const pct = Math.min(100, (g.current / g.target) * 100);
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{g.label}</span>
                  <span className="text-muted-foreground">{formatCurrency(g.current)} / {formatCurrency(g.target)}</span>
                </div>
                <Progress value={pct} className="h-2.5" />
              </div>
            );
          })}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium">Progresso do Mês</span>
              <span className="text-muted-foreground">{currentMonthProgress.toFixed(0)}% da média</span>
            </div>
            <Progress value={currentMonthProgress} className="h-2.5" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-ai" /> Simulador de Economia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Objetivo (R$)</Label>
            <Input type="number" value={goalAmount} onChange={e => setGoalAmount(Number(e.target.value))} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Economia mensal (R$)</Label>
            <Input type="number" value={monthlySaving} onChange={e => setMonthlySaving(Number(e.target.value))} className="rounded-xl" />
          </div>
          <div className="rounded-xl bg-secondary p-4 text-center">
            <p className="text-sm text-muted-foreground">Tempo estimado para atingir a meta</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              {monthsToGoal > 0 ? `${monthsToGoal} meses` : '—'}
            </p>
            {monthsToGoal > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {Math.ceil(monthsToGoal / 12)} ano{Math.ceil(monthsToGoal / 12) > 1 ? 's' : ''} e {monthsToGoal % 12} meses
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
