import type { Expense } from '../components/ExpenseTable';
import { buildInvoiceCashEvents, groupInvoiceCashEventsByDay } from './invoiceCashFlow';
import type { CreditCard } from './invoiceHelpers';

interface ComputeProjectedMonthResultParams {
  effectiveMonthExpenses: Expense[];
  /** Total de fatura que sai do caixa no mês (pago + projetado). Opcional se paid/projected vierem. */
  invoiceTotal?: number;
  /** Faturas com pagamento já lançado no mês. */
  invoicePaid?: number;
  /** Faturas do mês sem pagamento lançado (entram na data de vencimento). */
  invoiceProjected?: number;
  invoiceByCategory?: Record<string, number>;
  /**
   * Compras feitas no cartão dentro do mês. Usadas apenas para o ranking de
   * categorias (fiel ao extrato) — não entram no total de saídas.
   */
  cardPurchases?: { final_category?: string | null; value: number; type?: string | null }[];
  startingBalance: number;
  isCreditCardPayment: (expense: Expense) => boolean;
  /** Carteiras de investimento: transferências para/de elas afetam o saldo em caixa. */
  investmentWalletIds?: Iterable<string>;
}


interface BuildDailyBalanceMapParams {
  monthExpenses: Expense[];
  invoiceExpenses: Expense[];
  creditCards: CreditCard[];
  startDate: string;
  endDate: string;
  startingBalance: number;
  isCreditCardPayment: (expense: Expense) => boolean;
  investmentWalletIds?: Iterable<string>;
}

/**
 * Efeito de uma transferência no saldo em caixa (líquido).
 * Transferência entre contas correntes é neutra; aporte em investimento sai do
 * caixa (negativo) e resgate volta para o caixa (positivo).
 */
export function transferCashDelta(
  expense: { value: number; wallet_id?: string | null; destination_wallet_id?: string | null },
  investmentWalletIds: Set<string>,
) {
  if (investmentWalletIds.size === 0) return 0;
  const value = Number(expense.value) || 0;
  const fromInvestment = !!expense.wallet_id && investmentWalletIds.has(expense.wallet_id);
  const toInvestment = !!expense.destination_wallet_id && investmentWalletIds.has(expense.destination_wallet_id);
  if (fromInvestment === toInvestment) return 0;
  return toInvestment ? -value : value;
}

/**
 * Fluxo de caixa (receitas - despesas em débito) de um conjunto de lançamentos
 * já "efetivos" (reais + recorrências projetadas) de um mês. Faturas de cartão
 * entram separadamente pelos eventos de caixa da fatura.
 */
export function computeMonthCashFlow(
  effectiveMonthExpenses: { type: string; value: number; credit_card_id?: string | null }[],
  isCreditCardPayment: (expense: any) => boolean,
  investmentWalletIds: Iterable<string> = [],
) {
  const invIds = new Set(investmentWalletIds);
  return effectiveMonthExpenses.reduce((sum, expense) => {
    if (expense.type === 'transfer') return sum + transferCashDelta(expense as any, invIds);
    if (expense.type === 'income') return sum + Number(expense.value);
    if (expense.credit_card_id) return sum;
    if (isCreditCardPayment(expense)) return sum;
    return sum - Number(expense.value);
  }, 0);
}


export function buildDailyBalanceMap({

  monthExpenses,
  invoiceExpenses,
  creditCards,
  startDate,
  endDate,
  startingBalance,
  isCreditCardPayment,
  investmentWalletIds = [],
}: BuildDailyBalanceMapParams) {
  const nonCcFlowByDay: Record<string, number> = {};
  const invIds = new Set(investmentWalletIds);

  monthExpenses.forEach((expense) => {
    if (expense.credit_card_id) return;
    if (expense.date < startDate || expense.date > endDate) return;

    if (expense.type === 'transfer') {
      const delta = transferCashDelta(expense as any, invIds);
      if (!delta) return;
      nonCcFlowByDay[expense.date] = (nonCcFlowByDay[expense.date] || 0) + delta;
      return;
    }

    if (isCreditCardPayment(expense)) return;

    nonCcFlowByDay[expense.date] = nonCcFlowByDay[expense.date] || 0;
    nonCcFlowByDay[expense.date] += expense.type === 'income' ? expense.value : -expense.value;
  });

  const invoiceTotalByDay = groupInvoiceCashEventsByDay(
    buildInvoiceCashEvents(creditCards, invoiceExpenses.length > 0 ? invoiceExpenses : monthExpenses),
    startDate,
    endDate,
  );

  const allDayKeys = Array.from(
    new Set([...Object.keys(nonCcFlowByDay), ...Object.keys(invoiceTotalByDay)]),
  ).sort();

  let runningBalance = startingBalance;
  const balanceMap: Record<string, number> = {};

  allDayKeys.forEach((day) => {
    runningBalance += nonCcFlowByDay[day] || 0;
    runningBalance -= invoiceTotalByDay[day] || 0;
    balanceMap[day] = runningBalance;
  });

  return {
    balanceMap,
    nonCcFlowByDay,
    invoiceTotalByDay,
  };
}

export function computeProjectedMonthResult({
  effectiveMonthExpenses,
  invoiceTotal,
  invoiceByCategory,
  startingBalance,
  isCreditCardPayment,
  investmentWalletIds = [],
}: ComputeProjectedMonthResultParams) {
  const invIds = new Set(investmentWalletIds);
  const nonTransfers = effectiveMonthExpenses.filter((expense) => expense.type !== 'transfer');
  const investmentTransfers = effectiveMonthExpenses
    .filter((expense) => expense.type === 'transfer')
    .map((expense) => transferCashDelta(expense as any, invIds))
    .filter((delta) => delta !== 0);

  const investmentInflow = investmentTransfers.filter(d => d > 0).reduce((s, d) => s + d, 0);
  const investmentOutflow = investmentTransfers.filter(d => d < 0).reduce((s, d) => s - d, 0);

  const totalIncome = nonTransfers
    .filter((expense) => expense.type === 'income')
    .reduce((sum, expense) => sum + expense.value, 0) + investmentInflow;

  const debitExpense = nonTransfers
    .filter(
      (expense) =>
        expense.type !== 'income' &&
        !expense.credit_card_id &&
        !isCreditCardPayment(expense),
    )
    .reduce((sum, expense) => sum + expense.value, 0) + investmentOutflow;

  const totalExpense = debitExpense + invoiceTotal;

  const byCategory: Record<string, number> = { ...invoiceByCategory };
  if (investmentOutflow > 0) {
    byCategory.investimentos = (byCategory.investimentos || 0) + investmentOutflow;
  }
  nonTransfers
    .filter(
      (expense) =>
        expense.type !== 'income' &&
        !expense.credit_card_id &&
        !isCreditCardPayment(expense),
    )
    .forEach((expense) => {
      byCategory[expense.final_category] = (byCategory[expense.final_category] || 0) + expense.value;
    });


  const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    projectedBalance: startingBalance + totalIncome - totalExpense,
    largestCategory: largest ? { name: largest[0], total: largest[1], categoryKey: largest[0] } : null,
  };
}