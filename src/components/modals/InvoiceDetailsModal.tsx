import { useMemo, useState } from 'react';
import { ResponsiveModal, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription } from '@/components/ui/responsive-modal';
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
import { showFriendlyError } from '@/lib/errorHandler';
import { resolveVirtualCardTemplateId } from '@/lib/recurringCardProjection';

import { InvoiceHeader } from './invoice/InvoiceHeader';
import { InvoiceTransactionList } from './invoice/InvoiceTransactionList';
import { InvoicePaymentFooter } from './invoice/InvoicePaymentFooter';
import { DeleteConfirmDialog } from './invoice/DeleteConfirmDialog';
import { InvoicePaymentModal } from './InvoicePaymentModal';

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
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
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

  // Ocorrências projetadas de recorrências fixas do cartão não existem no banco —
  // qualquer ação deve agir sobre o registro original (template).
  const resolveRealExpense = (tx: Expense): Expense => {
    const templateId = resolveVirtualCardTemplateId(tx.id);
    if (!templateId) return tx;
    return allExpenses.find(e => e.id === templateId) ?? tx;
  };

  const handleDelete = async (expense: Expense, mode: 'single' | 'all') => {
    if (!user) return;
    try {
      if (mode === 'all' && expense.installment_group_id) {
        const { error } = await supabase.from('expenses').delete()
          .eq('installment_group_id', expense.installment_group_id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Parcelas excluídas', description: 'Todas as parcelas foram removidas.' });
      } else {
        const { error } = await supabase.from('expenses').delete().eq('id', expense.id).eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Transação excluída' });
      }
      refetch?.();
      onPaid?.();
    } catch (err: any) {
      showFriendlyError(err);
    } finally {
      setDeleteTarget(null);
      setDeleteMode(null);
    }
  };

  const onDeleteClick = (tx: Expense) => {
    const real = resolveRealExpense(tx);
    setDeleteTarget(real);
    setDeleteMode(real.installment_group_id ? null : 'single');
  };

  const handleUnpayInvoice = async () => {
    if (!user) return;
    try {
      // Only delete the PAYMENT RECORD, not regular card transactions.
      // Payment records always have: wallet_id set, description starting with 'Pagamento fatura'
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user.id)
        .eq('credit_card_id', activeInvoice.cardId)
        .eq('invoice_month', activeInvoice.monthLabel)
        .ilike('description', 'Pagamento fatura%')
        .not('wallet_id', 'is', null)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não encontrei um pagamento registrado para esta fatura.');
      }

      toast({ title: 'Pagamento desfeito', description: 'A fatura voltou ao status anterior.' });
      refetch?.();
      onPaid?.();
    } catch (err: any) {
      showFriendlyError(err);
    }
  };

  const handlePayInvoice = async (walletId: string, paymentDate: string) => {
    if (!user || !walletId || activeInvoice.total <= 0) return;
    setPaying(true);

    try {
      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', user.id)
        .eq('credit_card_id', activeInvoice.cardId)
        .eq('invoice_month', activeInvoice.monthLabel)
        .ilike('description', 'Pagamento fatura%')
        .limit(1)
        .maybeSingle();

      if (existingPaymentError) throw existingPaymentError;
      if (existingPayment) {
        toast({ title: 'Fatura já paga', description: 'Já existe um pagamento registrado para esta fatura.' });
        refetch?.();
        return;
      }

      const { error: insertError } = await supabase.from('expenses').insert({
        user_id: user.id,
        description: `Pagamento fatura ${activeInvoice.cardName} - ${activeInvoice.monthLabel}`,
        value: activeInvoice.total,
        final_category: 'cartao',
        type: 'expense',
        date: paymentDate,
        wallet_id: walletId,
        credit_card_id: activeInvoice.cardId,
        is_paid: true,
        invoice_month: activeInvoice.monthLabel,
      });

      if (insertError) throw insertError;

      toast({ title: 'Fatura paga!', description: `Pagamento de R$ ${activeInvoice.total.toFixed(2)} registrado.` });
      refetch?.();
      onPaid?.();
      setPaymentDialogOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      showFriendlyError(err, 'Erro ao pagar fatura');
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
            onEdit={(tx) => setEditingExpense(resolveRealExpense(tx))}
            onDelete={onDeleteClick}
          />
        </div>
      </div>

      <InvoicePaymentFooter
        isPaid={isPaid}
        total={activeInvoice.total}
        hasTransactions={activeInvoice.transactions.length > 0}
        onOpenPayment={() => setPaymentDialogOpen(true)}
        onUnpay={handleUnpayInvoice}
      />

      <InvoicePaymentModal
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={activeInvoice}
        wallets={wallets}
        submitting={paying}
        onConfirm={handlePayInvoice}
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
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] px-0 flex flex-col overflow-hidden !bg-popover rounded-t-[28px] border-border/80">
          <DrawerHeader className="pb-1 shrink-0 px-5">
            <DrawerTitle className="text-lg font-semibold">Detalhes da fatura</DrawerTitle>
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
    <ResponsiveModal open={open} onOpenChange={onOpenChange} className="max-w-lg max-h-[90dvh] rounded-2xl">
        <ResponsiveModalHeader className="p-5 pb-1 shrink-0">
          <ResponsiveModalTitle className="text-lg font-semibold">Detalhes da fatura</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Visualize as transações da fatura, valores por categoria e ações de pagamento.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {content}
    </ResponsiveModal>
  );
}
