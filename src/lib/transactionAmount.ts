/**
 * Monetary amounts are stored as magnitudes. The direction belongs exclusively
 * to `type` (income, expense or transfer), never to the sign of `value`.
 * Older imports can contain signed amounts, so calculations normalize here.
 */
export function transactionAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}
