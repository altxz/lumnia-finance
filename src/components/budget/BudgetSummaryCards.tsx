import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank } from 'lucide-react';

interface Props {
  totalIncome: number;
  totalAllocated: number;
  totalSpent: number;
}

export function BudgetSummaryCards({ totalIncome, totalAllocated, totalSpent }: Props) {
  const remaining = totalIncome - totalAllocated;

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl border-0 shadow-md bg-green-600 text-white">
        <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium opacity-80">Receita</p>
            <p className="text-sm sm:text-xl font-bold truncate">{formatCurrency(totalIncome)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
        <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
            <PiggyBank className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium opacity-80">Distribuído</p>
            <p className="text-sm sm:text-xl font-bold truncate">{formatCurrency(totalAllocated)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={`rounded-2xl border-0 shadow-md ${remaining < 0 ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
        <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${remaining < 0 ? 'bg-destructive-foreground/20' : 'bg-accent-foreground/10'}`}>
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium opacity-80">Restante</p>
            <p className="text-sm sm:text-xl font-bold truncate">{formatCurrency(remaining)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-md bg-destructive text-destructive-foreground">
        <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium opacity-80">Total Gasto</p>
            <p className="text-sm sm:text-xl font-bold truncate">{formatCurrency(totalSpent)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
