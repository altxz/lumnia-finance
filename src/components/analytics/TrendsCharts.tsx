import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { MonthlyData } from '@/hooks/useAnalyticsData';
import { InfoPopover } from '@/components/ui/info-popover';

const AREA_COLORS = [
  'hsl(245, 45%, 51%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(40, 90%, 55%)',
  'hsl(0, 84%, 60%)',
  'hsl(190, 80%, 45%)',
  'hsl(220, 14%, 60%)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg border border-white/10" style={{ background: 'rgba(30,30,40,0.92)', backdropFilter: 'blur(8px)' }}>
      <p className="text-xs font-medium text-white/70 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color || '#fff' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

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
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Evolução Mensal + Projeção</CardTitle>
            <InfoPopover><p>Acompanhe a evolução dos seus gastos mês a mês com projeção do próximo período.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          {lineData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(280, 60%, 55%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" name="Total" stroke="url(#lineGrad)" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Dados insuficientes</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Evolução por Categoria</CardTitle>
            <InfoPopover><p>Veja como cada categoria de gasto evoluiu ao longo dos meses.</p></InfoPopover>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          {areaData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={areaData}>
                <defs>
                  {allCategories.map((cat, i) => (
                    <linearGradient key={cat} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AREA_COLORS[i % AREA_COLORS.length]} stopOpacity={0.7} />
                      <stop offset="100%" stopColor={AREA_COLORS[i % AREA_COLORS.length]} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                {allCategories.map((cat, i) => (
                  <Area key={cat} type="monotone" dataKey={cat} stackId="1" fill={`url(#areaGrad${i})`} stroke={AREA_COLORS[i % AREA_COLORS.length]} strokeWidth={1.5} fillOpacity={1} />
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
