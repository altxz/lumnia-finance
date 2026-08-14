import type { CreditCard } from './invoiceHelpers';

type PaymentLike = {
  credit_card_id?: string | null;
  description?: string | null;
  final_category?: string | null;
  type?: string | null;
};

const PAYMENT_PREFIX_RE = /^pagamento(?: de)? fatura\s*/i;

function normalize(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

export function getCreditCardPaymentCardId(item: PaymentLike, creditCards: CreditCard[] = []) {
  if (item.credit_card_id) return item.credit_card_id;

  const description = normalize(item.description).replace(PAYMENT_PREFIX_RE, '');
  if (!description) return null;

  const matched = creditCards.find((card) => description.startsWith(normalize(card.name)));
  return matched?.id ?? null;
}

export function isTrackedCreditCardPayment(item: PaymentLike, creditCards: CreditCard[] = []) {
  if (item.type === 'income' || item.type === 'transfer') return false;

  const description = normalize(item.description);
  const category = normalize(item.final_category);
  const looksLikePayment =
    description.includes('fatura') ||
    category.includes('cartão') ||
    category.includes('cartao');

  if (!looksLikePayment) return false;

  return !!getCreditCardPaymentCardId(item, creditCards);
}

export function isCreditCardPaymentLabel(description?: string | null) {
  return PAYMENT_PREFIX_RE.test(description ?? '');
}

export function getCreditCardPaymentLabelCardName(description?: string | null) {
  return normalize(description).replace(PAYMENT_PREFIX_RE, '').split(' - ')[0];
}