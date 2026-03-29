import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { InfoPopover } from '@/components/ui/info-popover';

export function IncomeVsExpenseChart() {
  const { user } = useAuth();
  const { startDate, endDate } = useSelectedDate();
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('expenses')
        .select('date, value, type, credit_card_id, final_category')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate)
        .neq('type', 'transfer');
      setTxns(data || []);
    })();
  }, [user, startDate, endDate]);

  const data = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    txns.forEach((t: any) => {
      if (t.type === 'income') receitas += t.value;
      else despesas += t.value;
    });
    return [{ name: 'Mês Atual', receitas, despesas }];
  }, [txns]);

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Receita vs Despesas</CardTitle>
          <InfoPopover><p>Comparação direta entre o volume total de dinheiro que entrou e o que saiu.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8} barSize={60}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
