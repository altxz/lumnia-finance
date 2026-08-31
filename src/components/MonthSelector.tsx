import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelectedDate } from '@/contexts/DateContext';

interface MonthSelectorProps {
  showTodayButton?: boolean;
}

export function MonthSelector({ showTodayButton = true }: MonthSelectorProps) {
  const { label, goToPrevMonth, goToNextMonth, goToCurrentMonth, isCurrentMonth } = useSelectedDate();

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-1 rounded-full bg-card/70 border border-border/60 shadow-soft backdrop-blur px-1.5 py-1">
        <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-full h-9 w-9" aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-[140px] text-center text-sm font-semibold first-letter:uppercase sm:text-base">
          {label}
        </span>
        <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-full h-9 w-9" aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {showTodayButton && !isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          onClick={goToCurrentMonth}
          className="mt-0.5 h-6 px-3 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-full transition-all"
        >
          Hoje
        </Button>
      )}
    </div>
  );
}
