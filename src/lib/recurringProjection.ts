export function normalizeRecurringDescription(description?: string | null) {
  return (description ?? '').trim().toLowerCase();
}

export function buildRecurringSignature(type: string, value: number, description?: string | null) {
  return `${type}|${normalizeRecurringDescription(description)}|${Number(value).toFixed(2)}`;
}

export function buildMonthRecurringSignature(monthKey: string, type: string, value: number, description?: string | null) {
  return `${monthKey}|${buildRecurringSignature(type, value, description)}`;
}