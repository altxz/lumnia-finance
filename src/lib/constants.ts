export const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação', variant: 'food' as const },
  { value: 'transporte', label: 'Transporte', variant: 'transport' as const },
  { value: 'lazer', label: 'Lazer', variant: 'leisure' as const },
  { value: 'saude', label: 'Saúde', variant: 'health' as const },
  { value: 'moradia', label: 'Moradia', variant: 'home' as const },
  { value: 'educacao', label: 'Educação', variant: 'education' as const },
  { value: 'outros', label: 'Outros', variant: 'other' as const },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

export function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}
