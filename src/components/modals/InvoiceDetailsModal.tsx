import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreditCard, Calendar, Lock, Clock, AlertTriangle, Receipt, CheckCircle2, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import { getInvoicePeriod, matchExpensesToInvoice, formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { EditExpenseModal } from '@/components/EditExpenseModal';
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
  refetch?: () => void;
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

export function InvoiceDetailsModal({ open, onOpenChange, invoice, allExpenses, cards, wallets = [], onPaid, refetch }: InvoiceDetailsModalProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(`${new Date().getFullYear()}-${new Date().getMonth()}`);
  const [paying, setPaying] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || '');
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

  const statusInfo = STATUS_CONFIG[activeInvoice.status];
  const StatusIcon = statusInfo.icon;
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const isPaid = activeInvoice.status === 'paid';

  const byCategory = useMemo(() => {
    const groups: Record<string, { label: string; total: number; items: Expense[] }> = {};
    activeInvoice.transactions.forEach(tx => {
      const cat = tx.final_category;
      if (!groups[cat]) {
        groups[cat] = { label: getCategoryLabel(cat), total: 0, items: [] };
      }
      groups[cat].total += tx.value;
      groups[cat].items.push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [activeInvoice.transactions]);

  const chronological = useMemo(() => {
    return [...activeInvoice.transactions].sort((a, b) => a.date.localeCompare(b.date));
  }, [activeInvoice.transactions]);

  const handleDelete = async (expense: Expense, mode: 'single' | 'all') => {
    try {
      if (mode === 'all' && expense.installment_group_id) {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('installment_group_id', expense.installment_group_id);
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
    if (tx.installment_group_id) {
      setDeleteTarget(tx);
      setDeleteMode(null); // show choice dialog
    } else {
      setDeleteTarget(tx);
      setDeleteMode('single'); // show simple confirm
    }
  };

  const handleUnpayInvoice = async () => {
    if (!user) return;
    try {
      // Delete the "Pagamento fatura X" record that marks this invoice as paid
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user.id)
        .ilike('description', `Pagamento fatura ${activeInvoice.cardName}`)
        .eq('invoice_month', activeInvoice.monthLabel);
      if (error) throw error;
      toast({ title: 'Pagamento desfeito', description: 'A fatura voltou ao status anterior.' });
      refetch?.();
      onPaid?.();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handlePayInvoice = async () => {
    if (!user || !selectedWalletId || activeInvoice.total <= 0) return;
    setPaying(true);

    try {
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
      <ScrollArea className="min-h-0 flex-1 px-3 sm:px-4">
        <div className="space-y-4 pb-4">
          <div className="bg-primary rounded-2xl p-4 sm:p-5 mt-2 text-primary-foreground overflow-hidden shrink-0">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CreditCard className="h-5 w-5 shrink-0" />
                <span className="font-bold text-sm sm:text-base truncate">{activeInvoice.cardName}</span>
              </div>
              <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
                <StatusIcon className="h-3 w-3" />
                <span className="whitespace-nowrap">{statusInfo.label}</span>
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold mb-1 break-words">{formatCurrency(activeInvoice.total)}</div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
              <div className="flex items-center gap-1 min-w-0">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="break-words">Fecha em {formatInvoiceDate(activeInvoice.periodEnd)}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <Receipt className="h-3 w-3 shrink-0" />
                <span className="break-words">Vence em {formatInvoiceDate(activeInvoice.dueDate)}</span>
              </div>
            </div>
          </div>

          <div>
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

          {chronological.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma transação nesta fatura
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por categoria</h4>
                {byCategory.map(([cat, data]) => (
                  <div key={cat} className="flex items-center justify-between py-1.5 gap-2 w-full max-w-full overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <Badge variant="secondary" className="text-xs shrink-0">{data.label}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{data.items.length} transações</span>
                    </div>
                    <span className="text-sm font-bold shrink-0 whitespace-nowrap">{formatCurrency(data.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Todas as transações</h4>
                {chronological.map(tx => (
                  <div key={tx.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 border-b border-border last:border-0 w-full items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        {tx.installment_info && ` • ${tx.installment_info}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 justify-center pl-1 shrink-0">
                      <span className="text-sm font-bold text-destructive whitespace-nowrap">
                        -{formatCurrency(tx.value)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingExpense(tx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteClick(tx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border shrink-0 bg-background px-4 py-4 pb-6 sm:pb-4">
        {isPaid ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Fatura paga</span>
            </div>
            <Button
              variant="outline"
              className="w-full min-h-11 rounded-xl gap-2 whitespace-normal text-center"
              onClick={handleUnpayInvoice}
            >
              <Undo2 className="h-4 w-4 shrink-0" />
              <span className="break-words">Desfazer pagamento da fatura</span>
            </Button>
          </div>
        ) : activeInvoice.total > 0.01 && chronological.length > 0 ? (
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
              className="w-full min-h-11 rounded-xl gap-2"
              disabled={paying || !selectedWalletId}
              onClick={handlePayInvoice}
            >
              <Receipt className="h-4 w-4" />
              <span className="break-words">{paying ? 'Pagando...' : `Pagar Fatura (${formatCurrency(activeInvoice.total)})`}</span>
            </Button>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm font-medium">
            Nenhum valor a pagar
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteMode(null); } }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.installment_group_id && deleteMode === null
                ? 'Excluir parcela'
                : 'Excluir transação?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.installment_group_id && deleteMode === null
                ? `Esta é a parcela ${deleteTarget.installment_info}. O que deseja excluir?`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={deleteTarget?.installment_group_id && deleteMode === null ? 'flex-col gap-2 sm:flex-col' : ''}>
            {deleteTarget?.installment_group_id && deleteMode === null ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => { if (deleteTarget) handleDelete(deleteTarget, 'single'); }}
                >
                  Apenas esta parcela
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => { if (deleteTarget) handleDelete(deleteTarget, 'all'); }}
                >
                  Todas as parcelas do grupo
                </Button>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              </>
            ) : (
              <>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (deleteTarget) handleDelete(deleteTarget, 'single'); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                >
                  Excluir
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit modal */}
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
          <DrawerHeader className="pb-2 shrink-0">
            <DrawerTitle className="text-base">Detalhes da Fatura</DrawerTitle>
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
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="text-base">Detalhes da Fatura</DialogTitle>
          <DialogDescription className="sr-only">
            Visualize as transações da fatura, valores por categoria e ações de pagamento.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
