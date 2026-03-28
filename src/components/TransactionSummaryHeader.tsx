import { useState, useMemo } from 'react';
import { Eye, EyeOff, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';
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
    <div className="w-full overflow-hidden mx-auto rounded-2xl bg-primary text-primary-foreground p-4 sm:p-6 shadow-lg">
      {/* Top: label + eye toggle */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-xs sm:text-sm font-medium opacity-80">{label}</span>
        <button
          onClick={() => setVisible(v => !v)}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {/* Main balance */}
      <p className="text-center text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight truncate">
        {visible ? formatCurrency(currentBalance) : mask}
      </p>

      {/* Three columns */}
      <div className="grid grid-cols-3 gap-1 sm:gap-4 w-full mt-4 sm:mt-6 pt-4 border-t border-primary-foreground/20">
        <div className="flex flex-col items-center gap-1 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-300" />
          </div>
          <p className="text-[9px] sm:text-xs opacity-70 truncate">Receitas</p>
          <p className="text-[10px] sm:text-sm font-bold truncate max-w-full">
            {visible ? formatCurrency(totalIncome) : mask}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-300" />
          </div>
          <p className="text-[9px] sm:text-xs opacity-70 truncate">Despesas</p>
          <p className="text-[10px] sm:text-sm font-bold truncate max-w-full">
            {visible ? formatCurrency(totalExpense) : mask}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 min-w-0">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
            balance >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <Scale className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`} />
          </div>
          <p className="text-[9px] sm:text-xs opacity-70 truncate">Balanço</p>
          <p className={`text-[10px] sm:text-sm font-bold truncate max-w-full ${
            balance >= 0 ? 'text-emerald-300' : 'text-red-300'
          }`}>
            {visible ? (balance >= 0 ? '+' : '') + formatCurrency(balance) : mask}
          </p>
        </div>
      </div>
    </div>
  );
}
