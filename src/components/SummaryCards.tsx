import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Info, Landmark, TrendingUp, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MiniAreaChart, type MiniAreaPoint } from '@/components/ui/mini-area-chart';
import { Surface } from '@/components/ui/surface';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  largestCategory: { name: string; total: number; categoryKey: string } | null;
  prevBalance?: number;
  prevIncome?: number;
  prevExpense?: number;
  pendingInStartingBalance?: number;
  balanceHistory?: MiniAreaPoint[];
  incomeHistory?: MiniAreaPoint[];
  expenseHistory?: MiniAreaPoint[];
  categoryHistory?: MiniAreaPoint[];
  debitExpense?: number;
  invoiceExpense?: number;
  cardPurchases?: number;
}

function comparisonLabel(current: number, previous?: number, reference = 'mês anterior') {
  if (previous === undefined || (current === 0 && previous === 0)) return null;
  if (Math.abs(previous) < 0.01) return `${reference} zerado`;
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (change === 0) return `estável vs. ${reference}`;
  return `${change > 0 ? '+' : ''}${change}% vs. ${reference}`;
}

interface MetricProps {
  label: string;
  value: string;
  detail?: string | null;
  icon: typeof ArrowUpRight;
  tone: 'success' | 'destructive' | 'primary';
  history?: MiniAreaPoint[];
  onClick?: () => void;
  tooltip?: ReactNode;
}

function MetricCard({ label, value, detail, icon: Icon, tone, history, onClick, tooltip }: MetricProps) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 snap-start text-left disabled:cursor-default" disabled={!onClick}>
      <Surface
        variant="base"
        padding="md"
        className={cn(
          'group h-full min-h-[152px] transition-[transform,box-shadow] duration-200',
          onClick && 'hover:-translate-y-0.5 hover:shadow-card active:translate-y-0',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="type-caption text-foreground/72">{label}</p>
              {tooltip}
            </div>
            <p className="mt-2 truncate text-lg font-semibold tracking-[-0.025em] sm:text-xl">{value}</p>
          </div>
          <span className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            tone === 'primary' && 'bg-primary/10 text-primary',
          )}>
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </span>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail || '\u00a0'}</p>
        <MiniAreaChart
          data={history || []}
          className={cn(
            'mt-2 opacity-75',
            tone === 'success' && 'text-success',
            tone === 'destructive' && 'text-destructive',
            tone === 'primary' && 'text-primary',
          )}
        />
      </Surface>
    </button>
  );
}

export function SummaryCards({
  balance,
  totalIncome,
  totalExpense,
  largestCategory,
  prevBalance,
  prevIncome,
  prevExpense,
  pendingInStartingBalance,
  balanceHistory,
  incomeHistory,
  expenseHistory,
  categoryHistory,
  debitExpense,
  invoiceExpense,
  cardPurchases,
}: SummaryCardsProps) {
  const navigate = useNavigate();
  const balanceComparison = comparisonLabel(balance, prevBalance, 'saldo final anterior');
  const balanceHasComparableBase = balanceComparison !== 'saldo final anterior zerado';

  return (
    <section aria-labelledby="financial-overview-title" className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Surface variant="raised" padding="lg" className="relative min-h-[248px] overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id="financial-overview-title" className="type-caption text-foreground/72">Saldo projetado</p>
              <p className={cn('mt-3 type-display tabular-nums', balance < 0 && 'text-destructive')}>
                {formatCurrency(balance)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {balanceComparison && (
                  <span className="inline-flex items-center gap-1">
                    {balanceHasComparableBase && (balance >= (prevBalance ?? balance) ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />)}
                    {balanceComparison}
                  </span>
                )}
                {pendingInStartingBalance != null && pendingInStartingBalance > 0 && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <Info className="h-3.5 w-3.5" /> inclui pendências anteriores
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                        O saldo considera {formatCurrency(pendingInStartingBalance)} em pendências de meses anteriores.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" strokeWidth={1.8} />
            </span>
          </div>
          <MiniAreaChart data={balanceHistory || []} className="mt-auto h-16 text-primary sm:h-20" />
          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span>Projeção até o fim do mês</span>
            <button type="button" onClick={() => navigate('/historico')} className="font-semibold text-primary hover:underline">
              Ver movimentações
            </button>
          </div>
        </div>
      </Surface>

      <div className="no-scrollbar grid snap-x snap-mandatory grid-flow-col auto-cols-[82%] gap-3 overflow-x-auto pb-1 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-3 lg:overflow-visible xl:grid-cols-1">
        <MetricCard
          label="Entradas"
          value={`+${formatCurrency(totalIncome)}`}
          detail={comparisonLabel(totalIncome, prevIncome)}
          icon={ArrowUpRight}
          tone="success"
          history={incomeHistory}
          onClick={() => navigate('/historico?type=income')}
        />
        <MetricCard
          label="Saídas"
          value={`-${formatCurrency(Math.abs(totalExpense))}`}
          detail={comparisonLabel(totalExpense, prevExpense)}
          icon={ArrowDownRight}
          tone="destructive"
          history={expenseHistory}
          onClick={() => navigate('/historico?type=expense')}
          tooltip={(debitExpense !== undefined || invoiceExpense !== undefined) ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] space-y-1 text-xs">
                  <p>Débito: {formatCurrency(debitExpense || 0)}</p>
                  <p>Fatura: {formatCurrency(invoiceExpense || 0)}</p>
                  {cardPurchases != null && cardPurchases > 0 && <p>Compras no cartão: {formatCurrency(cardPurchases)}</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : undefined}
        />
        <MetricCard
          label="Maior gasto"
          value={largestCategory?.name || 'Sem dados'}
          detail={largestCategory ? formatCurrency(largestCategory.total) : 'Nenhuma despesa no período'}
          icon={largestCategory ? TrendingUp : Landmark}
          tone="primary"
          history={categoryHistory}
          onClick={largestCategory ? () => navigate(`/historico?category=${encodeURIComponent(largestCategory.categoryKey)}`) : undefined}
        />
      </div>
    </section>
  );
}
