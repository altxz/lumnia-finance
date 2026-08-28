import { useMemo } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { seriesColor } from '@/lib/chartPalette';
import { useIsMobile } from '@/hooks/use-mobile';
import { transactionAmount } from '@/lib/transactionAmount';

interface Props {
  expenses: any[];
  categories: any[];
}

interface Slice {
  name: string;
  value: number;
  color: string;
}

export function SubcategoryBreakdown({ expenses }: Props) {
  const isMobile = useIsMobile();
  const limit = isMobile ? 5 : 6;

  const { slices, total } = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (e.description?.startsWith('Pagamento fatura')) return;
      if (isBalanceAdjustment(e)) return;
      const key = e.final_category || 'Sem categoria';
      map[key] = (map[key] || 0) + transactionAmount(e.value);
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const sum = sorted.reduce((acc, [, v]) => acc + v, 0);

    const top: Slice[] = sorted.slice(0, limit).map(([cat, value], i) => ({
      name: cat,
      value,
      color: seriesColor(i),
    }));

    const restValue = sorted.slice(limit).reduce((acc, [, v]) => acc + v, 0);
    if (restValue > 0) {
      top.push({ name: 'Outras', value: restValue, color: 'hsl(var(--muted-foreground))' });
    }

    return { slices: top, total: sum };
  }, [expenses, limit]);

  if (slices.length === 0 || total <= 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Subcategorias Detalhadas</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground pb-4">
          Sem dados
        </CardContent>
      </Card>
    );
  }

  const maxValue = slices.reduce((max, s) => Math.max(max, s.value), 0);

  return (
    <Card className="rounded-2xl border-0 shadow-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">Subcategorias Detalhadas</CardTitle>
            <InfoPopover>
              <p>
                Participação de cada subcategoria no total de gastos do período. A barra do topo mostra
                a divisão do total; a lista traz valor e percentual de cada uma.
              </p>
            </InfoPopover>
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pb-4 px-4 flex flex-col gap-3">
        {/* Barra de participação (100%) */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          {slices.map((s) => (
            <div
              key={`seg-${s.name}`}
              className="h-full transition-all duration-500"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: s.color,
              }}
              title={`${s.name}: ${formatCurrency(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}
            />
          ))}
        </div>

        {/* Ranking */}
        <div className="flex-1 min-h-0 flex flex-col justify-around gap-2">
          {slices.map((s, index) => {
            const pct = (s.value / total) * 100;
            const width = maxValue > 0 ? Math.max((s.value / maxValue) * 100, 4) : 0;
            return (
              <div
                key={s.name}
                className="min-w-0"
                title={`${s.name}: ${formatCurrency(s.value)} (${pct.toFixed(1)}%)`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(s.value)}
                  </span>
                  <span className="shrink-0 w-11 text-right text-[11px] tabular-nums text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${width}%`,
                      backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${s.color} 55%, transparent), ${s.color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
