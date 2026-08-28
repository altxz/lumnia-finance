import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSelectedDate } from '@/contexts/DateContext';
import { formatCurrency } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionSummaryHeaderProps {
  totalIncome: number;
  totalExpense: number;
  projectedBalance: number;
  loading?: boolean;
}

export function TransactionSummaryHeader({ totalIncome, totalExpense, projectedBalance, loading = false }: TransactionSummaryHeaderProps) {
  const [visible, setVisible] = useState(true);
  const { selectedMonth, selectedYear } = useSelectedDate();

  const now = new Date();
  const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
  const isFutureMonth = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());

  const balanceLabel = isFutureMonth ? 'Previsto' : isCurrentMonth ? 'Atual' : 'Final';
  const mask = '••••';

  if (loading) {
    return (
      <section className="surface-card overflow-hidden p-5 sm:p-6" aria-label="Carregando resumo financeiro" role="status">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="mt-3 h-10 w-52 max-w-[75%] rounded-xl" />
        <div className="mt-5 grid grid-cols-2 gap-6 border-t border-border pt-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-28 max-w-full" />
          </div>
          <div className="space-y-2 border-l border-border pl-6">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-28 max-w-full" />
          </div>
        </div>
        <span className="sr-only">Carregando resumo financeiro</span>
      </section>
    );
  }

  return (
    <section className="surface-card overflow-hidden p-5 sm:p-6" aria-label="Resumo financeiro do período">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Saldo {balanceLabel.toLowerCase()}
          </p>
          <p className={`mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.04em] tabular-nums whitespace-nowrap ${projectedBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
            {visible ? formatCurrency(projectedBalance) : mask}
          </p>
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {visible ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-border border-t border-border pt-4">
        <div className="min-w-0 pr-4">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="mt-1 truncate text-base sm:text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {visible ? `+${formatCurrency(totalIncome)}` : mask}
          </p>
        </div>
        <div className="min-w-0 pl-4">
          <p className="text-xs text-muted-foreground">Saídas</p>
          <p className="mt-1 truncate text-base sm:text-lg font-semibold tabular-nums text-destructive">
            {visible ? `-${formatCurrency(totalExpense)}` : mask}
          </p>
        </div>
      </div>
    </section>
  );
}
