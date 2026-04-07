import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns true if the expense is an invoice payment record (should be excluded from category aggregations) */
export function isInvoicePayment(e: { description?: string }): boolean {
  return !!(e.description && e.description.startsWith('Pagamento fatura'));
}
