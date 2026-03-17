import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  largestCategory: { name: string; total: number } | null;
}

export function SummaryCards({ balance, totalIncome, totalExpense, largestCategory }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Saldo do Mês</p>
              <p className={`text-2xl font-bold tracking-tight ${balance < 0 ? 'text-red-300' : ''}`}>
                {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-green-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <ArrowUpCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Entradas</p>
              <p className="text-2xl font-bold tracking-tight">+{formatCurrency(totalIncome)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-destructive text-destructive-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive-foreground/20 flex items-center justify-center shrink-0">
              <ArrowDownCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">Saídas</p>
              <p className="text-2xl font-bold tracking-tight">-{formatCurrency(totalExpense)}</p>
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
    </div>
  );
}
