import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  largestCategory: { name: string; total: number; categoryKey: string } | null;
  prevBalance?: number;
  prevIncome?: number;
  prevExpense?: number;
  healthScore?: ReactNode;
}

function TrendBadge({ current, previous, invertColor }: { current: number; previous: number; invertColor?: boolean }) {
  if (previous === 0 && current === 0) return null;

  const pct = previous === 0
    ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / previous) * 100);

  if (pct === 0) return null;

  const isUp = pct > 0;
  const isPositive = invertColor ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[11px] font-semibold mt-0.5 ${
      isPositive ? 'opacity-90' : 'opacity-90'
    }`}>
      {isUp ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
      {isUp ? '+' : ''}{pct}%
    </span>
  );
}

function SummaryCard({ children, className, onClick }: { children: ReactNode; className: string; onClick?: () => void }) {
  return (
    <Card className={`rounded-2xl border-0 shadow-md overflow-hidden ${className}`} onClick={onClick}>
      <CardContent className="p-3 sm:p-4 lg:p-5">
        {children}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ balance, totalIncome, totalExpense, largestCategory, prevBalance, prevIncome, prevExpense, healthScore }: SummaryCardsProps) {
  const navigate = useNavigate();

  return (
    <div className={`grid gap-3 sm:gap-4 ${healthScore ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>

      {/* Bloco Esquerdo: Os 4 cards de métricas */}
      <div className={`grid gap-3 sm:gap-4 grid-cols-2 ${healthScore ? 'lg:col-span-2' : 'col-span-full lg:col-span-4 lg:grid-cols-4'}`}>

        <SummaryCard className="bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium opacity-80 whitespace-nowrap">Saldo Total</p>
              <p className={`text-sm sm:text-lg lg:text-xl font-bold tracking-tight truncate ${balance < 0 ? 'text-red-300' : ''}`}>
                {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
              </p>
              {prevBalance !== undefined && <TrendBadge current={balance} previous={prevBalance} />}
            </div>
          </div>
        </SummaryCard>

        <SummaryCard className="bg-green-600 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/historico?type=income')}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium opacity-80 whitespace-nowrap">Entradas</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight truncate">+{formatCurrency(totalIncome)}</p>
              {prevIncome !== undefined && <TrendBadge current={totalIncome} previous={prevIncome} />}
            </div>
          </div>
        </SummaryCard>

        <SummaryCard className="bg-destructive text-destructive-foreground cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/historico?type=expense')}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center shrink-0">
              <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium opacity-80 whitespace-nowrap">Saídas</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight truncate">-{formatCurrency(totalExpense)}</p>
              {prevExpense !== undefined && <TrendBadge current={totalExpense} previous={prevExpense} invertColor />}
            </div>
          </div>
        </SummaryCard>

        <SummaryCard
          className={`bg-pink text-pink-foreground ${largestCategory ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
          onClick={() => largestCategory && navigate(`/historico?category=${encodeURIComponent(largestCategory.categoryKey)}`)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-pink-foreground/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium opacity-80 whitespace-nowrap">Maior Categoria</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight truncate">
                {largestCategory ? largestCategory.name : '—'}
              </p>
              {largestCategory && (
                <p className="text-[10px] sm:text-xs opacity-70 truncate">{formatCurrency(largestCategory.total)}</p>
              )}
            </div>
          </div>
        </SummaryCard>

      </div>

      {/* Bloco Direito: Score Financeiro */}
      {healthScore && (
        <div className="lg:col-span-1 h-full w-full [&>div]:h-full">
          {healthScore}
        </div>
      )}

    </div>
  );
}
