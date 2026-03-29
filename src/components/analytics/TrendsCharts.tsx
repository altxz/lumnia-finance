import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { MonthlyData } from '@/hooks/useAnalyticsData';
import { CATEGORIES } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

const AREA_COLORS = ['hsl(245, 45%, 51%)', 'hsl(80, 80%, 50%)', 'hsl(280, 94%, 68%)', 'hsl(230, 96%, 64%)', 'hsl(0, 84%, 60%)', 'hsl(40, 90%, 55%)', 'hsl(170, 70%, 45%)'];

interface Props {
  monthlyData: MonthlyData[];
  predictedNextMonth: number;
}

export function TrendsCharts({ monthlyData, predictedNextMonth }: Props) {
  const lineData = [
    ...monthlyData.map(m => ({ name: m.label, total: Math.round(m.total) })),
    ...(monthlyData.length > 0
      ? [{ name: 'Previsão', total: predictedNextMonth }]
      : []),
  ];

  const allCategories = [...new Set(monthlyData.flatMap(m => Object.keys(m.byCategory)))];
  const areaData = monthlyData.map(m => {
    const row: Record<string, any> = { name: m.label };
    allCategories.forEach(c => { row[c] = Math.round(m.byCategory[c] || 0); });
    return row;
  });

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Evolução Mensal + Projeção</CardTitle>
            <InfoPopover><p>Acompanhe a evolução dos seus gastos mês a mês com projeção do próximo período.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          {lineData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(250, 25%, 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="total" stroke="hsl(245, 45%, 51%)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Dados insuficientes</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Evolução por Categoria</CardTitle>
            <InfoPopover><p>Veja como cada categoria de gasto evoluiu ao longo dos meses.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent>
          {areaData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(250, 25%, 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                {allCategories.slice(0, 7).map((cat, i) => (
                  <Area key={cat} type="monotone" dataKey={cat} stackId="1" fill={AREA_COLORS[i % AREA_COLORS.length]} stroke={AREA_COLORS[i % AREA_COLORS.length]} fillOpacity={0.6} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Dados insuficientes</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
