import { describe, it, expect } from 'vitest';
import { buildWaterfall } from '@/lib/waterfallMath';

describe('buildWaterfall', () => {
  const input = {
    startingBalance: 1000,
    totalIncome: 27670.58,
    totalExpense: 19679.25 + 5125.23,
    debitExpense: 19679.25,
    invoiceTotal: 5125.23,
    byCategory: {
      moradia: 12000,
      alimentacao: 6000,
      transporte: 4000,
      lazer: 2000,
      saude: 1000,
      outros: 500,
      educacao: 300,
    },
  };

  it('fecha o saldo final igual ao motor (inicial + receitas - saídas)', () => {
    const items = buildWaterfall(input);
    const end = items[items.length - 1];
    expect(end.name).toBe('Saldo Final');
    expect(end.amount).toBeCloseTo(1000 + input.totalIncome - input.totalExpense, 2);
  });

  it('inclui a fatura do cartão como saída', () => {
    const items = buildWaterfall(input);
    const invoice = items.find((i) => i.type === 'invoice');
    expect(invoice?.amount).toBeCloseTo(-5125.23, 2);
  });

  it('as barras de despesa somam exatamente o débito do mês', () => {
    const items = buildWaterfall(input);
    const debit = items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.value, 0);
    expect(debit).toBeCloseTo(input.debitExpense, 2);
  });

  it('a soma das variações leva do saldo inicial ao final', () => {
    const items = buildWaterfall(input);
    const deltas = items.filter((i) => i.type !== 'start' && i.type !== 'end');
    const total = deltas.reduce((s, i) => s + i.amount, 1000);
    expect(total).toBeCloseTo(items[items.length - 1].amount, 2);
  });
});
