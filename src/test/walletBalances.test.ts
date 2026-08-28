import { describe, it, expect } from 'vitest';
import { buildWalletBalances } from '@/lib/walletBalances';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';

const card = {
  id: 'card1',
  name: 'Nubank',
  limit_amount: 5000,
  closing_day: 25,
  due_day: 10,
  closing_strategy: 'fixed',
  closing_days_before_due: 7,
} as any;

const wallets = [
  { id: 'w1', initial_balance: 1000 },
  { id: 'w2', initial_balance: 500 },
];

const base = {
  wallets,
  historicalExpenses: [] as any[],
  invoiceExpenses: [] as any[],
  creditCards: [] as any[],
  defaultWalletId: 'w1',
  today: '2026-04-15',
  startDate: '2026-04-01',
  endDate: '2026-05-01',
  isCreditCardPayment: (e: any) => isTrackedCreditCardPayment(e, [card]),
};

function exp(o: Partial<any>): any {
  return { id: Math.random().toString(), type: 'expense', value: 100, date: '2026-04-10', final_category: 'outros', is_paid: true, ...o };
}

describe('buildWalletBalances', () => {
  it('debita a carteira da transação e credita receitas', () => {
    const res = buildWalletBalances({
      ...base,
      monthExpenses: [
        exp({ wallet_id: 'w1', value: 200 }),
        exp({ wallet_id: 'w2', type: 'income', value: 300 }),
      ],
    });
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(800);
    expect(res.find(r => r.walletId === 'w2')!.paidBalanceToday).toBe(800);
  });

  it('lançamento sem carteira cai na carteira padrão', () => {
    const res = buildWalletBalances({
      ...base,
      monthExpenses: [exp({ wallet_id: null, value: 150 })],
    });
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(850);
    expect(res.find(r => r.walletId === 'w2')!.paidBalanceToday).toBe(500);
  });

  it('só considera pagas e até hoje no saldo atual, mas tudo no previsto', () => {
    const res = buildWalletBalances({
      ...base,
      monthExpenses: [
        exp({ wallet_id: 'w1', value: 100, is_paid: false, date: '2026-04-12' }),
        exp({ wallet_id: 'w1', value: 100, is_paid: true, date: '2026-04-28' }),
      ],
    });
    const w1 = res.find(r => r.walletId === 'w1')!;
    expect(w1.paidBalanceToday).toBe(1000);
    expect(w1.projectedEndOfMonth).toBe(800);
  });

  it('compra no cartão não mexe na carteira', () => {
    const res = buildWalletBalances({
      ...base,
      creditCards: [card],
      monthExpenses: [exp({ wallet_id: 'w1', credit_card_id: 'card1', value: 400, invoice_month: '2026-05' })],
      invoiceExpenses: [exp({ wallet_id: 'w1', credit_card_id: 'card1', value: 400, invoice_month: '2026-05' })],
    });
    // Fatura vence em maio (fora da janela), então abril não sofre nada
    expect(res.find(r => r.walletId === 'w1')!.projectedEndOfMonth).toBe(1000);
  });

  it('fatura debita a carteira usada no pagamento', () => {
    const purchase = exp({ credit_card_id: 'card1', value: 300, date: '2026-03-05', invoice_month: '2026-04' });
    const payment = exp({
      wallet_id: 'w2',
      value: 300,
      date: '2026-04-10',
      invoice_month: '2026-04',
      description: 'Pagamento fatura Nubank',
    });
    const res = buildWalletBalances({
      ...base,
      creditCards: [card],
      monthExpenses: [payment],
      invoiceExpenses: [purchase, payment],
    });
    expect(res.find(r => r.walletId === 'w2')!.paidBalanceToday).toBe(200);
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(1000);
  });

  it('transferência move saldo entre carteiras', () => {
    const res = buildWalletBalances({
      ...base,
      monthExpenses: [exp({ type: 'transfer', wallet_id: 'w1', destination_wallet_id: 'w2', value: 250 })],
    });
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(750);
    expect(res.find(r => r.walletId === 'w2')!.paidBalanceToday).toBe(750);
  });

  it('uma despesa legada com valor negativo continua debitando a carteira', () => {
    const res = buildWalletBalances({
      ...base,
      monthExpenses: [exp({ wallet_id: 'w1', value: -41.9 })],
    });

    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(958.1);
    expect(res.find(r => r.walletId === 'w1')!.projectedEndOfMonth).toBe(958.1);
  });
});
