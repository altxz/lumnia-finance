import { CircleGauge, Layers3, ReceiptText, TriangleAlert } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Props {
  totalAllocated: number;
  monitoredSpent: number;
  monitoredCount: number;
  exceededCount: number;
}

export function BudgetSummaryCards({ totalAllocated, monitoredSpent, monitoredCount, exceededCount }: Props) {
  const usage = totalAllocated > 0 ? (monitoredSpent / totalAllocated) * 100 : 0;
  const progress = Math.min(100, usage);
  const status = exceededCount > 0
    ? `${exceededCount} ${exceededCount === 1 ? 'orçamento exige' : 'orçamentos exigem'} atenção`
    : monitoredCount > 0
      ? 'Tudo dentro do orçamento'
      : 'Comece definindo seu orçamento';

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section className={cn('surface-card p-5 sm:p-6', exceededCount > 0 && 'border-destructive/25')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Situação do orçamento</p>
            <p className={cn('mt-2 text-2xl font-semibold tracking-tight', exceededCount > 0 && 'text-destructive')}>
              {status}
            </p>
          </div>
          <span className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
            exceededCount > 0 && 'bg-destructive/10 text-destructive',
          )}>
            {exceededCount > 0 ? <TriangleAlert className="h-5 w-5" /> : <CircleGauge className="h-5 w-5" />}
          </span>
        </div>

        <div className="mt-7 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Gasto nas categorias monitoradas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(monitoredSpent)}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">
            {totalAllocated > 0 ? `${usage.toFixed(0)}%` : 'Sem base'}
          </p>
        </div>
        <Progress
          value={progress}
          className={cn('mt-4 h-2.5', exceededCount > 0 && '[&>div]:bg-destructive')}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {totalAllocated > 0 ? `${formatCurrency(totalAllocated)} distribuídos entre categorias.` : 'O orçamento por categoria é independente da sua renda mensal.'}
        </p>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <section className="surface-base flex min-h-24 flex-col justify-between rounded-2xl p-3 sm:min-h-28 sm:p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Layers3 className="h-3.5 w-3.5" /></span>
          <div><p className="text-2xl font-semibold tabular-nums">{monitoredCount}</p><p className="text-xs text-muted-foreground">Monitoradas</p></div>
        </section>
        <section className={cn('surface-base flex min-h-24 flex-col justify-between rounded-2xl p-3 sm:min-h-28 sm:p-4', exceededCount > 0 && 'border-destructive/25')}>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', exceededCount > 0 && 'bg-destructive/10 text-destructive')}><TriangleAlert className="h-3.5 w-3.5" /></span>
          <div><p className={cn('text-2xl font-semibold tabular-nums', exceededCount > 0 && 'text-destructive')}>{exceededCount}</p><p className="text-xs text-muted-foreground">Ultrapassadas</p></div>
        </section>
        <section className="surface-base flex min-h-24 flex-col justify-between rounded-2xl p-3 sm:min-h-28 sm:p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><ReceiptText className="h-3.5 w-3.5" /></span>
          <div><p className="truncate text-xs text-muted-foreground">Total</p><p className="text-sm font-semibold tabular-nums sm:text-base">{formatCurrency(totalAllocated)}</p></div>
        </section>
      </div>
    </div>
  );
}
