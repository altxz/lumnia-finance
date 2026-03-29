import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';

interface SnapshotRow {
  date: string;
  total_assets: number;
  total_liabilities: number;
}

export function NetWorthChart() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 12);

      const { data: rows } = await supabase
        .from('net_worth_history')
        .select('date, total_assets, total_liabilities')
        .eq('user_id', user.id)
        .gte('date', fromDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      const chartData = (rows || []).map((r: SnapshotRow) => {
        const d = new Date(r.date + 'T12:00:00');
        return {
          label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          assets: r.total_assets,
          liabilities: r.total_liabilities,
          netWorth: r.total_assets - r.total_liabilities,
        };
      });
      setData(chartData);
      setLoading(false);
    })();
  }, [user]);

  if (loading || data.length === 0) return null;

  return (
    <Card className="rounded-2xl border-border/50 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Evolução do Património Líquido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'assets' ? 'Ativos' : name === 'liabilities' ? 'Passivos' : 'Patrimônio Líquido',
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '13px',
              }}
            />
            <Area type="monotone" dataKey="assets" stroke="#22c55e" fill="url(#assetGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="liabilities" stroke="#ef4444" fill="url(#liabGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="netWorth" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
