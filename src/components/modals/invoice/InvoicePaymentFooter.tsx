import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Receipt, CheckCircle2, Undo2, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/constants';

interface InvoicePaymentFooterProps {
  isPaid: boolean;
  total: number;
  hasTransactions: boolean;
  dueDate: Date;
  wallets: { id: string; name: string }[];
  paying: boolean;
  onPay: (walletId: string, dateMode: 'due' | 'today' | 'custom', customDate?: Date) => void;
  onUnpay: () => void;
}

export function InvoicePaymentFooter({
  isPaid, total, hasTransactions, dueDate, wallets, paying, onPay, onUnpay,
}: InvoicePaymentFooterProps) {
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || '');
  const [payDateMode, setPayDateMode] = useState<'due' | 'today' | 'custom'>('due');
  const [payCustomDate, setPayCustomDate] = useState<Date | undefined>(undefined);

  if (isPaid) {
    return (
      <div className="border-t border-border shrink-0 bg-background px-5 py-5 pb-7 sm:pb-5">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold text-sm">Fatura paga</span>
          </div>
          <Button
            variant="outline"
            className="w-full min-h-12 rounded-xl gap-2 text-sm"
            onClick={onUnpay}
          >
            <Undo2 className="h-4 w-4 shrink-0" />
            Desfazer pagamento
          </Button>
        </div>
      </div>
    );
  }

  if (total <= 0.01 || !hasTransactions) {
    return (
      <div className="border-t border-border shrink-0 bg-background px-5 py-5 pb-7 sm:pb-5">
        <div className="text-center py-2 text-muted-foreground text-sm font-medium">
          Nenhum valor a pagar
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border shrink-0 bg-background px-5 py-5 pb-7 sm:pb-5">
      <div className="space-y-4">
        {wallets.length > 0 && (
          <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
            <SelectTrigger className="rounded-xl min-h-11">
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Data do pagamento:</p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant={payDateMode === 'due' ? 'default' : 'outline'}
              className="rounded-xl text-xs justify-start min-h-10 px-3"
              onClick={() => setPayDateMode('due')}
            >
              Data de vencimento ({dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={payDateMode === 'today' ? 'default' : 'outline'}
              className="rounded-xl text-xs justify-start min-h-10 px-3"
              onClick={() => setPayDateMode('today')}
            >
              Data de hoje ({new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={payDateMode === 'custom' ? 'default' : 'outline'}
              className="rounded-xl text-xs justify-start min-h-10 px-3"
              onClick={() => setPayDateMode('custom')}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              {payDateMode === 'custom' && payCustomDate
                ? payCustomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : 'Escolher data'}
            </Button>
            {payDateMode === 'custom' && (
              <div className="flex justify-center pt-1">
                <Calendar
                  mode="single"
                  selected={payCustomDate}
                  onSelect={setPayCustomDate}
                  className={cn("p-3 pointer-events-auto rounded-xl border")}
                />
              </div>
            )}
          </div>
        </div>

        <Button
          className="w-full min-h-12 rounded-xl gap-2 text-sm font-semibold"
          disabled={paying || !selectedWalletId || (payDateMode === 'custom' && !payCustomDate)}
          onClick={() => onPay(selectedWalletId, payDateMode, payCustomDate)}
        >
          <Receipt className="h-4 w-4" />
          {paying ? 'Pagando...' : `Pagar Fatura (${formatCurrency(total)})`}
        </Button>
      </div>
    </div>
  );
}
