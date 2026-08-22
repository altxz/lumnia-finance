import { describe, it, expect } from 'vitest';
import { findCategoryByName, normalizeCategoryKey, resolveTransactionCategory } from '@/lib/categoryMatch';

const cats = [
  { id: 'p-food', name: 'Alimentação', parent_id: null },
  { id: 'restaurante', name: 'Restaurante', parent_id: 'p-food' },
  { id: 'delivery', name: 'Delivery', parent_id: 'p-food' },
  { id: 'p-moradia', name: 'Moradia', parent_id: null },
  { id: 'internet', name: 'Internet', parent_id: 'p-moradia' },
  { id: 'p-receitas', name: 'Receitas', parent_id: null },
  { id: 'salario', name: 'Salário', parent_id: 'p-receitas' },
  { id: 'transf-in', name: 'Transferências', parent_id: 'p-receitas' },
  { id: 'p-fin', name: 'Financeiro', parent_id: null },
  { id: 'transf-out', name: 'Transferências', parent_id: 'p-fin' },
];

describe('normalizeCategoryKey', () => {
  it('remove acentos, espaços e maiúsculas', () => {
    expect(normalizeCategoryKey('  Alimentação ')).toBe('alimentacao');
    expect(normalizeCategoryKey('Barbearia/Cabeleireiro')).toBe('barbearia/cabeleireiro');
  });
});

describe('findCategoryByName', () => {
  it('corresponde independentemente de capitalização e acentos', () => {
    expect(findCategoryByName(cats, 'Restaurante')?.id).toBe('restaurante');
    expect(findCategoryByName(cats, 'restaurante')?.id).toBe('restaurante');
    expect(findCategoryByName(cats, 'internet')?.id).toBe('internet');
    expect(findCategoryByName(cats, 'salario')?.id).toBe('salario');
    expect(findCategoryByName(cats, ' Salário ')?.id).toBe('salario');
  });

  it('resolve nomes legados', () => {
    expect(findCategoryByName(cats, 'salary', 'income')?.id).toBe('salario');
  });

  it('desempata Transferências pelo tipo da transação', () => {
    expect(findCategoryByName(cats, 'Transferências', 'income')?.id).toBe('transf-in');
    expect(findCategoryByName(cats, 'transferencias', 'expense')?.id).toBe('transf-out');
  });

  it('devolve null quando não há correspondência segura', () => {
    expect(findCategoryByName(cats, 'cartao')).toBeNull();
    expect(findCategoryByName(cats, '')).toBeNull();
    expect(findCategoryByName([], 'Restaurante')).toBeNull();
  });
});

describe('resolveTransactionCategory', () => {
  it('prioriza final_category e usa category_ai como alternativa', () => {
    expect(
      resolveTransactionCategory(cats, { final_category: 'Restaurante', category_ai: 'Alimentação', type: 'expense' })?.id,
    ).toBe('restaurante');
    expect(
      resolveTransactionCategory(cats, { final_category: 'inexistente', category_ai: 'Delivery', type: 'expense' })?.id,
    ).toBe('delivery');
  });
});
