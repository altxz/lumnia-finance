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
    <div className="bg-primary rounded-2xl p-5 sm:p-6 text-primary-foreground">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CreditCard className="h-5 w-5 shrink-0" />
          <span className="font-bold text-sm sm:text-base truncate">{invoice.cardName}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-full shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap">{statusInfo.label}</span>
        </div>
      </div>

      <div className="text-3xl sm:text-4xl font-extrabold mb-2 break-words tracking-tight">
        {formatCurrency(invoice.total)}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs opacity-80">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>Fecha em {formatInvoiceDate(invoice.periodEnd)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 shrink-0" />
          <span>Vence em {formatInvoiceDate(invoice.dueDate)}</span>
        </div>
      </div>
    </div>
  );
}
