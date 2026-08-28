import { describe, expect, it } from 'vitest';
import { transactionAmount } from '@/lib/transactionAmount';

describe('transactionAmount', () => {
  it('trata valores armazenados como magnitude, inclusive registros legados com sinal', () => {
    expect(transactionAmount(41.9)).toBe(41.9);
    expect(transactionAmount(-41.9)).toBe(41.9);
    expect(transactionAmount('-41.90')).toBe(41.9);
  });

  it('não deixa valores inválidos contaminarem os totais', () => {
    expect(transactionAmount(undefined)).toBe(0);
    expect(transactionAmount('inválido')).toBe(0);
  });
});
