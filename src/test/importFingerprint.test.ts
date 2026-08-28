import { describe, expect, it } from 'vitest';
import { buildImportFingerprint } from '@/lib/importFingerprint';

const base = {
  fileName: 'extrato-agosto.ofx',
  rowIndex: 4,
  date: '2026-08-25',
  description: 'Mercado Central',
  value: 89.9,
  type: 'expense',
  originType: 'wallet',
  destinationId: 'wallet-1',
};

describe('buildImportFingerprint', () => {
  it('é estável para a mesma linha importada', () => {
    expect(buildImportFingerprint(base)).toBe(buildImportFingerprint({ ...base }));
  });

  it('preserva duas linhas bancárias idênticas usando o índice', () => {
    expect(buildImportFingerprint(base)).not.toBe(buildImportFingerprint({ ...base, rowIndex: 5 }));
  });

  it('permite importar a mesma linha em outro destino', () => {
    expect(buildImportFingerprint(base)).not.toBe(buildImportFingerprint({ ...base, destinationId: 'card-1', originType: 'credit_card' }));
  });
});
