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
      <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Total do Mês</p>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalMonth)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-foreground/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Maior Categoria</p>
              <p className="text-2xl font-bold tracking-tight">
                {largestCategory ? largestCategory.name : '—'}
              </p>
              {largestCategory && (
                <p className="text-xs opacity-70">{formatCurrency(largestCategory.total)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-accent text-accent-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-foreground/10 flex items-center justify-center shrink-0">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Economia Projetada</p>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(projectedSavings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
