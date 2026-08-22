import { describe, it, expect } from 'vitest';
import { computeFinancialScore } from '@/lib/financialScore';

describe('computeFinancialScore', () => {
  it('penaliza poupança negativa', () => {
    const r = computeFinancialScore({ totalIncome: 1000, totalExpense: 1300 });
    const savings = r.dimensions.find(d => d.key === 'savings')!;
    expect(savings.score).toBeLessThan(20);
    expect(savings.detail).toContain('mais do que ganhou');
  });

  it('dá nota máxima de poupança com 30%+ e curva contínua no meio', () => {
    const high = computeFinancialScore({ totalIncome: 1000, totalExpense: 700 });
    expect(high.dimensions.find(d => d.key === 'savings')!.score).toBe(100);
    const mid = computeFinancialScore({ totalIncome: 1000, totalExpense: 850 });
    const midScore = mid.dimensions.find(d => d.key === 'savings')!.score!;
    expect(midScore).toBeGreaterThan(65);
    expect(midScore).toBeLessThan(100);
  });

  it('não avalia orçamento sem orçamentos definidos e redistribui o peso', () => {
    const r = computeFinancialScore({ totalIncome: 1000, totalExpense: 800, liquidReserve: 0 });
    const budget = r.dimensions.find(d => d.key === 'budget')!;
    expect(budget.evaluated).toBe(false);
    expect(budget.weight).toBe(0);
    const sum = r.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('estouro numa categoria não é compensado por sobra noutra', () => {
    const r = computeFinancialScore({
      totalIncome: 1000,
      totalExpense: 1000,
      budgets: [
        { category: 'Restaurantes', allocated: 500, spent: 900 },
        { category: 'Transporte', allocated: 500, spent: 100 },
      ],
    });
    const budget = r.dimensions.find(d => d.key === 'budget')!;
    expect(budget.score!).toBeLessThan(75);
    expect(budget.detail).toContain('Restaurantes');
  });

  it('fatura vencida limita a nota de dívidas e crédito', () => {
    const r = computeFinancialScore({
      totalIncome: 10000,
      totalExpense: 3000,
      committedAmount: 500,
      hasOverdueInvoice: true,
    });
    expect(r.dimensions.find(d => d.key === 'debtCredit')!.score!).toBeLessThanOrEqual(25);
  });

  it('reserva alta (runway 6 meses) vale nota máxima', () => {
    const r = computeFinancialScore({
      totalIncome: 5000,
      totalExpense: 1000,
      liquidReserve: 6000,
      previousExpenses: [1000, 1000],
    });
    expect(r.dimensions.find(d => d.key === 'reserve')!.score).toBe(100);
  });

  it('queda de gasto não perde ponto de consistência', () => {
    const r = computeFinancialScore({
      totalIncome: 5000,
      totalExpense: 2000,
      previousExpenses: [4000, 4000, 4000],
    });
    expect(r.dimensions.find(d => d.key === 'consistency')!.score).toBe(100);
  });

  it('gasto muito acima da média penaliza consistência', () => {
    const r = computeFinancialScore({
      totalIncome: 5000,
      totalExpense: 6000,
      previousExpenses: [4000, 4000],
    });
    expect(r.dimensions.find(d => d.key === 'consistency')!.score!).toBeLessThan(60);
  });

  it('sugere próximo passo na dimensão de maior ganho', () => {
    const r = computeFinancialScore({
      totalIncome: 1000,
      totalExpense: 1200,
      budgets: [{ category: 'Casa', allocated: 100, spent: 100 }],
      liquidReserve: 100000,
      previousExpenses: [1200],
    });
    expect(r.nextStep?.key).toBe('savings');
    expect(r.nextStep!.potentialGain).toBeGreaterThan(0);
  });

  it('mantém as notas persistidas dentro de 0-100', () => {
    const r = computeFinancialScore({ totalIncome: 0, totalExpense: 0 });
    Object.values(r.persisted).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
    expect(r.overall).toBeGreaterThanOrEqual(0);
  });
});
