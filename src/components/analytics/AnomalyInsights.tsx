import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from 'lucide-react';
import { getCategoryLabel, formatCurrency } from '@/lib/constants';
import { useAnomalyComparison } from '@/hooks/useAnomalyComparison';

interface Insight {
  category: string;
  label: string;
  currentAmount: number;
  prevAmount: number;
  pctChange: number;
  type: 'alert' | 'celebration';
}

export function AnomalyInsights() {
  const rows = useAnomalyComparison();

  const insights = useMemo(() => {
    const results: Insight[] = [];

    rows.forEach(({ category, current, previous, pctChange }) => {
      const label = getCategoryLabel(category);
      if (pctChange > 30) {
        results.push({ category, label, currentAmount: current, prevAmount: previous, pctChange: Math.round(pctChange), type: 'alert' });
      } else if (pctChange < -20) {
        results.push({ category, label, currentAmount: current, prevAmount: previous, pctChange: Math.round(pctChange), type: 'celebration' });
      }
    });

    results.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
    return results.slice(0, 5);
  }, [rows]);

  if (insights.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map(i => (
        <Card
          key={i.category}
          className={`rounded-2xl border-border/50 ${
            i.type === 'alert'
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-emerald-500/5 border-emerald-500/20'
          }`}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              i.type === 'alert' ? 'bg-destructive/15' : 'bg-emerald-500/15'
            }`}>
              {i.type === 'alert'
                ? <AlertTriangle className="h-4 w-4 text-destructive" />
                : <Trophy className="h-4 w-4 text-emerald-500" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">
                {i.type === 'alert' ? (
                  <>
                    <span className="font-bold text-destructive">Aumento atípico:</span>{' '}
                    Você gastou <span className="font-bold">{i.pctChange}%</span> a mais em{' '}
                    <span className="font-semibold">{i.label}</span> comparado ao mês passado.
                  </>
                ) : (
                  <>
                    <span className="font-bold text-emerald-600">Você está economizando!</span>{' '}
                    Gastou <span className="font-bold">{Math.abs(i.pctChange)}%</span> a menos em{' '}
                    <span className="font-semibold">{i.label}</span> este mês.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                {i.type === 'alert'
                  ? <TrendingUp className="h-3 w-3 text-destructive" />
                  : <TrendingDown className="h-3 w-3 text-emerald-500" />
                }
                <span>{formatCurrency(i.prevAmount)} → {formatCurrency(i.currentAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
