import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CreditCard, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { InvoicePaymentModal } from '@/components/modals/InvoicePaymentModal';

type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  expense_id?: string | null;
}

interface WalletOption { id: string; name: string }

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);

  // Pay invoice from notification (credit card)
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payNotification, setPayNotification] = useState<Notification | null>(null);
  const [paying, setPaying] = useState(false);
  const [payCardInfo, setPayCardInfo] = useState<{ cardId: string; cardName: string; total: number; invoiceMonth: string } | null>(null);

  // Quick pay/receive for individual transactions
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPayExpense, setQuickPayExpense] = useState<{ id: string; description: string; value: number; date: string; type: string; installment_group_id?: string | null; is_recurring?: boolean } | null>(null);
  const [quickPayValue, setQuickPayValue] = useState('');
  const [quickPayValueChanged, setQuickPayValueChanged] = useState(false);
  const [quickPayApplyScope, setQuickPayApplyScope] = useState<'single' | 'all' | null>(null);
  const [quickPaying, setQuickPaying] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const [{ data }, { data: w }] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('wallets').select('id, name').eq('user_id', user.id),
    ]);
    setNotifications(data || []);
    setWallets(w || []);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const isInvoiceNotification = (n: Notification) =>
    n.title === 'Fatura a vencer' || n.title === 'Fatura fechada';

  const isTransactionNotification = (n: Notification) =>
    !!n.expense_id && !isInvoiceNotification(n);

  // ---- Invoice payment (credit card) ----
  const handlePayFromNotification = async (n: Notification) => {
    if (!user) return;
    markAsRead(n.id);
    const cardNameMatch = n.message.match(/fatura\s+(.+?)\s+de\s+R\$/i);
    const cardName = cardNameMatch?.[1] || '';
    const { data: cards } = await supabase.from('credit_cards').select('id, name').eq('user_id', user.id);
    const card = (cards || []).find((c: any) => c.name.toLowerCase() === cardName.toLowerCase());
    if (!card) {
      toast({ title: 'Cartão não encontrado', description: 'Não foi possível identificar o cartão desta fatura.', variant: 'destructive' });
      return;
    }
    const totalMatch = n.message.match(/R\$\s*([\d.,]+)/);
    const totalStr = totalMatch?.[1]?.replace('.', '').replace(',', '.') || '0';
    const total = parseFloat(totalStr);
    const now = new Date();
    const invoiceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setPayCardInfo({ cardId: card.id, cardName: card.name, total, invoiceMonth });
    setPayNotification(n);
    setPayDialogOpen(true);
    setOpen(false);
  };

  const handleConfirmPay = async (walletId: string, paymentDate: string) => {
    if (!user || !payCardInfo || !walletId) return;
    setPaying(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      description: `Pagamento fatura ${payCardInfo.cardName} - ${payCardInfo.invoiceMonth}`,
      value: payCardInfo.total,
      type: 'expense',
      final_category: 'Cartão de Crédito',
      date: paymentDate,
      wallet_id: walletId,
      credit_card_id: payCardInfo.cardId,
      payment_method: 'debit',
      is_paid: true,
      invoice_month: payCardInfo.invoiceMonth,
    });
    if (!error) {
      await supabase.from('expenses').update({ is_paid: true })
        .eq('user_id', user.id)
        .eq('credit_card_id', payCardInfo.cardId)
        .eq('invoice_month', payCardInfo.invoiceMonth);
      const fmtTotal = payCardInfo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      toast({ title: 'Fatura paga!', description: `${fmtTotal} debitado da conta.` });
      setPayDialogOpen(false);
      await queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey?.[0];
        return typeof key === 'string' && (key.startsWith('projected-') || key.startsWith('analytics') || key === 'expenses' || key === 'history');
      }, refetchType: 'active' });
    } else {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setPaying(false);
  };

  // ---- Quick pay/receive for individual transactions ----
  const handleQuickPayFromNotification = async (n: Notification) => {
    if (!user || !n.expense_id) return;
    markAsRead(n.id);
    const { data: exp } = await supabase.from('expenses').select('id, description, value, date, type, installment_group_id, is_recurring, final_category, wallet_id, credit_card_id, payment_method, notes, tags, project_id, invoice_month, user_id').eq('id', n.expense_id).single();
    if (!exp) {
      toast({ title: 'Transação não encontrada', description: 'Esta transação pode ter sido excluída.', variant: 'destructive' });
      return;
    }
    if ((exp as any).is_paid) {
      toast({ title: 'Já quitada', description: 'Esta transação já foi paga/recebida.' });
      return;
    }
    setQuickPayExpense(exp as any);
    setQuickPayValue(String(exp.value));
    setQuickPayValueChanged(false);
    setQuickPayApplyScope(null);
    setQuickPayOpen(true);
    setOpen(false);
  };

  const handleConfirmQuickPay = async (keepOriginalDate: boolean) => {
    if (!quickPayExpense) return;
    setQuickPaying(true);
    try {
      const newValue = parseFloat(quickPayValue);
      const valueChanged = !isNaN(newValue) && newValue !== quickPayExpense.value;
      const finalValue = valueChanged && !isNaN(newValue) ? newValue : quickPayExpense.value;

      const payDate = (() => {
        if (keepOriginalDate) return quickPayExpense.date;
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      })();

      if ((quickPayExpense as any).is_recurring) {
        const templateId = quickPayExpense.id;
        const { error } = await supabase.from('expenses').insert({
          user_id: (quickPayExpense as any).user_id || user?.id,
          description: quickPayExpense.description,
          value: finalValue,
          final_category: (quickPayExpense as any).final_category,
          type: quickPayExpense.type,
          date: payDate,
          is_recurring: false,
          is_paid: true,
          wallet_id: (quickPayExpense as any).wallet_id || null,
          credit_card_id: (quickPayExpense as any).credit_card_id || null,
          payment_method: (quickPayExpense as any).payment_method || null,
          notes: (quickPayExpense as any).notes || null,
          tags: (quickPayExpense as any).tags || null,
          project_id: (quickPayExpense as any).project_id || null,
          invoice_month: (quickPayExpense as any).invoice_month || null,
        });
        if (error) throw error;

        const dateChanged = payDate !== quickPayExpense.date;
        if ((valueChanged || dateChanged) && quickPayApplyScope === 'all') {
          const tplUpdate: ExpenseUpdate = {};
          if (valueChanged) tplUpdate.value = newValue;
          if (dateChanged) {
            const newDay = String(new Date(payDate + 'T12:00:00').getDate()).padStart(2, '0');
            const orig = new Date(quickPayExpense.date + 'T12:00:00');
            tplUpdate.date = `${orig.getFullYear()}-${String(orig.getMonth() + 1).padStart(2, '0')}-${newDay}`;
          }
          if (Object.keys(tplUpdate).length > 0) {
            await supabase.from('expenses').update(tplUpdate).eq('id', templateId);
          }
        }
      } else {
        const updateFields: ExpenseUpdate = { is_paid: true, date: payDate };
        if (valueChanged) updateFields.value = newValue;
        const { error } = await supabase.from('expenses').update(updateFields).eq('id', quickPayExpense.id);
        if (error) throw error;

        if (valueChanged && quickPayApplyScope === 'all' && quickPayExpense.installment_group_id) {
          await supabase.from('expenses').update({ value: newValue })
            .eq('installment_group_id', quickPayExpense.installment_group_id)
            .neq('id', quickPayExpense.id);
        }
      }

      toast({ title: quickPayExpense.type === 'income' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
      await queryClient.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('projected-') || k.startsWith('analytics') || k.startsWith('budget') || k === 'expenses' || k === 'history');
      }, refetchType: 'active' });
      setQuickPayOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setQuickPaying(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative rounded-xl">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 rounded-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="text-sm font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:underline" onClick={markAllRead}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Sem notificações</p>
            ) : (
              <div className="divide-y">
                {notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                    <button onClick={() => markAsRead(n.id)} className="w-full text-left">
                      <div className="flex items-start gap-2">
                        {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <div className={!n.is_read ? '' : 'ml-4'}>
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Invoice pay button */}
                    {isInvoiceNotification(n) && (
                      <Button size="sm" variant="outline" className="mt-2 w-full rounded-lg gap-2 text-xs h-7" onClick={() => handlePayFromNotification(n)}>
                        <CreditCard className="h-3 w-3" />
                        Pagar Fatura
                      </Button>
                    )}
                    {/* Quick pay/receive for individual transactions */}
                    {isTransactionNotification(n) && (
                      <Button size="sm" variant="outline" className="mt-2 w-full rounded-lg gap-2 text-xs h-7" onClick={() => handleQuickPayFromNotification(n)}>
                        <Check className="h-3 w-3" />
                        {n.title.includes('Receita') ? 'Receber' : 'Pagar'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {payCardInfo && (
        <InvoicePaymentModal
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          invoice={{ cardName: payCardInfo.cardName, monthLabel: payCardInfo.invoiceMonth, total: payCardInfo.total }}
          wallets={wallets}
          submitting={paying}
          onConfirm={handleConfirmPay}
        />
      )}

      {/* Quick pay/receive dialog for individual transactions */}
      <Dialog open={quickPayOpen} onOpenChange={(o) => { if (!o) { setQuickPayOpen(false); setQuickPayApplyScope(null); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quickPayExpense?.type === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">{quickPayExpense?.description}</p>

            {/* Editable value */}
            <div>
              <Label className="text-xs mb-1 block">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="flex h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={quickPayValue}
                  onChange={(e) => {
                    setQuickPayValue(e.target.value);
                    const newVal = parseFloat(e.target.value);
                    setQuickPayValueChanged(!isNaN(newVal) && newVal !== quickPayExpense?.value);
                  }}
                />
              </div>
            </div>

            {/* Scope choice if value changed and has installments */}
            {quickPayValueChanged && quickPayExpense?.installment_group_id && !quickPayExpense?.is_recurring && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Aplicar novo valor em:</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={quickPayApplyScope === 'single' ? 'default' : 'outline'} className="rounded-xl text-xs flex-1" onClick={() => setQuickPayApplyScope('single')}>
                    Apenas esta
                  </Button>
                  <Button type="button" size="sm" variant={quickPayApplyScope === 'all' ? 'default' : 'outline'} className="rounded-xl text-xs flex-1" onClick={() => setQuickPayApplyScope('all')}>
                    Todas as parcelas
                  </Button>
                </div>
              </div>
            )}

            {/* Scope choice for recurring transactions when value changed */}
            {quickPayExpense?.is_recurring && quickPayValueChanged && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-foreground">
                  Esta é uma transação recorrente. Aplicar a alteração em:
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={quickPayApplyScope === 'single' ? 'default' : 'outline'} className="rounded-xl text-xs flex-1" onClick={() => setQuickPayApplyScope('single')}>
                    Apenas esta
                  </Button>
                  <Button type="button" size="sm" variant={quickPayApplyScope === 'all' ? 'default' : 'outline'} className="rounded-xl text-xs flex-1" onClick={() => setQuickPayApplyScope('all')}>
                    Todas as próximas
                  </Button>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Deseja manter a data original ou alterar para a data de hoje?</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setQuickPayOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={quickPaying || (quickPayValueChanged && !!quickPayExpense?.installment_group_id && !quickPayExpense?.is_recurring && !quickPayApplyScope) || (!!quickPayExpense?.is_recurring && quickPayValueChanged && !quickPayApplyScope)}
              onClick={() => handleConfirmQuickPay(true)}
            >
              Manter data ({quickPayExpense ? new Date(quickPayExpense.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''})
            </Button>
            <Button
              className="rounded-xl bg-success text-success-foreground hover:bg-success/90"
              disabled={quickPaying || (quickPayValueChanged && !!quickPayExpense?.installment_group_id && !quickPayExpense?.is_recurring && !quickPayApplyScope) || (!!quickPayExpense?.is_recurring && quickPayValueChanged && !quickPayApplyScope)}
              onClick={() => handleConfirmQuickPay(false)}
            >
              {quickPaying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</> : `Mudar para hoje (${todayFormatted})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
