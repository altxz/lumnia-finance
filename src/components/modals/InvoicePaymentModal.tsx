import { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, CheckCircle2, Loader2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { InvoicePeriod } from '@/lib/invoiceHelpers';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface InvoicePaymentWallet {
  id: string;
  name: string;
  detail?: string;
}

interface InvoicePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Pick<InvoicePeriod, 'cardName' | 'monthLabel' | 'total'>;
  wallets: InvoicePaymentWallet[];
  submitting?: boolean;
  onConfirm: (walletId: string, paymentDate: string) => Promise<void> | void;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(date: Date) {
  return date
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\sde\s/g, ' ');
}

/**
 * Único ponto de interação para quitar uma fatura.
 * A data é a data em que o dinheiro saiu da conta, nunca o vencimento por padrão.
 */
export function InvoicePaymentModal({
  open,
  onOpenChange,
  invoice,
  wallets,
  submitting = false,
  onConfirm,
}: InvoicePaymentModalProps) {
  const today = useMemo(() => new Date(), []);
  const [walletId, setWalletId] = useState('');
  const [dateChoice, setDateChoice] = useState<'today' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWalletId((current) => wallets.some((wallet) => wallet.id === current) ? current : (wallets[0]?.id ?? ''));
    setDateChoice('today');
    setCustomDate(undefined);
    setCalendarOpen(false);
  }, [open, wallets]);

  const paymentDate = dateChoice === 'custom' ? customDate : today;
  const canConfirm = !!walletId && !!paymentDate && invoice.total > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-md rounded-2xl sm:w-full">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription className="text-pretty">
            Escolha a conta debitada e a data em que o pagamento foi realizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl bg-muted/70 px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">Valor da fatura</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(invoice.total)}</p>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {invoice.cardName} · {new Date(`${invoice.monthLabel}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-payment-wallet">Debitar de qual conta?</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger id="invoice-payment-wallet" className="h-12 rounded-xl">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.detail ? `${wallet.name} · ${wallet.detail}` : wallet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {wallets.length === 0 && (
              <p className="text-sm text-destructive">Cadastre uma conta antes de registrar o pagamento.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button
                type="button"
                variant={dateChoice === 'today' ? 'default' : 'outline'}
                className="h-auto min-h-14 w-full min-w-0 justify-start rounded-xl px-3 py-2 text-left whitespace-normal"
                onClick={() => setDateChoice('today')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs opacity-80">Hoje</span>
                  <span className="block break-words text-sm font-semibold leading-snug">{formatDate(today)}</span>
                </span>
              </Button>

              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={dateChoice === 'custom' ? 'default' : 'outline'}
                    className="h-auto min-h-14 w-full min-w-0 justify-start rounded-xl px-3 py-2 text-left whitespace-normal"
                    onClick={() => {
                      setDateChoice('custom');
                      setCalendarOpen(true);
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs opacity-80">Outra data</span>
                      <span className="block break-words text-sm font-semibold leading-snug">{customDate ? formatDate(customDate) : 'Escolher data'}</span>
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[80] w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setCustomDate(date);
                      setDateChoice('custom');
                      setCalendarOpen(false);
                    }}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
              A fatura será exibida na data escolhida no fluxo de caixa e nas transações.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl gap-2 whitespace-normal sm:w-auto"
            disabled={!canConfirm}
            onClick={() => {
              if (!paymentDate) return;
              void onConfirm(walletId, dateKey(paymentDate));
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {submitting ? 'Registrando...' : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
