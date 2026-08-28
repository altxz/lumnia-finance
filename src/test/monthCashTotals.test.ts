import { describe, expect, it } from 'vitest';
import { computeMonthTotals } from '@/lib/monthCashTotals';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import type { CreditCard } from '@/lib/invoiceHelpers';

const CARD: CreditCard = {
  id: 'card-1',
  name: 'Nubank',
  limit_amount: 5000,
  closing_day: 28,
  due_day: 5,
  closing_strategy: 'closing_day',
  closing_days_before_due: 10,
} as CreditCard;

const cards = [CARD];
const isCCPayment = (e: any) => isTrackedCreditCardPayment(e, cards);

function row(over: Partial<any>) {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    value: 0,
    date: '2026-08-10',
    type: 'expense',
    final_category: 'outros',
    credit_card_id: null,
    wallet_id: 'w1',
    destination_wallet_id: null,
    is_paid: false,
    is_recurring: false,
    frequency: null,
    invoice_month: null,
    ...over,
  };
}

describe('Totais do mês — Saídas = débito + pagamentos de fatura', () => {
  const salario = row({ id: 'inc', description: 'Salário', value: 5000, type: 'income', date: '2026-08-05' });
  const aluguel = row({ id: 'deb', description: 'Aluguel', value: 1500, date: '2026-08-10' });
  const compraJulho = row({
    id: 'cc1',
    description: 'Mercado',
    value: 900,
    date: '2026-07-15',
    credit_card_id: CARD.id,
    invoice_month: '2026-08',
    final_category: 'alimentacao',
  });
  const compraAgosto = row({
    id: 'cc2',
    description: 'Notebook',
    value: 3000,
    date: '2026-08-20',
    credit_card_id: CARD.id,
    invoice_month: '2026-09',
    final_category: 'compras',
  });

  const base = {
    year: 2026,
    month: 7, // agosto
    recurringTemplates: [] as any[],
    exceptionSet: new Set<string>(),
    creditCards: cards,
    isCreditCardPayment: isCCPayment,
  };

  it('conta a fatura projetada quando ainda não há pagamento lançado', () => {
    const totals = computeMonthTotals({
      ...base,
      monthRows: [salario, aluguel, compraAgosto],
      invoiceExpenses: [compraJulho, compraAgosto],
      startingBalance: 1000,
    });

    expect(totals.totalIncome).toBe(5000);
    expect(totals.debitExpense).toBe(1500);
    expect(totals.invoiceProjected).toBe(900);
    expect(totals.invoicePaid).toBe(0);
    expect(totals.totalExpense).toBe(1500 + 900);
    expect(totals.cardPurchases).toBe(3000);
    expect(totals.projectedBalance).toBe(1000 + 5000 - 2400);
  });

  it('usa o valor pago quando existe lançamento de pagamento de fatura', () => {
    const pagamento = row({
      id: 'pay',
      description: 'Pagamento fatura Nubank',
      value: 900,
      date: '2026-08-05',
      invoice_month: '2026-08',
      final_category: 'Cartão de crédito',
    });

    const totals = computeMonthTotals({
      ...base,
      monthRows: [salario, aluguel, pagamento, compraAgosto],
      invoiceExpenses: [compraJulho, compraAgosto, pagamento],
    });

    // O pagamento não é contado como débito nem somado duas vezes.
    expect(totals.debitExpense).toBe(1500);
    expect(totals.invoicePaid).toBe(900);
    expect(totals.invoiceProjected).toBe(0);
    expect(totals.totalExpense).toBe(2400);
  });

  it('ranking de categorias usa apenas o extrato do mês (débito + compras no cartão)', () => {
    const totals = computeMonthTotals({
      ...base,
      monthRows: [salario, aluguel, compraAgosto],
      invoiceExpenses: [compraJulho, compraAgosto],
    });

    // "compras" (3000, cartão em agosto) é a maior; a fatura de julho (alimentacao) não entra.
    expect(totals.largestCategory).toMatchObject({ categoryKey: 'compras', total: 3000 });
    expect(totals.byCategory.alimentacao).toBeUndefined();
  });

  it('mantém continuidade: saldo previsto do mês N = saldo anterior do mês N+1', () => {
    const agosto = computeMonthTotals({
      ...base,
      monthRows: [salario, aluguel, compraAgosto],
      invoiceExpenses: [compraJulho, compraAgosto],
      startingBalance: 1000,
    });

    const setembro = computeMonthTotals({
      ...base,
      month: 8,
      monthRows: [],
      invoiceExpenses: [compraJulho, compraAgosto],
      startingBalance: agosto.projectedBalance,
    });

    expect(setembro.projectedBalance).toBe(agosto.projectedBalance - 3000);
  });

  it('preserva o sentido financeiro quando dados legados chegam com sinal negativo', () => {
    const totals = computeMonthTotals({
      ...base,
      monthRows: [
        row({ id: 'income-signed', type: 'income', value: -5000, date: '2026-08-05' }),
        row({ id: 'expense-signed', value: -1500, date: '2026-08-10' }),
      ],
      invoiceExpenses: [],
      startingBalance: 1000,
    });

    expect(totals.totalIncome).toBe(5000);
    expect(totals.debitExpense).toBe(1500);
    expect(totals.projectedBalance).toBe(4500);
  });
});
