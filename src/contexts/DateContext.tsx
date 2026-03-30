import { createContext, useContext, useState, ReactNode } from 'react';

interface DateContextType {
  selectedMonth: number; // 0-11
  selectedYear: number;
  /** 'YYYY-MM-01' string for DB queries */
  monthKey: string;
  /** Start of month ISO date */
  startDate: string;
  /** Start of next month ISO date */
  endDate: string;
  /** Formatted label like 'Março 2026' */
  label: string;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  isCurrentMonth: boolean;
}

const DateContext = createContext<DateContextType | null>(null);

export function DateProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const goToPrevMonth = () => {
    setMonth(prev => {
      if (prev === 0) { setYear(y => y - 1); return 11; }
      return prev - 1;
    });
  };

  const goToNextMonth = () => {
    setMonth(prev => {
      if (prev === 11) { setYear(y => y + 1); return 0; }
      return prev + 1;
    });
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setMonth(today.getMonth());
    setYear(today.getFullYear());
  };

  const isCurrentMonth = month === new Date().getMonth() && year === new Date().getFullYear();

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  
  const nextM = month === 11 ? 0 : month + 1;
  const nextY = month === 11 ? year + 1 : year;
  const endDate = `${nextY}-${String(nextM + 1).padStart(2, '0')}-01`;

  const label = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <DateContext.Provider value={{ selectedMonth: month, selectedYear: year, monthKey, startDate, endDate, label, goToPrevMonth, goToNextMonth, goToCurrentMonth, isCurrentMonth }}>
      {children}
    </DateContext.Provider>
  );
}

export function useSelectedDate() {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error('useSelectedDate must be inside DateProvider');
  return ctx;
}
