import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function IncomeVsExpenseChart() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 5);
      from.setDate(1);
      const { data: txns } = await supabase
        .from('expenses')
        .select('date, value, type, credit_card_id')
        .eq('user_id', user.id)
        .gte('date', from.toISOString().split('T')[0])
        .neq('type', 'transfer');

      const map: Record<string, { receitas: number; despesas: number }> = {};
      (txns || []).forEach((t: any) => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map[key]) map[key] = { receitas: 0, despesas: 0 };
        if (t.type === 'income') map[key].receitas += t.value;
        else if (!t.credit_card_id) map[key].despesas += t.value;
      });

      const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      setData(
        Object.entries(map)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => {
            const [, m] = k.split('-');
            return { name: months[parseInt(m) - 1], ...v };
          })
      );
    })();
  }, [user]);

  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Receitas vs Despesas (6 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
