import { describe, expect, it } from 'vitest';
import {
  addMonthsToLabel,
  buildVirtualCardOccurrence,
  getCardRecurringTemplates,
  monthsBetweenLabels,
  shouldProjectCardRecurringInLabel,
} from '@/lib/recurringCardProjection';
import { getCardRecurringPurchaseDate, getPaymentDate, getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';

// Same card as the real "Nubank Crédito" case that surfaced the bug: closing
// day ~29 (relative, due_day 5, closing_days_before_due 6), so a purchase on
// day 30 always rolls two invoices ahead of the calendar month it happened in.
const card = { closing_day: 1, due_day: 5, closing_strategy: 'relative', closing_days_before_due: 6 };
const cardWithId = { id: 'card-1', name: 'Nubank Crédito', limit_amount: 5000, ...card };

function makeTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'template-1',
    user_id: 'user-1',
    type: 'expense',
    description: 'Claude',
    final_category: 'assinaturas',
    value: 118.4,
    date: '2026-08-30',
    invoice_month: '2026-10',
    credit_card_id: 'card-1',
    is_recurring: true,
    is_paid: true,
    frequency: 'monthly',
    wallet_id: null,
    ...overrides,
  } as any;
}

describe('shouldProjectCardRecurringInLabel', () => {
  it('never projects into the origin invoice itself', () => {
    expect(shouldProjectCardRecurringInLabel({ frequency: 'monthly' }, '2026-10', '2026-10')).toBe(false);
  });

  it('never projects into an invoice before the origin', () => {
    expect(shouldProjectCardRecurringInLabel({ frequency: 'monthly' }, '2026-10', '2026-09')).toBe(false);
  });

  it('projects into every subsequent invoice when monthly', () => {
    expect(shouldProjectCardRecurringInLabel({ frequency: 'monthly' }, '2026-10', '2026-11')).toBe(true);
    expect(shouldProjectCardRecurringInLabel({ frequency: 'monthly' }, '2026-10', '2027-03')).toBe(true);
  });

  it('only projects yearly recurrences on anniversaries', () => {
    expect(shouldProjectCardRecurringInLabel({ frequency: 'yearly' }, '2026-10', '2027-09')).toBe(false);
    expect(shouldProjectCardRecurringInLabel({ frequency: 'yearly' }, '2026-10', '2027-10')).toBe(true);
  });
});

describe('getCardRecurringPurchaseDate (inverse of getPaymentDate)', () => {
  it('round-trips: purchase -> invoice label -> back to the same purchase month/day', () => {
    const cases: Array<[string, number]> = [
      ['2026-08-30', 30],
      ['2026-09-30', 30],
      ['2026-08-01', 1],
      ['2026-10-31', 31],
    ];
    for (const [purchaseDate, day] of cases) {
      const label = `${getPaymentDate(purchaseDate, card).getFullYear()}-${String(getPaymentDate(purchaseDate, card).getMonth() + 1).padStart(2, '0')}`;
      const inverted = getCardRecurringPurchaseDate(day, card, label);
      expect(inverted.toISOString().slice(0, 10)).toBe(new Date(`${purchaseDate}T12:00:00`).toISOString().slice(0, 10));
    }
  });
});

describe('getCardRecurringTemplates', () => {
  it('only returns recurring expense templates for the given card', () => {
    const other = makeTemplate({ id: 'other-card', credit_card_id: 'card-2' });
    const paymentRecord = makeTemplate({ id: 'payment', description: 'Pagamento fatura Nubank - 2026-10', is_recurring: false });
    const templates = getCardRecurringTemplates([makeTemplate(), other, paymentRecord], 'card-1');
    expect(templates.map(t => t.id)).toEqual(['template-1']);
  });
});

describe('matchExpensesToInvoice — card recurring projection', () => {
  it('does not show the recurring charge in an invoice before its origin', () => {
    const period = getInvoicePeriod(cardWithId, 2026, 8); // due month 2026-09 (index 8)
    const invoice = matchExpensesToInvoice([makeTemplate()], period);
    expect(invoice.transactions).toHaveLength(0);
  });

  it('shows the origin occurrence exactly once in its own invoice', () => {
    const period = getInvoicePeriod(cardWithId, 2026, 9); // due month 2026-10
    const invoice = matchExpensesToInvoice([makeTemplate()], period);
    expect(invoice.transactions).toHaveLength(1);
    expect(invoice.transactions[0].id).toBe('template-1');
  });

  it('projects a virtual occurrence into the next invoice, one month later', () => {
    const period = getInvoicePeriod(cardWithId, 2026, 10); // due month 2026-11
    const invoice = matchExpensesToInvoice([makeTemplate()], period);
    expect(invoice.transactions).toHaveLength(1);
    const [virtual] = invoice.transactions;
    expect(virtual.id).toBe('template-1'); // same id as the template, per debit-side convention
    expect(virtual.invoice_month).toBe('2026-11');
    expect(virtual.is_paid).toBe(false);
    expect(virtual.date).toBe('2026-09-30'); // purchase-equivalent date for the Nov invoice
  });

  it('does not duplicate once a real materialized copy exists for that invoice', () => {
    const period = getInvoicePeriod(cardWithId, 2026, 10); // due month 2026-11
    const materialized = makeTemplate({
      id: 'materialized-nov',
      invoice_month: '2026-11',
      is_recurring: false,
      is_paid: false,
      date: '2026-09-30',
    });
    const invoice = matchExpensesToInvoice([makeTemplate(), materialized], period);
    expect(invoice.transactions).toHaveLength(1);
    expect(invoice.transactions[0].id).toBe('materialized-nov');
  });

  it('keeps projecting several invoices ahead if none were materialized yet', () => {
    const period = getInvoicePeriod(cardWithId, 2027, 0); // due month 2027-01
    const invoice = matchExpensesToInvoice([makeTemplate()], period);
    expect(invoice.transactions).toHaveLength(1);
    expect(invoice.transactions[0].invoice_month).toBe('2027-01');
  });
});

describe('buildVirtualCardOccurrence', () => {
  it('preserves the template id and overrides invoice_month/date/is_paid', () => {
    const template = makeTemplate();
    const virtual = buildVirtualCardOccurrence(template, '2026-11', '2026-09-30');
    expect(virtual.id).toBe(template.id);
    expect(virtual.invoice_month).toBe('2026-11');
    expect(virtual.date).toBe('2026-09-30');
    expect(virtual.is_paid).toBe(false);
    expect(virtual.value).toBe(template.value);
  });
});

describe('label arithmetic', () => {
  it('addMonthsToLabel/monthsBetweenLabels round-trip', () => {
    expect(addMonthsToLabel('2026-10', 1)).toBe('2026-11');
    expect(addMonthsToLabel('2026-12', 1)).toBe('2027-01');
    expect(monthsBetweenLabels('2026-10', '2027-01')).toBe(3);
  });
});
