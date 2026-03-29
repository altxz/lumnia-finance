import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard, Calendar, Lock, Clock, AlertTriangle, Receipt, FileText, CheckCircle2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { getInvoicePeriod, matchExpensesToInvoice, formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface InvoiceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoicePeriod;
  allExpenses: Expense[];
  cards: CreditCardType[];
  wallets?: { id: string; name: string }[];
  onPaid?: () => void;
}

const STATUS_CONFIG = {
  open: { label: 'Fatura Aberta', icon: Clock, bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  closed: { label: 'Fatura Fechada', icon: Lock, bg: 'bg-muted', text: 'text-muted-foreground' },
  overdue: { label: 'Fatura Vencida', icon: AlertTriangle, bg: 'bg-destructive/15', text: 'text-destructive' },
  paid: { label: 'Fatura Paga', icon: CheckCircle2, bg: 'bg-primary/15', text: 'text-primary' },
} as const;

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    });
  }
  return options;
}

export function InvoiceDetailsModal({ open, onOpenChange, invoice, allExpenses, cards, wallets = [], onPaid }: InvoiceDetailsModalProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(`${new Date().getFullYear()}-${new Date().getMonth()}`);
  const [paying, setPaying] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || '');

  const currentCard = cards.find(c => c.id === invoice.cardId);

  const activeInvoice = useMemo(() => {
    if (!currentCard) return invoice;
    const [year, month] = selectedPeriod.split('-').map(Number);
    const period = getInvoicePeriod(currentCard, year, month);
    return matchExpensesToInvoice(allExpenses, period);
  }, [currentCard, selectedPeriod, allExpenses, invoice]);

  const statusInfo = STATUS_CONFIG[activeInvoice.status];
  const StatusIcon = statusInfo.icon;
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const isPaid = activeInvoice.status === 'paid';

  // Group by category
  const byCategory = useMemo(() => {
    const groups: Record<string, { label: string; total: number; items: Expense[] }> = {};
    activeInvoice.transactions.forEach(tx => {
      const cat = tx.final_category;
      if (!groups[cat]) {
        groups[cat] = { label: getCategoryInfo(cat).label, total: 0, items: [] };
      }
      groups[cat].total += tx.value;
      groups[cat].items.push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [activeInvoice.transactions]);

  const chronological = useMemo(() => {
    return [...activeInvoice.transactions].sort((a, b) => a.date.localeCompare(b.date));
  }, [activeInvoice.transactions]);

  const handlePayInvoice = async () => {
    if (!user || !selectedWalletId || activeInvoice.total <= 0) return;
    setPaying(true);

    try {
      // Create the payment transaction (debit from wallet)
      const dueDate = activeInvoice.dueDate;
      const dateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

      const { error: insertError } = await supabase.from('expenses').insert({
        user_id: user.id,
        description: `Pagamento fatura ${activeInvoice.cardName}`,
        value: activeInvoice.total,
        final_category: 'cartao',
        type: 'expense',
        date: dateStr,
        wallet_id: selectedWalletId,
        is_paid: true,
        invoice_month: activeInvoice.monthLabel,
      });

      if (insertError) throw insertError;

      toast({ title: 'Fatura paga!', description: `Pagamento de ${formatCurrency(activeInvoice.total)} registrado.` });
      onPaid?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao pagar fatura', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header card */}
      <div className="bg-primary rounded-2xl p-5 mx-4 mt-2 mb-4 text-primary-foreground">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span className="font-bold text-base">{activeInvoice.cardName}</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
            <StatusIcon className="h-3 w-3" />
            {statusInfo.label}
          </div>
        </div>

        <div className="text-3xl font-extrabold mb-1">{formatCurrency(activeInvoice.total)}</div>

        <div className="flex items-center gap-4 text-xs opacity-80">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Fecha em {formatInvoiceDate(activeInvoice.periodEnd)}
          </div>
          <div className="flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Vence em {formatInvoiceDate(activeInvoice.dueDate)}
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="px-4 mb-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions */}
      <ScrollArea className="flex-1 px-4 pb-4">
        {chronological.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma transação nesta fatura
          </div>
        ) : (
          <div className="space-y-4">
            {/* By category summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por categoria</h4>
              {byCategory.map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{data.label}</Badge>
                    <span className="text-xs text-muted-foreground">{data.items.length} transações</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(data.total)}</span>
                </div>
              ))}
            </div>

            {/* Full list */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Todas as transações</h4>
              {chronological.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {tx.installment_info && ` • ${tx.installment_info}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0 ml-3">
                    -{formatCurrency(tx.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer actions */}
      <div className="p-4 border-t border-border">
        {isPaid ? (
          <div className="flex items-center justify-center gap-2 py-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Fatura paga</span>
          </div>
        ) : activeInvoice.total > 0 ? (
          <div className="space-y-3">
            {wallets.length > 0 && (
              <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="w-full rounded-xl gap-2 bg-primary text-primary-foreground"
              disabled={paying || !selectedWalletId}
              onClick={handlePayInvoice}
            >
              <Receipt className="h-4 w-4" />
              {paying ? 'Pagando...' : `Pagar Fatura (${formatCurrency(activeInvoice.total)})`}
            </Button>
          </div>
        ) : (
          <div className="text-center py-2 text-muted-foreground text-sm">
            Nenhum valor a pagar
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="text-base">Detalhes da Fatura</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base">Detalhes da Fatura</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
