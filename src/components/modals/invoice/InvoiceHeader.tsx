import { CreditCard, Calendar, Receipt, Clock, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { InvoicePeriod } from '@/lib/invoiceHelpers';

const STATUS_CONFIG = {
  open: { label: 'Fatura Aberta', icon: Clock, bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  closed: { label: 'Fatura Fechada', icon: Lock, bg: 'bg-muted', text: 'text-muted-foreground' },
  overdue: { label: 'Fatura Vencida', icon: AlertTriangle, bg: 'bg-destructive/15', text: 'text-destructive' },
  paid: { label: 'Fatura Paga', icon: CheckCircle2, bg: 'bg-primary/15', text: 'text-primary' },
} as const;

interface InvoiceHeaderProps {
  invoice: InvoicePeriod & { total: number; transactions: any[] };
}

export function InvoiceHeader({ invoice }: InvoiceHeaderProps) {
  const statusInfo = STATUS_CONFIG[invoice.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-foreground">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CreditCard className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm truncate">{invoice.cardName}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon className="h-3 w-3" />
          <span className="whitespace-nowrap">{statusInfo.label}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] break-words">
          {formatCurrency(invoice.total)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Fecha {formatInvoiceDate(invoice.periodEnd)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Receipt className="h-3 w-3 shrink-0" />
            <span>Vence {formatInvoiceDate(invoice.dueDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
