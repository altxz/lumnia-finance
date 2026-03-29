import { useState, useEffect } from 'react';
import { Bell, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface WalletOption { id: string; name: string }

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);

  // Pay invoice from notification
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payNotification, setPayNotification] = useState<Notification | null>(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [paying, setPaying] = useState(false);
  const [payCardInfo, setPayCardInfo] = useState<{ cardId: string; cardName: string; total: number; invoiceMonth: string } | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const [{ data }, { data: w }] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('wallets').select('id, name').eq('user_id', user.id),
    ]);
    setNotifications(data || []);
    setWallets(w || []);
  };

  useEffect(() => { fetchNotifications(); }, [user]);

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
  }, [user]);

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

  const handlePayFromNotification = async (n: Notification) => {
    if (!user) return;
    markAsRead(n.id);

    // Extract card name from message (e.g. "fatura Nubank de R$ 1.234,56")
    const cardNameMatch = n.message.match(/fatura\s+(.+?)\s+de\s+R\$/i);
    const cardName = cardNameMatch?.[1] || '';

    // Find card
    const { data: cards } = await supabase.from('credit_cards').select('id, name').eq('user_id', user.id);
    const card = (cards || []).find((c: any) => c.name.toLowerCase() === cardName.toLowerCase());

    if (!card) {
      toast({ title: 'Cartão não encontrado', description: 'Não foi possível identificar o cartão desta fatura.', variant: 'destructive' });
      return;
    }

    // Get total from message
    const totalMatch = n.message.match(/R\$\s*([\d.,]+)/);
    const totalStr = totalMatch?.[1]?.replace('.', '').replace(',', '.') || '0';
    const total = parseFloat(totalStr);

    const now = new Date();
    const invoiceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setPayCardInfo({ cardId: card.id, cardName: card.name, total, invoiceMonth });
    setPayNotification(n);
    setPayWalletId('');
    setPayDialogOpen(true);
    setOpen(false);
  };

  const handleConfirmPay = async () => {
    if (!user || !payCardInfo || !payWalletId) return;
    setPaying(true);

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      description: `Pagamento fatura ${payCardInfo.cardName} - ${payCardInfo.invoiceMonth}`,
      value: payCardInfo.total,
      type: 'expense',
      final_category: 'Cartão de Crédito',
      date: new Date().toISOString().split('T')[0],
      wallet_id: payWalletId,
      payment_method: 'debit',
      is_paid: true,
    });

    if (!error) {
      await supabase.from('expenses').update({ is_paid: true })
        .eq('user_id', user.id)
        .eq('credit_card_id', payCardInfo.cardId)
        .eq('invoice_month', payCardInfo.invoiceMonth);

      const fmtTotal = payCardInfo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      toast({ title: 'Fatura paga!', description: `${fmtTotal} debitado da conta.` });
      setPayDialogOpen(false);
    } else {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setPaying(false);
  };

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
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Sem notificações</p>
            ) : (
              <div className="divide-y">
                {notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="w-full text-left"
                    >
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
                    {isInvoiceNotification(n) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full rounded-lg gap-2 text-xs h-7"
                        onClick={() => handlePayFromNotification(n)}
                      >
                        <CreditCard className="h-3 w-3" />
                        Pagar Fatura
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Pay from notification dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 rounded-xl bg-muted">
              <p className="text-sm text-muted-foreground">Valor da fatura</p>
              <p className="text-3xl font-bold mt-1">
                {payCardInfo ? payCardInfo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{payCardInfo?.cardName}</p>
            </div>
            <div className="space-y-2">
              <Label>Debitar de qual conta?</Label>
              <Select value={payWalletId} onValueChange={setPayWalletId}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleConfirmPay} disabled={paying || !payWalletId} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Pagando...</> : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
