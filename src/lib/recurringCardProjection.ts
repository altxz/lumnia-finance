import type { Expense } from '../components/ExpenseTable';
import { isCreditCardPaymentLabel } from './creditCardPayments';

export const VIRTUAL_CARD_RECURRING_PREFIX = 'virtual-card-rec:';

export function isVirtualCardRecurring(id?: string | null) {
  return !!id && id.startsWith(VIRTUAL_CARD_RECURRING_PREFIX);
}

export function normalizeDesc(description?: string | null) {
  return (description ?? '').trim().toLowerCase();
}

export function monthLabelFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonthsToLabel(label: string, months: number) {
  const [year, month] = label.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthsBetweenLabels(from: string, to: string) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty * 12 + (tm - 1)) - (fy * 12 + (fm - 1));
}

/**
 * Recorrências fixas no cartão de crédito só existem como um único registro
 * "template" (is_recurring = true). Este helper decide se um template deve
 * projetar uma ocorrência virtual na fatura de `dueLabel`.
 */
export function shouldProjectCardRecurringInLabel(
  template: Pick<Expense, 'frequency'>,
  baseLabel: string,
  dueLabel: string,
) {
  const diff = monthsBetweenLabels(baseLabel, dueLabel);
  if (diff <= 0) return false;

  const frequency = template.frequency === 'annual' ? 'yearly' : (template.frequency ?? 'monthly');
  if (frequency === 'yearly') return diff % 12 === 0;
  return true;
}

/** Templates de recorrência fixa de cartão elegíveis para projeção. */
export function getCardRecurringTemplates(expenses: Expense[], cardId: string) {
  return expenses.filter(e =>
    e.credit_card_id === cardId &&
    e.is_recurring &&
    e.type === 'expense' &&
    !isVirtualCardRecurring(e.id) &&
    !isCreditCardPaymentLabel(e.description)
  );
}

export function buildVirtualCardOccurrence(template: Expense, dueLabel: string): Expense {
  return {
    ...template,
    id: `${VIRTUAL_CARD_RECURRING_PREFIX}${template.id}:${dueLabel}`,
    invoice_month: dueLabel,
    is_recurring: false,
    is_paid: false,
  };
}

/** Devolve o id do template original a partir de uma ocorrência virtual. */
export function resolveVirtualCardTemplateId(id?: string | null) {
  if (!isVirtualCardRecurring(id)) return null;
  const rest = id!.slice(VIRTUAL_CARD_RECURRING_PREFIX.length);
  return rest.slice(0, rest.lastIndexOf(':')) || null;
}
