import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { ChartSkeleton } from '@/components/ui/loading-state';
import { chartAxisProps, chartGridProps } from '@/components/ui/chart';

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

  if (loading) {
    return <Card className="h-full min-h-[300px] rounded-2xl"><ChartSkeleton /></Card>;
  }

  if (data.length === 0) return null;

  return (
    <Card className="rounded-2xl border-border/50 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Evolução do Património Líquido
          </CardTitle>
          <InfoPopover><p>Seu patrimônio líquido ao longo dos meses (Tudo que você tem menos tudo que você deve).</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                 <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                 <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'assets' ? 'Ativos' : name === 'liabilities' ? 'Passivos' : 'Patrimônio Líquido',
              ]}
              contentStyle={{
                borderRadius: '16px',
                border: '1px solid hsl(var(--glass-border))',
                background: 'hsl(var(--popover) / 0.88)',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: 'var(--shadow-float)',
              }}
            />
            <Area type="monotone" dataKey="assets" stroke="hsl(var(--success))" fill="url(#assetGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="liabilities" stroke="hsl(var(--destructive))" fill="url(#liabGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="netWorth" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
