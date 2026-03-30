import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelectedDate } from '@/contexts/DateContext';

export function MonthSelector() {
  const { label, goToPrevMonth, goToNextMonth, goToCurrentMonth, isCurrentMonth } = useSelectedDate();

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl h-9 w-9">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm sm:text-base font-semibold capitalize min-w-[140px] text-center">
          {label}
        </span>
        <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl h-9 w-9">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {!isCurrentMonth && (
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
