import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { InfoPopover } from '@/components/ui/info-popover';
import { getPaymentDate } from '@/lib/invoiceHelpers';
import type { CreditCard } from '@/lib/invoiceHelpers';

interface Props {
  expenses: any[];
  creditCards?: CreditCard[];
}

export function DailySpendingChart({ expenses, creditCards = [] }: Props) {
  const { selectedMonth, selectedYear } = useSelectedDate();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const data = useMemo(() => {
    const byDay: Record<number, number> = {};

    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;

      if (e.credit_card_id) {
        // CC expense: show on due date day if it falls in this month
        const card = creditCards.find(c => c.id === e.credit_card_id);
        if (!card) return;

        let effectiveMonth: string;
        if (e.invoice_month) {
          effectiveMonth = e.invoice_month;
        } else {
          const payDate = getPaymentDate(e.date, card);
          effectiveMonth = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;
        }

        const currentKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        if (effectiveMonth !== currentKey) return;

        // Place on due day
        const dueDay = Math.min(card.due_day, daysInMonth);
        byDay[dueDay] = (byDay[dueDay] || 0) + e.value;
      } else {
        // Debit/Pix: show on transaction date
        const d = new Date(e.date + 'T12:00:00');
        if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;
        const day = d.getDate();
        byDay[day] = (byDay[day] || 0) + e.value;
      }
    });

    const points: { day: number; gasto: number; media: number }[] = [];
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      total += byDay[d] || 0;
      points.push({ day: d, gasto: byDay[d] || 0, media: Math.round((total / d) * 100) / 100 });
    }
    return points;
  }, [expenses, creditCards, daysInMonth, selectedMonth, selectedYear]);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Média Diária de Gastos</CardTitle>
          <InfoPopover><p>Seu ritmo de gasto dia a dia. Despesas de cartão aparecem como pico no dia de vencimento da fatura.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={Math.floor(daysInMonth / 8)} />
            <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Dia ${l}`} />
            <Area type="monotone" dataKey="gasto" name="Gasto" stroke="hsl(var(--muted-foreground))" strokeWidth={1} fill="url(#gradDaily)" dot={false} />
            <Area type="monotone" dataKey="media" name="Média" stroke="hsl(var(--primary))" strokeWidth={2} fill="none" dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
