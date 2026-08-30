import { Button } from '@/components/ui/button';
import { Receipt, CheckCircle2, Undo2 } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

interface InvoicePaymentFooterProps {
  isPaid: boolean;
  total: number;
  hasTransactions: boolean;
  onOpenPayment: () => void;
  onUnpay: () => void;
}

export function InvoicePaymentFooter({
  isPaid, total, hasTransactions, onOpenPayment, onUnpay,
}: InvoicePaymentFooterProps) {
  if (isPaid) {
    return (
      <div className="border-t border-border shrink-0 bg-card/95 px-4 py-3 pb-safe sm:pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary flex-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold text-sm">Fatura paga</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={onUnpay}
          >
            <Undo2 className="h-3.5 w-3.5 shrink-0" />
            Desfazer
          </Button>
        </div>
      </div>
    );
  }

  if (total <= 0.01 || !hasTransactions) {
    return (
      <div className="border-t border-border shrink-0 bg-card/95 px-4 py-3 pb-safe sm:pb-3 backdrop-blur-xl">
        <div className="text-center text-muted-foreground text-sm font-medium">
          Nenhum valor a pagar
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border shrink-0 bg-card/95 px-4 py-3 pb-safe sm:pb-3 backdrop-blur-xl">
      <Button className="w-full h-11 rounded-xl gap-2 text-sm font-semibold" onClick={onOpenPayment}>
        <Receipt className="h-4 w-4" />
        {`Pagar Fatura (${formatCurrency(total)})`}
      </Button>
    </div>
  );
}
