import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { ChartSkeleton } from '@/components/ui/loading-state';
import { chartAxisProps, chartGridProps } from '@/components/ui/chart';

interface SnapshotRow {
  date: string;
  total_assets: number;
  total_liabilities: number;
}

interface NetWorthPoint {
  date: string;
  label: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

const compactCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'BRL',
}).format(value);

const formatSnapshotDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Histórico de patrimônio baseado somente nos snapshots persistidos.
 * Não estima meses ausentes nem mistura saldo corrente com a série histórica.
 */
export function NetWorthChart() {
  const { user } = useAuth();
  const [data, setData] = useState<NetWorthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 12);

    const { data: rows, error } = await supabase
      .from('net_worth_history')
      .select('date, total_assets, total_liabilities')
      .eq('user_id', user.id)
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      setData([]);
      setErrorMessage('Não foi possível carregar o histórico patrimonial agora.');
      setLoading(false);
      return;
    }

    setData((rows || []).map((row: SnapshotRow) => {
      const date = new Date(`${row.date}T12:00:00`);
      const assets = Number(row.total_assets) || 0;
      const liabilities = Number(row.total_liabilities) || 0;
      return {
        date: row.date,
        label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        assets,
        liabilities,
        netWorth: assets - liabilities,
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const hasTimeline = data.length >= 2;
  const latestLabel = useMemo(() => (latest ? formatSnapshotDate(latest.date) : null), [latest]);

  if (loading) {
    return <Card className="min-h-[300px] rounded-3xl border-border/70"><ChartSkeleton /></Card>;
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-border/70 bg-card">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="break-words text-lg font-semibold">Evolução patrimonial</CardTitle>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
              Ativos menos passivos, a partir dos registros históricos disponíveis.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Histórico indisponível</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-xl" onClick={() => void loadHistory()}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : !latest ? (
          <div className="rounded-2xl border border-dashed border-border p-5">
            <p className="font-medium">Ainda não há histórico patrimonial</p>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
              O primeiro registro aparecerá quando um snapshot de ativos e passivos for salvo.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">Patrimônio líquido registrado</p>
              <p className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                {formatCurrency(latest.netWorth)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Último registro: {latestLabel}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs font-medium text-muted-foreground">Ativos</p>
                <p className="mt-1 break-words text-lg font-semibold text-foreground">{formatCurrency(latest.assets)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs font-medium text-muted-foreground">Passivos</p>
                <p className="mt-1 break-words text-lg font-semibold text-foreground">{formatCurrency(latest.liabilities)}</p>
              </div>
            </div>

            {hasTimeline ? (
              <div className="h-56 min-w-0 sm:h-64" aria-label="Gráfico de evolução do patrimônio líquido">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netWorthArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="4%" stopColor="hsl(var(--primary))" stopOpacity={0.24} />
                        <stop offset="96%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis {...chartAxisProps} width={56} tickFormatter={compactCurrency} />
                    <Tooltip
                      cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.22 }}
                      formatter={(value: number) => [formatCurrency(value), 'Patrimônio líquido']}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ? formatSnapshotDate(payload[0].payload.date) : ''}
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: '12px',
                        boxShadow: 'var(--shadow-float)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="netWorth"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      fill="url(#netWorthArea)"
                      activeDot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
                Há um registro histórico disponível. A curva aparecerá quando houver pelo menos dois registros.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
