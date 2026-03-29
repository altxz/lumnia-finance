import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';

export function EndOfMonthForecast() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear, startDate, endDate } = useSelectedDate();
  const [wallets, setWallets] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [monthTxns, setMonthTxns] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [unpaidCredit, setUnpaidCredit] = useState<any[]>([]);

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [w, all, month, rec, cc, uc] = await Promise.all([
        supabase.from('wallets').select('initial_balance').eq('user_id', user.id),
        supabase.from('expenses').select('value, type, credit_card_id, date').eq('user_id', user.id).eq('is_paid', true),
        supabase.from('expenses').select('value, type, credit_card_id, date').eq('user_id', user.id).gte('date', startDate).lt('date', endDate).neq('type', 'transfer'),
        supabase.from('expenses').select('value, type, date, credit_card_id').eq('user_id', user.id).eq('is_recurring', true),
        supabase.from('credit_cards').select('id, due_day').eq('user_id', user.id),
        supabase.from('expenses').select('value, credit_card_id').eq('user_id', user.id).eq('is_paid', false).not('credit_card_id', 'is', null).eq('invoice_month', monthKey),
      ]);
      setWallets(w.data || []);
      setAllTxns(all.data || []);
      setMonthTxns(month.data || []);
      setRecurring(rec.data || []);
      setCreditCards(cc.data || []);
      setUnpaidCredit(uc.data || []);
    })();
  }, [user, startDate, endDate, monthKey]);

  const today = new Date();
  const todayDay = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear ? today.getDate() : 1;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const chartData = useMemo(() => {
    // Current real balance
    const walletsTotal = wallets.reduce((s, w: any) => s + (w.initial_balance || 0), 0);
    let realBalance = walletsTotal;
    allTxns.forEach((t: any) => {
      if (t.type === 'transfer') return;
      if (t.type === 'income') realBalance += t.value;
      else if (!t.credit_card_id) realBalance -= t.value;
    });

    // Build daily projection from today to end of month
    const points: { day: number; saldo: number }[] = [];
    let balance = realBalance;
    points.push({ day: todayDay, saldo: balance });

    // Map future recurring
    const futureByDay: Record<number, number> = {};
    recurring.forEach((r: any) => {
      if (r.type === 'transfer') return;
      const d = Math.min(new Date(r.date + 'T12:00:00').getDate(), daysInMonth);
      if (d <= todayDay) return;
      const val = r.type === 'income' ? r.value : (r.credit_card_id ? 0 : -r.value);
      futureByDay[d] = (futureByDay[d] || 0) + val;
    });

    // Credit card bills
    const billByCard: Record<string, number> = {};
    unpaidCredit.forEach((e: any) => { billByCard[e.credit_card_id] = (billByCard[e.credit_card_id] || 0) + e.value; });
    creditCards.forEach((c: any) => {
      const due = Math.min(c.due_day || 10, daysInMonth);
      if (due > todayDay && billByCard[c.id]) {
        futureByDay[due] = (futureByDay[due] || 0) - billByCard[c.id];
      }
    });

    for (let d = todayDay + 1; d <= daysInMonth; d++) {
      balance += (futureByDay[d] || 0);
      points.push({ day: d, saldo: Math.round(balance * 100) / 100 });
    }

    return points;
  }, [wallets, allTxns, recurring, creditCards, unpaidCredit, todayDay, daysInMonth]);

  const endBalance = chartData[chartData.length - 1]?.saldo || 0;

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Previsão Fim de Mês</CardTitle>
          <span className={`text-sm font-bold ${endBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{formatCurrency(endBalance)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Dia ${l}`} />
            <ReferenceDot x={todayDay} y={chartData[0]?.saldo || 0} r={5} fill="hsl(var(--primary))" stroke="none" />
            <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
