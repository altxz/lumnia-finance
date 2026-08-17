import { useMemo } from 'react';
import { getCategoryLabel, formatCurrency } from '@/lib/constants';
import { useAnomalyComparison } from '@/hooks/useAnomalyComparison';
import type { SmartAlert } from '@/components/SmartAlertsCarousel';

export function useAnomalyAlerts(): SmartAlert[] {
  const rows = useAnomalyComparison();

  return useMemo(() => {
    const results: SmartAlert[] = [];

    rows.forEach(({ category, current, previous, pctChange }) => {
      const label = getCategoryLabel(category);

      if (pctChange > 30) {
        results.push({
          id: `anomaly-up-${category}`,
          type: 'critical',
          icon: 'alert',
          title: `Aumento em ${label}`,
          description: `+${Math.round(pctChange)}% vs mês anterior (${formatCurrency(previous)} → ${formatCurrency(current)})`,
        });
      } else if (pctChange < -20) {
        results.push({
          id: `anomaly-down-${category}`,
          type: 'positive',
          icon: 'trophy',
          title: `Economia em ${label}`,
          description: `${Math.abs(Math.round(pctChange))}% a menos (${formatCurrency(previous)} → ${formatCurrency(current)})`,
        });
      }
    });

    results.sort((a, b) => {
      if (a.type === 'critical' && b.type !== 'critical') return -1;
      if (a.type !== 'critical' && b.type === 'critical') return 1;
      return 0;
    });

    return results.slice(0, 5);
  }, [rows]);
}
