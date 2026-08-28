import { ArrowRight, CircleGauge, Lightbulb, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Surface } from '@/components/ui/surface';
import { formatCurrency } from '@/lib/constants';

export interface BudgetCategoryStatus {
  name: string;
  spent: number;
  limit: number;
  ratio: number;
}

interface DashboardInsightProps {
  categories: BudgetCategoryStatus[];
}

export function DashboardInsight({ categories }: DashboardInsightProps) {
  const navigate = useNavigate();
  const exceeded = [...categories]
    .filter(category => category.ratio >= 1)
    .sort((a, b) => b.ratio - a.ratio);
  const mostExceeded = exceeded[0];
  const monitoredCount = categories.length;

  return (
    <Surface variant="raised" padding="lg" className="relative overflow-hidden">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mostExceeded ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          {mostExceeded ? <TriangleAlert className="h-5 w-5" /> : monitoredCount > 0 ? <CircleGauge className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-caption">Orçamento por categoria</p>
          {mostExceeded ? (
            <>
              <h2 className="mt-1 type-title-3">
                {exceeded.length} {exceeded.length === 1 ? 'orçamento ultrapassado' : 'orçamentos ultrapassados'}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {mostExceeded.name} chegou a {Math.round(mostExceeded.ratio * 100)}% do orçamento de {formatCurrency(mostExceeded.limit)}.
              </p>
              <Progress value={100} className="mt-4 h-1.5 [&>div]:bg-destructive" />
            </>
          ) : monitoredCount > 0 ? (
            <>
              <h2 className="mt-1 type-title-3">Orçamento sob controle</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {monitoredCount} {monitoredCount === 1 ? 'categoria monitorada' : 'categorias monitoradas'} sem estouro neste mês.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-1 type-title-3">Defina seu orçamento</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Crie limites independentes para as categorias que deseja controlar.
              </p>
            </>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/categorias')} className="mt-4 rounded-full px-0 text-primary hover:bg-transparent hover:text-primary">
        {mostExceeded ? 'Revisar orçamento' : monitoredCount > 0 ? 'Ver planejamento' : 'Configurar orçamento'} <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </Surface>
  );
}
