import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Wallet, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MiniAreaChart, MiniAreaPoint } from '@/components/ui/mini-area-chart';

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
  /** Despesas em débito do mês. */
  debitExpense?: number;
  /** Pagamentos de fatura que saem do caixa no mês. */
  invoiceExpense?: number;
  /** Compras feitas no cartão no mês (informativo). */
  cardPurchases?: number;
}

function TrendBadge({ current, previous, invertColor }: { current: number; previous: number; invertColor?: boolean }) {
  if (previous === 0 && current === 0) return null;

  const pct = previous === 0
    ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / previous) * 100);

  if (pct === 0) return null;

  const isUp = pct > 0;

  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[11px] font-semibold">
      {isUp ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
      {isUp ? '+' : ''}{pct}%
    </span>
  );
}

function SummaryCard({ children, className, onClick }: { children: ReactNode; className: string; onClick?: () => void }) {
  return (
    <Card className={`rounded-2xl border-0 shadow-card overflow-hidden h-full ${className}`} onClick={onClick}>
      <CardContent className="p-3 sm:p-4 lg:p-5 h-full flex flex-col gap-1.5 sm:gap-2">
        {children}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  balance, totalIncome, totalExpense, largestCategory,
  prevBalance, prevIncome, prevExpense, pendingInStartingBalance,
  balanceHistory, incomeHistory, expenseHistory, categoryHistory,
  debitExpense, invoiceExpense, cardPurchases,
}: SummaryCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">

      <SummaryCard className="bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium truncate">Saldo Projetado</p>
            {pendingInStartingBalance != null && pendingInStartingBalance > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 opacity-60 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    <p>Considerando {formatCurrency(pendingInStartingBalance)} em despesas pendentes de meses anteriores</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div>
          <p className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight truncate">
            {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
          </p>
          {prevBalance !== undefined && <TrendBadge current={balance} previous={prevBalance} />}
        </div>
        <div className="mt-auto -mx-1">
          <MiniAreaChart data={balanceHistory || []} />
        </div>
      </SummaryCard>

      <SummaryCard className="bg-success text-success-foreground cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/historico?type=income')}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-success-foreground/20 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-[10px] sm:text-xs font-medium truncate">Entradas</p>
        </div>
        <div>
          <p className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight truncate">+{formatCurrency(totalIncome)}</p>
          {prevIncome !== undefined && <TrendBadge current={totalIncome} previous={prevIncome} />}
        </div>
        <div className="mt-auto -mx-1">
          <MiniAreaChart data={incomeHistory || []} />
        </div>
      </SummaryCard>

      <SummaryCard className="bg-destructive text-destructive-foreground cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/historico?type=expense')}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-destructive-foreground/20 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-[10px] sm:text-xs font-medium truncate">Saídas</p>
          {(debitExpense !== undefined || invoiceExpense !== undefined) && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 opacity-70 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-xs space-y-1">
                  <p>Saídas = despesas em débito + pagamentos de fatura do mês.</p>
                  {debitExpense !== undefined && <p>Débito: {formatCurrency(debitExpense)}</p>}
                  {invoiceExpense !== undefined && <p>Fatura do cartão: {formatCurrency(invoiceExpense)}</p>}
                  {cardPurchases !== undefined && cardPurchases > 0 && (
                    <p className="opacity-80">Compras no cartão feitas no mês: {formatCurrency(cardPurchases)} (entram na fatura, não nas saídas).</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div>
          <p className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight truncate">-{formatCurrency(totalExpense)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {prevExpense !== undefined && <TrendBadge current={totalExpense} previous={prevExpense} invertColor />}
            {(debitExpense !== undefined && invoiceExpense !== undefined) && (
              <span className="text-[9px] sm:text-[11px] opacity-80 truncate">
                Débito {formatCurrency(debitExpense)} · Fatura {formatCurrency(invoiceExpense)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-auto -mx-1">
          <MiniAreaChart data={expenseHistory || []} />
        </div>
      </SummaryCard>

      <SummaryCard
        className={`bg-pink text-pink-foreground ${largestCategory ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
        onClick={() => largestCategory && navigate(`/historico?category=${encodeURIComponent(largestCategory.categoryKey)}`)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pink-foreground/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-[10px] sm:text-xs font-medium truncate">Maior Subcategoria</p>
        </div>
        <div>
          <p className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight truncate">
            {largestCategory ? largestCategory.name : '—'}
          </p>
          {largestCategory && (
            <p className="text-[10px] sm:text-xs font-medium truncate">{formatCurrency(largestCategory.total)}</p>
          )}
        </div>
        <div className="mt-auto -mx-1">
          <MiniAreaChart data={categoryHistory || []} />
        </div>
      </SummaryCard>

    </div>
  );
}
