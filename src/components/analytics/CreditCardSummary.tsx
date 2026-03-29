import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CreditCard, Clock, Lock, AlertTriangle, ChevronRight, Wallet, Receipt, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { getInvoicePeriod, matchExpensesToInvoice, formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { InvoiceDetailsModal } from '@/components/modals/InvoiceDetailsModal';
import { useToast } from '@/hooks/use-toast';

const STATUS_MAP = {
  open: { label: 'Fatura Aberta', icon: Clock, className: 'text-emerald-400' },
  closed: { label: 'Fatura Fechada', icon: Lock, className: 'text-muted-foreground' },
  overdue: { label: 'Fatura Vencida', icon: AlertTriangle, className: 'text-destructive' },
} as const;

interface WalletOption { id: string; name: string; initial_balance: number }

export function CreditCardSummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePeriod | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<InvoicePeriod | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [payWalletId, setPayWalletId] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: c }, { data: e }, { data: w }] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('*').eq('user_id', user.id).not('credit_card_id', 'is', null).order('date', { ascending: false }),
      supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id),
    ]);
    setCards((c || []) as CreditCardType[]);
    setAllExpenses((e || []) as Expense[]);
    setWallets((w || []) as WalletOption[]);
  };

  useEffect(() => { fetchData(); }, [user]);

  const invoices = useMemo(() => {
    return cards.map(card => {
      const period = getInvoicePeriod(card, selectedYear, selectedMonth);
      return matchExpensesToInvoice(allExpenses, period);
    });
  }, [cards, allExpenses, selectedMonth, selectedYear]);

  const openPayDialog = (inv: InvoicePeriod, e: React.MouseEvent) => {
    e.stopPropagation();
    setPayingInvoice(inv);
    setPayWalletId('');
    setPayDialogOpen(true);
  };

  const handlePayInvoice = async () => {
    if (!user || !payingInvoice || !payWalletId) return;
    setPaying(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      description: `Pagamento fatura ${payingInvoice.cardName} - ${payingInvoice.monthLabel}`,
      value: payingInvoice.total,
      type: 'expense',
      final_category: 'Cartão de Crédito',
      date: new Date().toISOString().split('T')[0],
      wallet_id: payWalletId,
      payment_method: 'debit',
      is_paid: true,
      notes: `Pagamento da fatura do cartão ${payingInvoice.cardName}`,
    });

    if (!error) {
      // Mark invoice transactions as paid
      await supabase.from('expenses').update({ is_paid: true })
        .eq('user_id', user.id)
        .eq('credit_card_id', payingInvoice.cardId)
        .eq('invoice_month', payingInvoice.monthLabel);

      toast({ title: 'Fatura paga!', description: `${formatCurrency(payingInvoice.total)} debitado da conta.` });
      setPayDialogOpen(false);
      fetchData();
    } else {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setPaying(false);
  };

  if (invoices.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">
          Nenhum cartão de crédito cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col overflow-hidden">
        <div className="bg-primary px-4 py-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary-foreground" />
          <h3 className="text-sm font-bold text-primary-foreground">Resumo de Cartões</h3>
        </div>
        <CardContent className="flex-1 p-0 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {invoices.map(inv => {
              const statusInfo = STATUS_MAP[inv.status];
              const StatusIcon = statusInfo.icon;
              const usagePct = inv.limit > 0 ? Math.min((inv.total / inv.limit) * 100, 100) : 0;
              const last5 = inv.transactions.slice(0, 5);
              const canPay = inv.total > 0 && (inv.status === 'closed' || inv.status === 'overdue');

              return (
                <div key={inv.cardId} className="flex flex-col">
                  <button
                    onClick={() => setSelectedInvoice(inv)}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors group flex-1"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold truncate">{inv.cardName}</span>
                        <div className={`flex items-center gap-1 text-xs font-medium ${statusInfo.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusInfo.label}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span>Fecha em {formatInvoiceDate(inv.periodEnd)}</span>
                      <span className="text-border">•</span>
                      <span>Vence em {formatInvoiceDate(inv.dueDate)}</span>
                    </div>

                    {/* Total + usage bar */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xl font-extrabold text-foreground">{formatCurrency(inv.total)}</span>
                        <span className="text-xs text-muted-foreground">de {formatCurrency(inv.limit)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Last 5 transactions mini list */}
                    {last5.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">Últimas transações</p>
                        {last5.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Wallet className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs truncate">{tx.description}</span>
                            </div>
                            <span className="text-xs font-semibold text-destructive shrink-0">
                              -{formatCurrency(tx.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Pay button */}
                  {canPay && (
                    <div className="px-4 pb-4">
                      <Button
                        size="sm"
                        className="w-full rounded-xl gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                        onClick={(e) => openPayDialog(inv, e)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Pagar Fatura — {formatCurrency(inv.total)}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceDetailsModal
          open={!!selectedInvoice}
          invoice={selectedInvoice}
          allExpenses={allExpenses}
          cards={cards}
          onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
        />
      )}

      {/* Pay Invoice Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 rounded-xl bg-muted">
              <p className="text-sm text-muted-foreground">Valor da fatura</p>
              <p className="text-3xl font-bold mt-1">{payingInvoice ? formatCurrency(payingInvoice.total) : ''}</p>
              <p className="text-xs text-muted-foreground mt-1">{payingInvoice?.cardName} — {payingInvoice?.monthLabel}</p>
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
            <Button onClick={handlePayInvoice} disabled={paying || !payWalletId} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Pagando...</> : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
