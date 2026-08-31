import type { Expense } from '../components/ExpenseTable';
import { isCreditCardPaymentLabel } from './creditCardPayments';
import { supabase } from './supabase';

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
    !isCreditCardPaymentLabel(e.description)
  );
}

/**
 * Ocorrência virtual de uma recorrência fixa de cartão numa fatura futura.
 * Mantém o MESMO id do molde (como já é feito para recorrência de débito em
 * `buildEffectiveMonthExpenses`), só sobrescrevendo `invoice_month`, `date` e
 * `is_paid`. Isso garante que editar/excluir essa ocorrência sempre atue
 * sobre o molde real, nunca sobre um id fantasma sem linha no banco.
 */
export function buildVirtualCardOccurrence(template: Expense, dueLabel: string, purchaseDate?: string): Expense {
  return {
    ...template,
    invoice_month: dueLabel,
    is_paid: false,
    ...(purchaseDate ? { date: purchaseDate } : {}),
  };
}

/**
 * Cutoff de fatura para o fluxo "editar > todas as recorrências" quando o
 * molde é de cartão. Espelha a semântica de cutoff usada no lado débito
 * (menor entre a ocorrência clicada e a data do novo molde), mas em termos
 * de invoice_month (fatura) — recorrências de cartão avançam por fatura, não
 * por data de calendário (ver shouldProjectCardRecurringInLabel).
 */
export function resolveCardSplitSeriesCutoffLabel(
  oldOccurrenceLabel: string,
  newTemplateLabel?: string | null,
): string {
  if (!newTemplateLabel) return oldOccurrenceLabel;
  return monthsBetweenLabels(oldOccurrenceLabel, newTemplateLabel) < 0 ? newTemplateLabel : oldOccurrenceLabel;
}

/**
 * Remove a ocorrência de uma recorrência fixa de cartão de UMA fatura
 * específica, sem apagar o molde nem afetar as demais faturas.
 *
 * Sempre registra uma exceção (`template_id` + fatura) para que o job diário
 * nunca materialize essa fatura. Só toca no molde se a fatura removida for a
 * que ele hoje representa (`invoice_month` atual do molde) — nesse caso
 * avança o molde para a próxima fatura, preservando a série. Se for uma
 * fatura futura ainda não alcançada pelo molde, a exceção já basta: o molde
 * nunca é apagado.
 */
export async function deleteSingleCardRecurringOccurrence(params: {
  userId: string;
  templateId: string;
  invoiceLabel: string;
}) {
  const { userId, templateId, invoiceLabel } = params;

  const exceptionPayload = {
    user_id: userId,
    template_id: templateId,
    occurrence_date: invoiceLabel,
  };
  const { error: excErr } = await (supabase.from as any)('recurring_exceptions').insert(exceptionPayload);
  if (excErr && !`${excErr.message}`.toLowerCase().includes('duplicate')) throw excErr;

  const { data: dbRow } = await supabase
    .from('expenses')
    .select('id, invoice_month, is_recurring, frequency')
    .eq('id', templateId)
    .maybeSingle();

  if (!dbRow || !(dbRow as any).is_recurring) return;

  if ((dbRow as any).invoice_month === invoiceLabel) {
    const frequency = (dbRow as any).frequency;
    const nextLabel = addMonthsToLabel(invoiceLabel, frequency === 'yearly' || frequency === 'annual' ? 12 : 1);
    const { error: updErr } = await supabase.from('expenses').update({ invoice_month: nextLabel }).eq('id', templateId);
    if (updErr) throw updErr;
  }
}
