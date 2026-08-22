import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { getCategoryInfo, getCategoryLabel, formatCurrency } from '@/lib/constants';
import { CategoryStats } from '@/hooks/useAnalyticsData';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-4))', 'hsl(var(--chart-3))', 'hsl(var(--chart-6))', 'hsl(var(--destructive))', 'hsl(var(--accent))', 'hsl(var(--chart-8))'];

interface Props {
  categoryStats: CategoryStats[];
  compare: boolean;
}

export function CategoryCharts({ categoryStats, compare }: Props) {
  const { user } = useAuth();
  const { startDate } = useSelectedDate();
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({});

  // Fetch budgets for the current month to overlay on chart
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('budgets')
        .select('category, allocated_amount')
        .eq('user_id', user.id)
        .eq('month_year', startDate);
      const map: Record<string, number> = {};
      (data || []).forEach((b: any) => {
        if (b.category && b.allocated_amount > 0) map[b.category] = b.allocated_amount;
      });
      setBudgetMap(map);
    })();
  }, [user, startDate]);

  const pieData = categoryStats.slice(0, 7).map(s => ({
    name: getCategoryLabel(s.category),
    value: Math.round(s.total),
  }));

  const barData = categoryStats.slice(0, 10).map(s => {
    const label = getCategoryLabel(s.category);
    return {
      name: label,
      atual: Math.round(s.total),
      orcamento: budgetMap[s.category] || budgetMap[label] || 0,
      ...(compare ? { anterior: Math.round(s.previousTotal) } : {}),
    };
  });

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Distribuição por Categoria</CardTitle>
            <InfoPopover><p>Gráfico de pizza mostrando a proporção de cada categoria no total de gastos.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Gasto vs Orçamento</CardTitle>
            <InfoPopover><p>Comparação entre o gasto real e a meta de orçamento por categoria. A barra cinza representa o orçamento definido.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }} />
                <Bar dataKey="orcamento" fill="hsl(var(--muted-foreground))" fillOpacity={0.3} radius={[0, 8, 8, 0]} barSize={16} name="Orçamento" />
                <Bar dataKey="atual" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} barSize={16} name="Gasto" />
                {compare && <Bar dataKey="anterior" fill="hsl(var(--primary) / 0.3)" radius={[0, 8, 8, 0]} barSize={16} name="Anterior" />}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-card lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Alertas por Categoria</CardTitle>
            <InfoPopover><p>Variações significativas nos gastos por categoria comparadas ao período anterior.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {categoryStats.slice(0, 6).map(s => {
              const info = getCategoryInfo(s.category);
              const Icon = s.change > 5 ? TrendingUp : s.change < -5 ? TrendingDown : Minus;
              const variant = s.change > 5 ? 'destructive' : 'secondary';
              return (
                <Badge key={s.category} variant={variant as any} className="px-3 py-2 gap-2 rounded-xl text-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {info.label} {s.change !== 0 ? `${s.change > 0 ? '+' : ''}${s.change.toFixed(0)}%` : 'estável'}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
