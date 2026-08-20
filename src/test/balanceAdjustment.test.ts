import { describe, it, expect } from 'vitest';
import { buildWalletBalances } from '@/lib/walletBalances';
import {
  BALANCE_ADJUSTMENT_CATEGORY,
  buildBalanceAdjustmentDescription,
  isBalanceAdjustment,
} from '@/lib/balanceAdjustments';

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
  isCreditCardPayment: () => false,
};

function adjustment(walletId: string, diff: number) {
  return {
    id: Math.random().toString(),
    type: diff > 0 ? 'income' : 'expense',
    value: Math.abs(diff),
    date: '2026-04-10',
    final_category: BALANCE_ADJUSTMENT_CATEGORY,
    description: buildBalanceAdjustmentDescription('Nubank'),
    wallet_id: walletId,
    is_paid: true,
  } as any;
}

describe('ajuste de saldo', () => {
  it('identifica o lançamento de ajuste', () => {
    expect(isBalanceAdjustment(adjustment('w1', 100))).toBe(true);
    expect(isBalanceAdjustment({ description: 'Mercado', final_category: 'alimentacao' })).toBe(false);
  });

  it('ajuste positivo aumenta o saldo da conta certa', () => {
    const res = buildWalletBalances({ ...base, monthExpenses: [adjustment('w2', 250)] });
    expect(res.find(r => r.walletId === 'w2')!.paidBalanceToday).toBe(750);
    expect(res.find(r => r.walletId === 'w2')!.projectedEndOfMonth).toBe(750);
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(1000);
  });

  it('ajuste negativo reduz o saldo', () => {
    const res = buildWalletBalances({ ...base, monthExpenses: [adjustment('w1', -300)] });
    expect(res.find(r => r.walletId === 'w1')!.paidBalanceToday).toBe(700);
    expect(res.find(r => r.walletId === 'w1')!.projectedEndOfMonth).toBe(700);
  });
});
