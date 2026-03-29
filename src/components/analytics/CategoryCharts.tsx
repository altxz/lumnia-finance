import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getCategoryInfo, formatCurrency } from '@/lib/constants';
import { CategoryStats } from '@/hooks/useAnalyticsData';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';

const COLORS = ['hsl(245, 45%, 51%)', 'hsl(80, 80%, 50%)', 'hsl(280, 94%, 68%)', 'hsl(230, 96%, 64%)', 'hsl(0, 84%, 60%)', 'hsl(40, 90%, 55%)', 'hsl(170, 70%, 45%)'];

interface Props {
  categoryStats: CategoryStats[];
  compare: boolean;
}

export function CategoryCharts({ categoryStats, compare }: Props) {
  const pieData = categoryStats.slice(0, 7).map(s => ({
    name: getCategoryInfo(s.category).label,
    value: Math.round(s.total),
  }));

  const barData = categoryStats.slice(0, 10).map(s => ({
    name: getCategoryInfo(s.category).label,
    atual: Math.round(s.total),
    ...(compare ? { anterior: Math.round(s.previousTotal) } : {}),
  }));

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-md">
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

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Top Categorias</CardTitle>
            <InfoPopover><p>Ranking das categorias com maior volume de gastos em barras horizontais.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
               <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                 <XAxis type="number" tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} tick={{ fontSize: 9 }} />
                 <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="atual" fill="hsl(245, 45%, 51%)" radius={[0, 6, 6, 0]} barSize={16} />
                {compare && <Bar dataKey="anterior" fill="hsl(245, 45%, 51%, 0.3)" radius={[0, 6, 6, 0]} barSize={16} />}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md lg:col-span-2">
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
