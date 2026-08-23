export interface WaterfallInput {
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  debitExpense: number;
  invoiceTotal: number;
  byCategory: Record<string, number>;
  /** Rótulo legível para uma chave de categoria. */
  resolveName?: (key: string) => string;
  topCount?: number;
}

export interface WaterfallItem {
  name: string;
  base: number;
  value: number;
  amount: number;
  type: 'start' | 'income' | 'expense' | 'invoice' | 'end';
}

/**
 * Monta as barras da cascata a partir dos totais do motor oficial (base caixa).
 * Regras:
 *  - Barras de categoria cobrem exatamente `debitExpense` (as categorias vindas do
 *    motor são escaladas, pois `byCategory` inclui compras no cartão em base competência).
 *  - A fatura do cartão entra como uma barra própria (`invoiceTotal`).
 *  - Saldo Final = startingBalance + totalIncome - totalExpense.
 */
export function buildWaterfall({
  startingBalance,
  totalIncome,
  totalExpense,
  debitExpense,
  invoiceTotal,
  byCategory,
  resolveName = (k) => k,
  topCount = 5,
}: WaterfallInput): WaterfallItem[] {
  const items: WaterfallItem[] = [];

  items.push({
    name: 'Saldo Inicial',
    base: 0,
    value: Math.abs(startingBalance),
    amount: startingBalance,
    type: 'start',
  });

  let cursor = startingBalance;

  items.push({
    name: 'Receitas',
    base: Math.min(cursor, cursor + totalIncome),
    value: Math.abs(totalIncome),
    amount: totalIncome,
    type: 'income',
  });
  cursor += totalIncome;

  const sorted = Object.entries(byCategory || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1]);
  const catSum = sorted.reduce((s, [, v]) => s + v, 0);
  const scale = catSum > 0 ? debitExpense / catSum : 0;

  const scaled = sorted.map(([key, value]) => [key, value * scale] as [string, number]);
  const top = scaled.slice(0, topCount);
  let othersTotal = scaled.slice(topCount).reduce((s, [, v]) => s + v, 0);

  // Resíduo de arredondamento vai para "Outras" para fechar em debitExpense.
  const covered = top.reduce((s, [, v]) => s + v, 0) + othersTotal;
  othersTotal += debitExpense - covered;
  if (Math.abs(othersTotal) < 0.005) othersTotal = 0;

  top.forEach(([key, value]) => {
    cursor -= value;
    items.push({
      name: resolveName(key),
      base: cursor,
      value,
      amount: -value,
      type: 'expense',
    });
  });

  if (othersTotal > 0) {
    cursor -= othersTotal;
    items.push({
      name: 'Outras',
      base: cursor,
      value: othersTotal,
      amount: -othersTotal,
      type: 'expense',
    });
  }

  if (invoiceTotal > 0) {
    cursor -= invoiceTotal;
    items.push({
      name: 'Fatura do Cartão',
      base: cursor,
      value: invoiceTotal,
      amount: -invoiceTotal,
      type: 'invoice',
    });
  }

  const endBalance = startingBalance + totalIncome - totalExpense;
  items.push({
    name: 'Saldo Final',
    base: 0,
    value: Math.abs(endBalance),
    amount: endBalance,
    type: 'end',
  });

  return items;
}
