import { ArrowLeftRight, ChevronRight, ReceiptText } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { DynamicCategoryIcon } from '@/components/DynamicCategoryIcon';
import type { Expense } from '@/components/ExpenseTable';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import type { DbCategory } from '@/hooks/useStaticData';
import { resolveTransactionCategory } from '@/lib/categoryMatch';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface DashboardRecentActivityProps {
  expenses: Expense[];
  categories: DbCategory[];
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function DashboardRecentActivity({ expenses, categories }: DashboardRecentActivityProps) {
  const navigate = useNavigate();
  const recent = useMemo(
    () => [...expenses].filter(item => item.type !== 'transfer' || item.value > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
    [expenses],
  );

  return (
    <Surface variant="base" padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div>
          <h2 className="type-title-3">Atividade recente</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">As últimas movimentações do período</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/historico')} className="rounded-full text-primary">
          Ver todas <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {recent.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center border-t border-border/70 px-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <ReceiptText className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Nenhuma movimentação neste mês</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Adicione uma transação para iniciar seu resumo financeiro.</p>
          <Button className="mt-4 rounded-full" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('lumnia:open-transaction'))}>
            Adicionar transação
          </Button>
        </div>
      ) : (
        <div className="border-t border-border/70 px-4 sm:px-5">
          {recent.map((expense) => {
            const category = resolveTransactionCategory(categories, expense);
            const isIncome = expense.type === 'income';
            const isTransfer = expense.type === 'transfer';
            return (
              <button
                key={expense.id}
                type="button"
                onClick={() => navigate('/historico')}
                className="flex w-full items-center gap-3 border-b border-border/60 py-3.5 text-left last:border-b-0 hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                  style={category?.color ? { color: category.color } : undefined}
                >
                  {isTransfer ? <ArrowLeftRight className="h-[18px] w-[18px]" /> : <DynamicCategoryIcon name={category?.icon} className="h-[18px] w-[18px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{expense.description || category?.name || 'Movimentação'}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{category?.name || 'Sem categoria'} · {dateLabel(expense.date)}</span>
                </span>
                <span className={cn('shrink-0 text-sm font-semibold tabular-nums', isIncome ? 'text-success' : isTransfer ? 'text-primary' : 'text-foreground')}>
                  {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(Math.abs(expense.value))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
