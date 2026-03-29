import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function CreditUsageChart() {
  const { user } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [unpaid, setUnpaid] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: c }, { data: u }] = await Promise.all([
        supabase.from('credit_cards').select('id, name, limit_amount').eq('user_id', user.id),
        supabase.from('expenses').select('value, credit_card_id').eq('user_id', user.id).eq('is_paid', false).not('credit_card_id', 'is', null),
      ]);
      setCards(c || []);
      setUnpaid(u || []);
    })();
  }, [user]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142, 71%, 45%)', 'hsl(var(--accent))'];

  const data = useMemo(() => {
    const usedByCard: Record<string, number> = {};
    unpaid.forEach((e: any) => {
      usedByCard[e.credit_card_id] = (usedByCard[e.credit_card_id] || 0) + e.value;
    });
    return cards.map((c, i) => ({
      name: c.name,
      used: usedByCard[c.id] || 0,
      limit: c.limit_amount,
      pct: c.limit_amount > 0 ? Math.round(((usedByCard[c.id] || 0) / c.limit_amount) * 100) : 0,
      fill: COLORS[i % COLORS.length],
    }));
  }, [cards, unpaid]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Uso de Cartão de Crédito</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Nenhum cartão</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Uso de Cartão de Crédito</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={data} startAngle={180} endAngle={0}>
            <RadialBar dataKey="pct" background cornerRadius={6} label={{ position: 'insideStart', fill: '#fff', fontSize: 10, formatter: (v: number) => `${v}%` }} />
            <Tooltip formatter={(v: number, name: string, entry: any) => [`${v}% (${formatCurrency(entry.payload.used)} / ${formatCurrency(entry.payload.limit)})`, entry.payload.name]} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} formatter={(_, entry: any) => entry?.payload?.name || ''} />
          </RadialBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
