/**
 * Correspondência tolerante entre o valor guardado na transação
 * (`final_category` / `category_ai`, texto livre) e a lista de categorias do
 * utilizador. Resolve diferenças de maiúsculas, acentos, espaços e nomes
 * legados (slugs antigos como "salary" ou "transferencia").
 *
 * Nada aqui altera dados: é apenas leitura/exibição.
 */

export interface CategoryLike {
  id: string;
  name: string;
  parent_id: string | null;
}

/** trim + minúsculas + sem acentos + espaços colapsados. */
export function normalizeCategoryKey(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Nomes legados que já foram guardados em transações antigas. */
const LEGACY_ALIASES: Record<string, string[]> = {
  salary: ['salario'],
  income: ['outras receitas', 'receitas'],
  transferencia: ['transferencias'],
  transferencias: ['transferencia'],
  transfer: ['transferencias'],
  food: ['alimentacao'],
  housing: ['moradia'],
  transport: ['transporte'],
  health: ['saude'],
  education: ['educacao'],
  leisure: ['lazer'],
  shopping: ['compras'],
  subscriptions: ['assinaturas'],
  other: ['outros'],
};

function candidateKeys(value?: string | null) {
  const key = normalizeCategoryKey(value);
  if (!key) return [];
  return [key, ...(LEGACY_ALIASES[key] ?? [])];
}

/**
 * Encontra a categoria correspondente a um valor de texto.
 * `type` desempata nomes duplicados (ex.: "Transferências" existe em Receitas
 * e em Financeiro): receitas preferem a categoria sob "Receitas".
 */
export function findCategoryByName<T extends CategoryLike>(
  categories: T[],
  value?: string | null,
  type?: string | null,
): T | null {
  const keys = candidateKeys(value);
  if (keys.length === 0 || categories.length === 0) return null;

  const byId = new Map(categories.map(c => [c.id, c]));
  const parentKey = (c: T) => normalizeCategoryKey(c.parent_id ? byId.get(c.parent_id)?.name : c.name);

  for (const key of keys) {
    const matches = categories.filter(c => normalizeCategoryKey(c.name) === key);
    if (matches.length === 0) continue;
    if (matches.length === 1) return matches[0];

    const wantsIncome = type === 'income';
    const incomeParents = ['receitas', 'renda'];
    const preferred = matches.filter(c => {
      const parent = parentKey(c);
      const isIncomeBranch = incomeParents.includes(parent);
      return wantsIncome ? isIncomeBranch : !isIncomeBranch;
    });
    return preferred[0] ?? matches[0];
  }

  return null;
}

/**
 * Valor a mostrar/selecionar no seletor de categorias, priorizando
 * `final_category` e usando `category_ai` apenas como alternativa.
 */
export function resolveTransactionCategory<T extends CategoryLike>(
  categories: T[],
  transaction: { final_category?: string | null; category_ai?: string | null; type?: string | null },
): T | null {
  return (
    findCategoryByName(categories, transaction.final_category, transaction.type) ??
    findCategoryByName(categories, transaction.category_ai, transaction.type)
  );
}
