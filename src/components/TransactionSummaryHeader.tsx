import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSelectedDate } from '@/contexts/DateContext';
import { formatCurrency } from '@/lib/constants';

interface TransactionSummaryHeaderProps {
  totalIncome: number;
  totalExpense: number;
  projectedBalance: number;
}

export function TransactionSummaryHeader({ totalIncome, totalExpense, projectedBalance }: TransactionSummaryHeaderProps) {
  const [visible, setVisible] = useState(true);
  const { selectedMonth, selectedYear } = useSelectedDate();

  const now = new Date();
  const isCurrentMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
  const isFutureMonth = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());

  const balanceLabel = isFutureMonth ? 'Previsto' : isCurrentMonth ? 'Atual' : 'Final';
  const mask = '••••';

  const cards = [
    { label: 'Entradas', value: totalIncome, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Saídas', value: totalExpense, tone: 'text-destructive' },
    {
      label: balanceLabel,
      value: projectedBalance,
      tone: projectedBalance < 0 ? 'text-destructive' : 'text-primary',
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => setVisible(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map(card => (
          <div key={card.label} className="glass-soft rounded-2xl px-3 py-3 sm:px-4 sm:py-4 min-w-0">
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">
              {card.label}
            </p>
            <p className={`mt-1 text-sm sm:text-lg font-bold tabular-nums truncate ${card.tone}`}>
              {visible ? formatCurrency(card.value) : mask}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
