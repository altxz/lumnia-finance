import { useState, useMemo } from 'react';
import { Eye, EyeOff, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSelectedDate } from '@/contexts/DateContext';
import { formatCurrency } from '@/lib/constants';
import type { Expense } from '@/components/ExpenseTable';

interface TransactionSummaryHeaderProps {
  expenses: Expense[];
  startingMonthBalance: number;
}

export function TransactionSummaryHeader({ expenses, startingMonthBalance }: TransactionSummaryHeaderProps) {
  const [visible, setVisible] = useState(true);
  const { selectedMonth, selectedYear } = useSelectedDate();

  const now = new Date();
  const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
  const isFutureMonth = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());

  const label = isFutureMonth ? 'Saldo previsto' : isCurrentMonth ? 'Saldo atual' : 'Saldo final';

  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    expenses.forEach(e => {
      if (e.type === 'transfer') return;
      if (e.type === 'income') income += e.value;
      else if (!e.credit_card_id) expense += e.value;
    });
    return { totalIncome: income, totalExpense: expense };
  }, [expenses]);

  const balance = totalIncome - totalExpense;
  const currentBalance = startingMonthBalance + totalIncome - totalExpense;

  const mask = '••••••';

  return (
    <div className="w-full space-y-3 px-1">
      {/* Saldo principal */}
      <Card className="rounded-2xl border-0 shadow-md p-4 sm:p-5 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</span>
          <button
            onClick={() => setVisible(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
          >
            {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {visible ? formatCurrency(currentBalance) : mask}
        </p>
      </Card>

      {/* Métricas em cards individuais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Receitas */}
        <Card className="rounded-2xl border-0 shadow-md p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Receitas</span>
            <span className="text-sm sm:text-base font-bold text-foreground truncate">
              {visible ? formatCurrency(totalIncome) : mask}
            </span>
          </div>
        </Card>

        {/* Despesas */}
        <Card className="rounded-2xl border-0 shadow-md p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Despesas</span>
            <span className="text-sm sm:text-base font-bold text-foreground truncate">
              {visible ? formatCurrency(totalExpense) : mask}
            </span>
          </div>
        </Card>

        {/* Balanço */}
        <Card className="rounded-2xl border-0 shadow-md p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            balance >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'
          }`}>
            <Scale className={`h-5 w-5 ${balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground">Balanço</span>
            <span className={`text-sm sm:text-base font-bold truncate ${
              balance >= 0 ? 'text-emerald-500' : 'text-destructive'
            }`}>
              {visible ? (balance >= 0 ? '+' : '') + formatCurrency(balance) : mask}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
