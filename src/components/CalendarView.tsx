import { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { Clock, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Wallet } from 'lucide-react';
import type { Expense } from '@/components/ExpenseTable';

export function CalendarView() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear, startDate, endDate } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [walletMap, setWalletMap] = useState<Record<string, string>>({});

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });
    setExpenses(data || []);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('id, name').eq('user_id', user.id)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data || []).forEach(w => { m[w.id] = w.name; });
        setWalletMap(m);
      });
  }, [user]);

  // Group expenses by date string
  const byDate = useMemo(() => {
    const map: Record<string, { income: number; expense: number; items: Expense[] }> = {};
    expenses.forEach(exp => {
      if (!map[exp.date]) map[exp.date] = { income: 0, expense: 0, items: [] };
      map[exp.date].items.push(exp);
      if (exp.type === 'transfer') return;
      if (exp.type === 'income') map[exp.date].income += exp.value;
      else map[exp.date].expense += exp.value;
    });
    return map;
  }, [expenses]);

  const calendarMonth = new Date(selectedYear, selectedMonth);

  const selectedDayStr = selectedDay
    ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`
    : null;

  const dayTransactions = selectedDayStr ? (byDate[selectedDayStr]?.items || []) : [];

  const handleDayClick = (day: Date | undefined) => {
    if (!day) return;
    setSelectedDay(day);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDay}
          onSelect={handleDayClick}
          month={calendarMonth}
          className="p-3 pointer-events-auto"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4 w-full",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "hidden",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center",
            row: "flex w-full mt-1",
            cell: "flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: "mx-auto h-14 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-muted rounded-lg transition-colors flex flex-col items-center justify-start pt-1.5 gap-0.5",
            day_selected: "bg-primary/10 text-primary font-semibold",
            day_today: "bg-accent text-accent-foreground font-bold",
            day_outside: "text-muted-foreground opacity-40",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
          components={{
            DayContent: ({ date }) => {
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const info = byDate[dateStr];
              return (
                <div className="flex flex-col items-center gap-0.5">
                  <span>{date.getDate()}</span>
                  {info && (
                    <div className="flex items-center gap-0.5">
                      {info.income > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {info.expense > 0 && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                    </div>
                  )}
                </div>
              );
            },
            IconLeft: () => null,
            IconRight: () => null,
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Receita
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          Despesa
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDay
                ? selectedDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' })
                : 'Transações'}
            </SheetTitle>
            <SheetDescription>
              {dayTransactions.length === 0
                ? 'Nenhuma transação neste dia.'
                : `${dayTransactions.length} transação(ões)`}
            </SheetDescription>
          </SheetHeader>

          {dayTransactions.length > 0 && (
            <div className="mt-4 divide-y divide-border">
              {dayTransactions.map(exp => {
                const catInfo = getCategoryInfo(exp.final_category);
                const isIncome = exp.type === 'income';
                const isTransfer = exp.type === 'transfer';
                const isPending = !exp.is_paid;
                const walletName = exp.wallet_id ? walletMap[exp.wallet_id] : null;

                return (
                  <div key={exp.id} className="flex items-center gap-3 py-3 px-1">
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      isIncome ? 'bg-emerald-500/15' : isTransfer ? 'bg-primary/15' : 'bg-destructive/15'
                    }`}>
                      {isIncome ? (
                        <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                      ) : isTransfer ? (
                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exp.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{catInfo.label}</span>
                        {walletName && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Wallet className="h-3 w-3" />
                              {walletName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {isPending && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={`text-sm font-bold ${
                        isPending ? 'text-muted-foreground'
                          : isIncome ? 'text-emerald-600'
                          : isTransfer ? 'text-foreground'
                          : 'text-destructive'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(exp.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
