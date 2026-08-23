/**
 * Paleta oficial dos gráficos (design Lumnia).
 *
 * Sequência categórica derivada da marca: roxo -> laranja -> lilás -> pêssego
 * -> violeta profundo -> roxo rosado -> âmbar -> lilás claro.
 *
 * Verde e vermelho NÃO fazem parte da sequência categórica: são reservados
 * exclusivamente para semântica (receita vs. despesa / acima do orçamento).
 */
export const CHART_SERIES = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
] as const;

/** Cor de uma série pelo índice (cicla na paleta). */
export const seriesColor = (index: number) =>
  CHART_SERIES[((index % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];

/** Cores semânticas. */
export const INCOME_COLOR = 'hsl(var(--success))';
export const EXPENSE_COLOR = 'hsl(var(--destructive))';
export const NEUTRAL_COLOR = 'hsl(var(--muted-foreground))';

/** Eixos, grid e cursor padronizados. */
export const AXIS_TICK = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } as const;
export const GRID_STROKE = 'hsl(var(--border))';
export const TOOLTIP_CURSOR = { fill: 'hsl(var(--foreground))', opacity: 0.06 } as const;
