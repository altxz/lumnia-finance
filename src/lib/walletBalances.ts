import type { Expense } from '../components/ExpenseTable';
import { buildInvoiceCashEvents, findInvoicePaymentRecord } from './invoiceCashFlow';
import { getInvoicePeriod, type CreditCard } from './invoiceHelpers';

export interface WalletLike {
  id: string;
  initial_balance: number;
}

export interface WalletBalance {
  walletId: string;
  /** Saldo "de extrato": inicial + apenas lançamentos pagos/recebidos até hoje. */
  paidBalanceToday: number;
  /** Saldo projetado até o fim do mês selecionado (mesmo motor das Transações). */
  projectedEndOfMonth: number;
}

export interface BuildWalletBalancesParams {
  wallets: WalletLike[];
  /** Lançamentos anteriores ao mês (já "efetivos": reais + recorrências projetadas). */
  historicalExpenses: Expense[];
  /** Lançamentos efetivos do mês selecionado. */
  monthExpenses: Expense[];
  /** Universo de lançamentos de cartão + pagamentos de fatura. */
  invoiceExpenses: Expense[];
  creditCards: CreditCard[];
  defaultWalletId?: string | null;
  /** yyyy-MM-dd */
  today: string;
  /** yyyy-MM-dd (primeiro dia do mês selecionado) */
  startDate: string;
  /** yyyy-MM-dd (primeiro dia do mês seguinte, exclusivo) */
  endDate: string;
  isCreditCardPayment: (expense: Expense) => boolean;
}

interface WalletFlow {
  walletId: string;
  delta: number;
}

function parseMonthLabel(label: string) {
  const [year, month] = label.split('-').map(Number);
  return { year, month: month - 1 };
}

/**
 * Divide um lançamento nos efeitos que ele tem sobre as carteiras.
 * Regras (iguais ao motor global de projeção):
 *  - compra no cartão de crédito não mexe em carteira (quem mexe é a fatura);
 *  - pagamento de fatura também não entra aqui (entra pelos eventos de caixa da fatura);
 *  - transferência debita a origem e credita o destino;
 *  - sem carteira definida → carteira padrão.
 */
export function resolveWalletFlows(
  expense: Expense,
  defaultWalletId: string | null,
  isCreditCardPayment: (expense: Expense) => boolean,
): WalletFlow[] {
  if (expense.credit_card_id) return [];
  if (isCreditCardPayment(expense)) return [];

  const value = Number(expense.value) || 0;
  const origin = expense.wallet_id || defaultWalletId;

  if (expense.type === 'transfer') {
    const flows: WalletFlow[] = [];
    if (origin) flows.push({ walletId: origin, delta: -value });
    const destination = (expense as any).destination_wallet_id as string | null | undefined;
    if (destination) flows.push({ walletId: destination, delta: value });
    return flows;
  }

  if (!origin) return [];
  return [{ walletId: origin, delta: expense.type === 'income' ? value : -value }];
}

export function buildWalletBalances({
  wallets,
  historicalExpenses,
  monthExpenses,
  invoiceExpenses,
  creditCards,
  defaultWalletId,
  today,
  startDate,
  endDate,
  isCreditCardPayment,
}: BuildWalletBalancesParams): WalletBalance[] {
  const walletIds = new Set(wallets.map(w => w.id));
  const fallbackWallet =
    defaultWalletId && walletIds.has(defaultWalletId) ? defaultWalletId : wallets[0]?.id ?? null;

  const paid = new Map<string, number>();
  const projected = new Map<string, number>();

  wallets.forEach(w => {
    const base = Number(w.initial_balance) || 0;
    paid.set(w.id, base);
    projected.set(w.id, base);
  });

  const add = (map: Map<string, number>, walletId: string, delta: number) => {
    if (!walletIds.has(walletId)) {
      if (!fallbackWallet) return;
      map.set(fallbackWallet, (map.get(fallbackWallet) || 0) + delta);
      return;
    }
    map.set(walletId, (map.get(walletId) || 0) + delta);
  };

  const applyExpense = (expense: Expense, countAsPaid: boolean) => {
    resolveWalletFlows(expense, fallbackWallet, isCreditCardPayment).forEach(flow => {
      add(projected, flow.walletId, flow.delta);
      if (countAsPaid) add(paid, flow.walletId, flow.delta);
    });
  };

  // Histórico (antes do mês selecionado)
  historicalExpenses.forEach(expense => {
    applyExpense(expense, !!expense.is_paid);
  });

  // Mês selecionado
  monthExpenses.forEach(expense => {
    if (!expense.date || expense.date < startDate || expense.date >= endDate) return;
    applyExpense(expense, !!expense.is_paid && expense.date <= today);
  });

  // Faturas de cartão: debitam a carteira do pagamento (ou a padrão)
  const cardsById = new Map(creditCards.map(card => [card.id, card]));
  const events = buildInvoiceCashEvents(creditCards, invoiceExpenses);

  events.forEach(event => {
    if (event.date >= endDate) return;

    const card = cardsById.get(event.cardId);
    let paymentWallet: string | null = null;
    let hasPayment = false;

    if (card) {
      const { year, month } = parseMonthLabel(event.monthLabel);
      const period = getInvoicePeriod(card, year, month);
      const record = findInvoicePaymentRecord(invoiceExpenses, period);
      if (record) {
        hasPayment = true;
        paymentWallet = record.wallet_id ?? null;
      }
    }

    const walletId = paymentWallet || fallbackWallet;
    if (!walletId) return;

    add(projected, walletId, -event.amount);
    if (hasPayment && event.date <= today) add(paid, walletId, -event.amount);
  });

  return wallets.map(w => ({
    walletId: w.id,
    paidBalanceToday: paid.get(w.id) || 0,
    projectedEndOfMonth: projected.get(w.id) || 0,
  }));
}
