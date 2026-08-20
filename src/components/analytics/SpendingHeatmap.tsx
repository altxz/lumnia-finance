import { useMemo, useState } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import type { Expense } from '@/components/ExpenseTable';
import { InfoPopover } from '@/components/ui/info-popover';

interface SpendingHeatmapProps {
  expenses: Expense[];
}

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function SpendingHeatmap({ expenses }: SpendingHeatmapProps) {
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [view, setView] = useState<'daily' | 'weekly'>('daily');

  const { days, maxSpend, weekdays, maxWeekdaySpend } = useMemo(() => {
    const m = selectedMonth;
    const y = selectedYear;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const byDay: Record<number, number> = {};
    const byWeekday: number[] = Array(7).fill(0);
    const countWeekday: number[] = Array(7).fill(0);

    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (isBalanceAdjustment(e)) return;
      if (e.credit_card_id) return;
      const d = new Date(e.date + 'T12:00:00');
      if (d.getMonth() === m && d.getFullYear() === y) {
        const day = d.getDate();
        byDay[day] = (byDay[day] || 0) + e.value;
        byWeekday[d.getDay()] += e.value;
      }
    });

    for (let i = 1; i <= daysInMonth; i++) {
      countWeekday[new Date(y, m, i).getDay()] += 1;
    }

    const max = Math.max(...Object.values(byDay), 1);
    const result = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      spend: byDay[i + 1] || 0,
    }));

    const weekdayResult = byWeekday.map((spend, i) => ({
      weekday: i,
      spend,
      average: countWeekday[i] > 0 ? spend / countWeekday[i] : 0,
    }));

    return {
      days: result,
      maxSpend: max,
      weekdays: weekdayResult,
      maxWeekdaySpend: Math.max(...byWeekday, 1),
    };
  }, [expenses, selectedMonth, selectedYear]);


  const getIntensity = (spend: number, max: number): string => {
    if (spend === 0) return 'bg-muted/40';
    const ratio = spend / max;
    if (ratio < 0.2) return 'bg-destructive/15';
    if (ratio < 0.4) return 'bg-destructive/30';
    if (ratio < 0.6) return 'bg-destructive/50';
    if (ratio < 0.8) return 'bg-destructive/70';
    return 'bg-destructive/90';
  };

  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  // Pad start to align with weekday (0=Sun)
  const firstDayWeekday = new Date(selectedYear, selectedMonth, 1).getDay();

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Mapa de Gastos</CardTitle>
            <InfoPopover>
              <p>Calendário de calor onde os dias com cores mais escuras representam maiores gastos. Use a visão semanal para ver quais dias da semana concentram mais gastos no mês.</p>
            </InfoPopover>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5">
            {([['daily', 'Diário'], ['weekly', 'Semanal']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {view === 'weekly' ? (
          <div className="space-y-2">
            {weekdays.map(({ weekday, spend, average }) => (
              <div key={weekday} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-muted-foreground font-medium">
                  {WEEKDAY_LABEL[weekday].slice(0, 3)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden cursor-default">
                      <div
                        className={`h-full rounded-md transition-all ${getIntensity(spend, maxWeekdaySpend)}`}
                        style={{ width: `${Math.max((spend / maxWeekdaySpend) * 100, spend > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{WEEKDAY_LABEL[weekday]}</p>
                    <p className={spend > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                      {spend > 0 ? `-${formatCurrency(spend)}` : 'Sem gastos'}
                    </p>
                    {spend > 0 && (
                      <p className="text-muted-foreground">Média por dia: {formatCurrency(average)}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
                <span className="w-20 shrink-0 text-right text-[11px] font-medium tabular-nums">
                  {spend > 0 ? formatCurrency(spend) : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
        <>
        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_SHORT.map((d, i) => (
            <span key={i} className="text-[10px] text-muted-foreground text-center font-medium">{d}</span>
          ))}
        </div>


        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {days.map(({ day, spend }) => (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div
                  className={`aspect-square rounded-sm cursor-default transition-colors ${getIntensity(spend, maxSpend)} ${
                    day === todayDay ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">Dia {day}</p>
                <p className={spend > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                  {spend > 0 ? `-${formatCurrency(spend)}` : 'Sem gastos'}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-3">
          <span className="text-[10px] text-muted-foreground">Menos</span>
          <div className="w-3 h-3 rounded-sm bg-muted/40" />
          <div className="w-3 h-3 rounded-sm bg-destructive/15" />
          <div className="w-3 h-3 rounded-sm bg-destructive/30" />
          <div className="w-3 h-3 rounded-sm bg-destructive/50" />
          <div className="w-3 h-3 rounded-sm bg-destructive/70" />
          <div className="w-3 h-3 rounded-sm bg-destructive/90" />
          <span className="text-[10px] text-muted-foreground">Mais</span>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
