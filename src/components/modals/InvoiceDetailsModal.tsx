import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { InvoiceHeader } from './invoice/InvoiceHeader';
import { InvoiceTransactionList } from './invoice/InvoiceTransactionList';
import { InvoicePaymentFooter } from './invoice/InvoicePaymentFooter';
import { DeleteConfirmDialog } from './invoice/DeleteConfirmDialog';

interface InvoiceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoicePeriod;
  allExpenses: Expense[];
  cards: CreditCardType[];
  wallets?: { id: string; name: string }[];
  onPaid?: () => void;
  refetch?: () => void;
}

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

export function InvoiceDetailsModal({ open, onOpenChange, invoice, allExpenses, cards, wallets = [], onPaid, refetch }: InvoiceDetailsModalProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const [y, m] = invoice.monthLabel.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m)) return `${y}-${m - 1}`;
    return `${new Date().getFullYear()}-${new Date().getMonth()}`;
  });
  const [paying, setPaying] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'all' | null>(null);

  const currentCard = cards.find(c => c.id === invoice.cardId);

  const activeInvoice = useMemo(() => {
    if (!currentCard) return invoice;
    const [year, month] = selectedPeriod.split('-').map(Number);
    const period = getInvoicePeriod(currentCard, year, month);
    return matchExpensesToInvoice(allExpenses, period);
  }, [currentCard, selectedPeriod, allExpenses, invoice]);

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const isPaid = activeInvoice.status === 'paid';

  const handleDelete = async (expense: Expense, mode: 'single' | 'all') => {
    try {
      if (mode === 'all' && expense.installment_group_id) {
        const { error } = await supabase.from('expenses').delete().eq('installment_group_id', expense.installment_group_id);
        if (error) throw error;
        toast({ title: 'Parcelas excluídas', description: 'Todas as parcelas foram removidas.' });
      } else {
        const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
        if (error) throw error;
        toast({ title: 'Transação excluída' });
      }
      refetch?.();
      onPaid?.();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
      setDeleteMode(null);
    }
  };

  const onDeleteClick = (tx: Expense) => {
    setDeleteTarget(tx);
    setDeleteMode(tx.installment_group_id ? null : 'single');
  };

  const handleUnpayInvoice = async () => {
    if (!user) return;
    try {
      const legacyDescriptionPrefix = `Pagamento fatura ${activeInvoice.cardName}`;
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user.id)
        .eq('invoice_month', activeInvoice.monthLabel)
        .or(`credit_card_id.eq.${activeInvoice.cardId},description.ilike.${legacyDescriptionPrefix}%`)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não encontrei um pagamento registrado para esta fatura.');
      }

      toast({ title: 'Pagamento desfeito', description: 'A fatura voltou ao status anterior.' });
      refetch?.();
      onPaid?.();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handlePayInvoice = async (walletId: string, dateMode: 'due' | 'today' | 'custom', customDate?: Date) => {
    if (!user || !walletId || activeInvoice.total <= 0) return;
    setPaying(true);

    try {
      const dateStr = (() => {
        if (dateMode === 'today') {
          const today = new Date();
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }
        if (dateMode === 'custom' && customDate) {
          return `${customDate.getFullYear()}-${String(customDate.getMonth() + 1).padStart(2, '0')}-${String(customDate.getDate()).padStart(2, '0')}`;
        }
        const dueDate = activeInvoice.dueDate;
        return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
      })();

      const { error: insertError } = await supabase.from('expenses').insert({
        user_id: user.id,
        description: `Pagamento fatura ${activeInvoice.cardName} - ${activeInvoice.monthLabel}`,
        value: activeInvoice.total,
        final_category: 'cartao',
        type: 'expense',
        date: dateStr,
        wallet_id: walletId,
        credit_card_id: activeInvoice.cardId,
        is_paid: true,
        invoice_month: activeInvoice.monthLabel,
      });

      if (insertError) throw insertError;

      toast({ title: 'Fatura paga!', description: `Pagamento de R$ ${activeInvoice.total.toFixed(2)} registrado.` });
      refetch?.();
      onPaid?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao pagar fatura', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
        <div className="space-y-5 py-4">
          <InvoiceHeader invoice={activeInvoice} />

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="rounded-xl min-h-11">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <InvoiceTransactionList
            transactions={activeInvoice.transactions}
            onEdit={setEditingExpense}
            onDelete={onDeleteClick}
          />
        </div>
      </div>

      <InvoicePaymentFooter
        isPaid={isPaid}
        total={activeInvoice.total}
        hasTransactions={activeInvoice.transactions.length > 0}
        dueDate={activeInvoice.dueDate}
        wallets={wallets}
        paying={paying}
        onPay={handlePayInvoice}
        onUnpay={handleUnpayInvoice}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        mode={deleteMode}
        onClose={() => { setDeleteTarget(null); setDeleteMode(null); }}
        onDelete={handleDelete}
      />

      {editingExpense && (
        <EditExpenseModal
          open={!!editingExpense}
          expense={editingExpense}
          onOpenChange={(v) => { if (!v) setEditingExpense(null); }}
          onExpenseUpdated={() => {
            setEditingExpense(null);
            refetch?.();
            onPaid?.();
          }}
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] px-0 flex flex-col overflow-hidden">
          <DrawerHeader className="pb-1 shrink-0 px-5">
            <DrawerTitle className="text-lg font-bold">Detalhes da Fatura</DrawerTitle>
            <DrawerDescription className="sr-only">
              Visualize as transações da fatura, valores por categoria e ações de pagamento.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="p-5 pb-1 shrink-0">
          <DialogTitle className="text-lg font-bold">Detalhes da Fatura</DialogTitle>
          <DialogDescription className="sr-only">
            Visualize as transações da fatura, valores por categoria e ações de pagamento.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
