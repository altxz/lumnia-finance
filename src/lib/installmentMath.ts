export type InstallmentValueMode = 'total' | 'per_installment';

export function distributeInstallmentValues(
  value: number,
  count: number,
  mode: InstallmentValueMode,
): number[] {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Installment value must be a positive number.');
  }
  if (!Number.isInteger(count) || count < 2) {
    throw new Error('Installment count must be an integer greater than one.');
  }

  if (mode === 'per_installment') {
    return Array.from({ length: count }, () => Math.round(value * 100) / 100);
  }

  const totalCents = Math.round(value * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;

  return Array.from({ length: count }, (_, index) => (
    baseCents + (index < remainderCents ? 1 : 0)
  ) / 100);
}
