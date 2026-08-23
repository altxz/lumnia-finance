/**
 * Utilitários para evitar textos cortados/reticências no mobile:
 * reduzimos o tamanho da fonte progressivamente conforme o texto cresce.
 */

/** Classe de fonte para valores monetários (tabular-nums). */
export function currencyFitClass(text: string, size: 'sm' | 'md' = 'sm'): string {
  const len = text.length;
  if (size === 'md') {
    if (len > 15) return 'text-[10px]';
    if (len > 13) return 'text-[11px]';
    if (len > 11) return 'text-xs';
    return 'text-sm';
  }
  if (len > 14) return 'text-[10px]';
  if (len > 12) return 'text-[11px]';
  if (len > 10) return 'text-xs';
  return 'text-sm';
}

/** Classe de fonte para descrições/títulos curtos que não devem ser truncados. */
export function labelFitClass(text: string): string {
  const len = text.length;
  if (len > 46) return 'text-[10.5px] leading-[1.25]';
  if (len > 32) return 'text-[11.5px] leading-[1.3]';
  if (len > 22) return 'text-xs leading-snug';
  return 'text-sm leading-snug';
}
