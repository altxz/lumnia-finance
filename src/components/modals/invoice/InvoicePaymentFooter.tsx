import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  const dueLabel = `Vencimento (${dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;
  const todayLabel = `Hoje (${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;
  const customLabel = payCustomDate
    ? payCustomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Escolher data...';

  return (
    <div className="border-t border-border shrink-0 bg-card/95 px-4 py-3 pb-safe sm:pb-3 backdrop-blur-xl">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {wallets.length > 0 && (
            <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
              <SelectTrigger className="rounded-xl h-10 text-xs">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={payDateMode}
            onValueChange={(v: 'due' | 'today' | 'custom') => {
              setPayDateMode(v);
              if (v === 'custom') setCalendarOpen(true);
            }}
          >
            <SelectTrigger className="rounded-xl h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due">{dueLabel}</SelectItem>
              <SelectItem value="today">{todayLabel}</SelectItem>
              <SelectItem value="custom">
                {payDateMode === 'custom' && payCustomDate ? customLabel : 'Personalizada...'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {payDateMode === 'custom' && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs h-10 justify-start"
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                {customLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[60]" align="start">
              <Calendar
                mode="single"
                selected={payCustomDate}
                onSelect={(d) => { setPayCustomDate(d); setCalendarOpen(false); }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}

        <Button
          className="w-full h-11 rounded-xl gap-2 text-sm font-semibold"
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
