import { describe, expect, it } from 'vitest';
import { distributeInstallmentValues } from '@/lib/installmentMath';

describe('distributeInstallmentValues', () => {
  it('preserva exatamente o total quando os centavos não dividem igualmente', () => {
    const values = distributeInstallmentValues(100, 3, 'total');

    expect(values).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(values.reduce((sum, value) => sum + value, 0) * 100)).toBe(10000);
  });

  it('mantém o valor informado para cada parcela', () => {
    expect(distributeInstallmentValues(49.9, 3, 'per_installment')).toEqual([49.9, 49.9, 49.9]);
  });

  it('rejeita valores e quantidades inválidos', () => {
    expect(() => distributeInstallmentValues(0, 3, 'total')).toThrow();
    expect(() => distributeInstallmentValues(100, 1, 'total')).toThrow();
  });
});
