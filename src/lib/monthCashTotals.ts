import { computeProjectedMonthResult } from './projectedBalanceMath';
import { computeInvoiceTotalsForCashWindow } from './projectedInvoiceTotals';
import { buildEffectiveMonthExpenses } from './recurringProjection';
import type { CreditCard } from './invoiceHelpers';

export interface MonthTotalsInput {
  year: number;
  month: number;
  /** Lançamentos reais do mês (débito, receitas, transferências e, se houver, cartão). */
  monthRows: any[];
  recurringTemplates: any[];
  exceptionSet: Set<string>;
  creditCards: CreditCard[];
  /** Todas as linhas de cartão + registros "Pagamento fatura". */
  invoiceExpenses: any[];
  isCreditCardPayment: (expense: any) => boolean;
  investmentWalletIds?: string[];
  startingBalance?: number;
}

export function monthWindow(year: number, month: number) {
  const start = new Date(year, month, 1);
  const next = new Date(year, month + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return { startDate: fmt(start), endDate: fmt(next) };
}

/**
 * Motor único de totais mensais em base caixa:
 *   Saídas = despesas em débito do mês + pagamentos de fatura do mês
 * (faturas com pagamento lançado usam o valor pago; sem pagamento, entram
 * projetadas na data de vencimento). Compras no cartão nunca somam nas saídas.
 */
export function computeMonthTotals({
  year,
  month,
  monthRows,
  recurringTemplates,
  exceptionSet,
  creditCards,
  invoiceExpenses,
  isCreditCardPayment,
  investmentWalletIds = [],
  startingBalance = 0,
}: MonthTotalsInput) {
  const { startDate, endDate } = monthWindow(year, month);

  const effectiveMonthExpenses = buildEffectiveMonthExpenses({
    monthExpenses: monthRows,
    recurringTemplates,
    year,
    month,
    exceptionSet,
  }) as any[];

  const invoicePool = invoiceExpenses.length > 0 ? invoiceExpenses : monthRows;
  const invoice = computeInvoiceTotalsForCashWindow({
    creditCards,
    expenses: invoicePool as any[],
    startDate,
    endDate,
  });

  // Compras no cartão feitas dentro do mês (base extrato, só para ranking/tooltip).
  const seen = new Set<string>();
  const cardPurchases: any[] = [];
  [...invoicePool, ...monthRows].forEach((row: any) => {
    if (!row?.credit_card_id || !row.date) return;
    if (row.date < startDate || row.date >= endDate) return;
    if (row.type === 'income' || row.type === 'transfer') return;
    const key = row.id ?? `${row.date}|${row.description}|${row.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    cardPurchases.push(row);
  });

  const result = computeProjectedMonthResult({
    effectiveMonthExpenses: effectiveMonthExpenses as any,
    invoicePaid: invoice.paid,
    invoiceProjected: invoice.projected,
    cardPurchases,
    startingBalance,
    isCreditCardPayment,
    investmentWalletIds,
  });

  return { ...result, effectiveMonthExpenses, startDate, endDate };
}
