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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-primary-foreground/20">
        {/* Receitas */}
        <div className="flex items-center justify-center sm:justify-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm opacity-70">Receitas</span>
            <span className="text-sm sm:text-base font-bold">
              {visible ? formatCurrency(totalIncome) : mask}
            </span>
          </div>
        </div>
        {/* Despesas */}
        <div className="flex items-center justify-center sm:justify-start gap-3 border-t sm:border-t-0 sm:border-l border-primary-foreground/20 pt-4 sm:pt-0 sm:pl-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-5 w-5 text-red-300" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm opacity-70">Despesas</span>
            <span className="text-sm sm:text-base font-bold">
              {visible ? formatCurrency(totalExpense) : mask}
            </span>
          </div>
        </div>
        {/* Balanço */}
        <div className="flex items-center justify-center sm:justify-start gap-3 border-t sm:border-t-0 sm:border-l border-primary-foreground/20 pt-4 sm:pt-0 sm:pl-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            balance >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <Scale className={`h-5 w-5 ${balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm opacity-70">Balanço</span>
            <span className={`text-sm sm:text-base font-bold ${
              balance >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}>
              {visible ? (balance >= 0 ? '+' : '') + formatCurrency(balance) : mask}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
