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

/** Tokens claros da rampa: exigem texto escuro por cima. */
const LIGHT_TOKENS = ['--chart-3', '--chart-4', '--chart-8'];

/**
 * Cor de texto legível sobre um preenchimento (hex ou token da rampa).
 * Usada nos treemaps, onde a cor vem da categoria escolhida pelo usuário.
 */
export function readableTextColor(fill?: string): string {
  if (!fill) return 'hsl(var(--primary-foreground))';
  const hex = fill.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return lum > 0.45 ? 'hsl(var(--foreground))' : 'hsl(var(--primary-foreground))';
  }
  if (LIGHT_TOKENS.some(t => fill.includes(t))) return 'hsl(var(--foreground))';
  return 'hsl(var(--primary-foreground))';
}
