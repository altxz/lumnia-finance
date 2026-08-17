import type { Expense } from '../components/ExpenseTable';
import { buildInvoiceCashEvents, groupInvoiceCashEventsByDay } from './invoiceCashFlow';
import type { CreditCard } from './invoiceHelpers';

interface ComputeProjectedMonthResultParams {
  effectiveMonthExpenses: Expense[];
  invoiceTotal: number;
  invoiceByCategory: Record<string, number>;
  startingBalance: number;
  isCreditCardPayment: (expense: Expense) => boolean;
}

interface BuildDailyBalanceMapParams {
  monthExpenses: Expense[];
  invoiceExpenses: Expense[];
  creditCards: CreditCard[];
  startDate: string;
  endDate: string;
  startingBalance: number;
  isCreditCardPayment: (expense: Expense) => boolean;
}

/**
 * Fluxo de caixa (receitas - despesas em débito) de um conjunto de lançamentos
 * já "efetivos" (reais + recorrências projetadas) de um mês. Faturas de cartão
 * entram separadamente pelos eventos de caixa da fatura.
 */
export function computeMonthCashFlow(
  effectiveMonthExpenses: { type: string; value: number; credit_card_id?: string | null }[],
  isCreditCardPayment: (expense: any) => boolean,
) {
  return effectiveMonthExpenses.reduce((sum, expense) => {
    if (expense.type === 'transfer') return sum;
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
}: BuildDailyBalanceMapParams) {
  const nonCcFlowByDay: Record<string, number> = {};

  monthExpenses.forEach((expense) => {
    if (expense.type === 'transfer') return;
    if (expense.credit_card_id) return;
    if (isCreditCardPayment(expense)) return;
    if (expense.date < startDate || expense.date > endDate) return;

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
}: ComputeProjectedMonthResultParams) {
  const nonTransfers = effectiveMonthExpenses.filter((expense) => expense.type !== 'transfer');

  const totalIncome = nonTransfers
    .filter((expense) => expense.type === 'income')
    .reduce((sum, expense) => sum + expense.value, 0);

  const debitExpense = nonTransfers
    .filter(
      (expense) =>
        expense.type !== 'income' &&
        !expense.credit_card_id &&
        !isCreditCardPayment(expense),
    )
    .reduce((sum, expense) => sum + expense.value, 0);

  const totalExpense = debitExpense + invoiceTotal;

  const byCategory: Record<string, number> = { ...invoiceByCategory };
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