import { describe, it, expect } from 'vitest';
import { buildDailyBalanceMap, computeMonthCashFlow, computeProjectedMonthResult, transferCashDelta } from '@/lib/projectedBalanceMath';

const invIds = ['inv1'];
const noCC = () => false;

function transfer(o: Partial<any>): any {
  return { id: Math.random().toString(), type: 'transfer', value: 1000, date: '2026-08-17', final_category: 'investimentos', is_paid: true, ...o };
}

describe('transferências de investimento no motor de saldo', () => {
  it('aporte sai do caixa e resgate volta', () => {
    const aporte = transfer({ wallet_id: 'w1', destination_wallet_id: 'inv1' });
    const resgate = transfer({ wallet_id: 'inv1', destination_wallet_id: 'w1' });
    expect(transferCashDelta(aporte, new Set(invIds))).toBe(-1000);
    expect(transferCashDelta(resgate, new Set(invIds))).toBe(1000);
  });

  it('transferência entre contas correntes segue neutra', () => {
    expect(transferCashDelta(transfer({ wallet_id: 'w1', destination_wallet_id: 'w2' }), new Set(invIds))).toBe(0);
  });

  it('afeta o saldo do dia e o saldo previsto do mês', () => {
    const aporte = transfer({ wallet_id: 'w1', destination_wallet_id: 'inv1' });
    const { balanceMap } = buildDailyBalanceMap({
      monthExpenses: [aporte],
      invoiceExpenses: [],
      creditCards: [],
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      startingBalance: 5000,
      isCreditCardPayment: noCC,
      investmentWalletIds: invIds,
    });
    expect(balanceMap['2026-08-17']).toBe(4000);

    expect(computeMonthCashFlow([aporte], noCC, invIds)).toBe(-1000);

    const totals = computeProjectedMonthResult({
      effectiveMonthExpenses: [aporte],
      invoiceTotal: 0,
      invoiceByCategory: {},
      startingBalance: 5000,
      isCreditCardPayment: noCC,
      investmentWalletIds: invIds,
    });
    expect(totals.totalExpense).toBe(1000);
    expect(totals.projectedBalance).toBe(4000);
  });
});
