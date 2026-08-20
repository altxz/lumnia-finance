/**
 * Ajuste de saldo de conta.
 *
 * O ajuste é registrado como uma transação normal (para que todo o motor de
 * saldo/projeção já existente reflita a correção), mas fica fora das análises
 * de receitas/despesas por categoria, orçamentos e score financeiro — ele não é
 * um gasto ou receita real, apenas uma correção de saldo.
 */

export const BALANCE_ADJUSTMENT_CATEGORY = 'Ajuste de saldo';

const DESCRIPTION_PREFIX = 'Ajuste de saldo';

export function buildBalanceAdjustmentDescription(walletName: string) {
  return `${DESCRIPTION_PREFIX} — ${walletName}`;
}

type AdjustmentLike = {
  description?: string | null;
  final_category?: string | null;
};

function normalize(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

export function isBalanceAdjustment(item: AdjustmentLike): boolean {
  if (normalize(item.final_category) === normalize(BALANCE_ADJUSTMENT_CATEGORY)) return true;
  return normalize(item.description).startsWith(normalize(DESCRIPTION_PREFIX));
}
