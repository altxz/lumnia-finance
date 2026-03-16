import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

interface SummaryCardsProps {
  totalMonth: number;
  largestCategory: { name: string; total: number } | null;
  projectedSavings: number;
}

export function SummaryCards({ totalMonth, largestCategory, projectedSavings }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ai/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-ai" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Total do Mês</p>
              <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalMonth)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Maior Categoria</p>
              <p className="text-2xl font-semibold tracking-tight">
                {largestCategory ? largestCategory.name : '—'}
              </p>
              {largestCategory && (
                <p className="text-xs text-muted-foreground">{formatCurrency(largestCategory.total)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <PiggyBank className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Economia Projetada</p>
              <p className="text-2xl font-semibold tracking-tight">{formatCurrency(projectedSavings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
