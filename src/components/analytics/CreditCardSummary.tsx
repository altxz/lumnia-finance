import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CreditCard, Clock, Lock, AlertTriangle, Wallet, Receipt, Loader2, CalendarCheck, Eye, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { getInvoicePeriod, matchExpensesToInvoice, formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { InvoiceDetailsModal } from '@/components/modals/InvoiceDetailsModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_MAP = {
  open: { label: 'Aberta', icon: Clock, className: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  closed: { label: 'Fechada', icon: Lock, className: 'text-muted-foreground', bg: 'bg-muted' },
  overdue: { label: 'Vencida', icon: AlertTriangle, className: 'text-destructive', bg: 'bg-destructive/15' },
  paid: { label: 'Paga', icon: CheckCircle2, className: 'text-primary', bg: 'bg-primary/15' },
} as const;

// Bank-inspired gradients
const CARD_GRADIENTS: Record<string, string> = {
  nubank: 'from-purple-600 via-purple-500 to-purple-700',
  inter: 'from-orange-500 via-orange-400 to-orange-600',
  itau: 'from-blue-700 via-blue-600 to-orange-500',
  bradesco: 'from-red-600 via-red-500 to-red-700',
  santander: 'from-red-700 via-red-600 to-red-800',
  c6: 'from-zinc-800 via-zinc-700 to-zinc-900',
  default: 'from-primary via-primary/80 to-primary/60',
};

function getCardGradient(cardName: string): string {
  const lower = cardName.toLowerCase();
  for (const [key, gradient] of Object.entries(CARD_GRADIENTS)) {
    if (key !== 'default' && lower.includes(key)) return gradient;
  }
  return CARD_GRADIENTS.default;
}

function getBestPurchaseDay(closingDay: number): number {
  // Best day = day after closing (most time until next closing)
  return closingDay >= 28 ? 1 : closingDay + 1;
}

interface WalletOption { id: string; name: string; initial_balance: number }

interface CreditCardSummaryProps {
  cards: CreditCardType[];
  allExpenses: Expense[];
  wallets: WalletOption[];
  refetch: () => void;
}

export function CreditCardSummary({ cards, allExpenses, wallets, refetch }: CreditCardSummaryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePeriod | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<InvoicePeriod | null>(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [paying, setPaying] = useState(false);

  const invoices = useMemo(() => {
    return cards.map(card => {
      const period = getInvoicePeriod(card, selectedYear, selectedMonth);
      return matchExpensesToInvoice(allExpenses, period);
    });
  }, [cards, allExpenses, selectedMonth, selectedYear]);

  // Keep selected index in bounds
  const safeIdx = Math.min(selectedCardIdx, Math.max(invoices.length - 1, 0));
  const activeInvoice = invoices[safeIdx];

  const openPayDialog = (inv: InvoicePeriod) => {
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
      invoice_month: payingInvoice.monthLabel,
    });

    if (!error) {
      await supabase.from('expenses').update({ is_paid: true })
        .eq('user_id', user.id)
        .eq('credit_card_id', payingInvoice.cardId)
        .eq('invoice_month', payingInvoice.monthLabel);

      const selectedWallet = wallets.find(w => w.id === payWalletId);
      if (selectedWallet) {
        const { data: walletTxns } = await supabase
          .from('expenses')
          .select('value, type, credit_card_id')
          .eq('user_id', user.id)
          .eq('wallet_id', payWalletId)
          .eq('is_paid', true);

        let newBalance = selectedWallet.initial_balance;
        (walletTxns || []).forEach((t: any) => {
          if (t.type === 'transfer') return;
          if (t.type === 'income') newBalance += t.value;
          else if (!t.credit_card_id) newBalance -= t.value;
        });

        await supabase.from('wallets').update({ current_balance: newBalance }).eq('id', payWalletId);
      }

      toast({ title: 'Fatura paga!', description: `${formatCurrency(payingInvoice.total)} debitado da conta.` });
      setPayDialogOpen(false);
      refetch();
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

  const inv = activeInvoice;
  const statusInfo = STATUS_MAP[inv.status];
  const StatusIcon = statusInfo.icon;
  const usagePct = inv.limit > 0 ? Math.min((inv.total / inv.limit) * 100, 100) : 0;
  const available = Math.max(inv.limit - inv.total, 0);
  const bestDay = getBestPurchaseDay(inv.closingDay);
  const last3 = inv.transactions.slice(0, 3);
  const canPay = inv.total > 0 && (inv.status === 'closed' || inv.status === 'overdue');
  const gradient = getCardGradient(inv.cardName);

  return (
    <>
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col overflow-hidden">
        {/* Header with multi-card tabs */}
        <div className="bg-primary px-4 py-3 flex items-center gap-3">
          <CreditCard className="h-4 w-4 text-primary-foreground shrink-0" />
          <h3 className="text-sm font-bold text-primary-foreground">Centro de Crédito</h3>
          
          {/* Card tabs - only show if multiple cards */}
          {cards.length > 1 && (
            <div className="ml-auto flex items-center gap-1">
              {cards.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCardIdx(idx)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    idx === safeIdx
                      ? "bg-primary-foreground text-primary shadow-sm"
                      : "bg-primary-foreground/20 text-primary-foreground/80 hover:bg-primary-foreground/30"
                  )}
                >
                  {card.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <CardContent className="flex-1 p-4 md:p-5">
          {/* Desktop: side by side | Mobile: stacked */}
          <div className="flex flex-col lg:flex-row gap-5">
            
            {/* LEFT: Virtual Card */}
            <div className="lg:w-[280px] shrink-0">
              <div className={cn(
                "relative w-full aspect-[1.586/1] rounded-2xl bg-gradient-to-br shadow-lg overflow-hidden",
                gradient
              )}>
                {/* Card pattern overlay */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-6 right-6 w-20 h-20 rounded-full border-2 border-white/40" />
                  <div className="absolute top-8 right-10 w-16 h-16 rounded-full border-2 border-white/30" />
                </div>

                {/* Card content */}
                <div className="relative h-full flex flex-col justify-between p-5 text-white">
                  <div className="flex items-center justify-between">
                    <CreditCard className="h-7 w-7 opacity-80" />
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      statusInfo.bg, statusInfo.className
                    )}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-lg font-extrabold tracking-wide">
                      {formatCurrency(inv.total)}
                    </p>
                    <p className="text-[11px] opacity-70 mt-0.5">Fatura Atual</p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm font-bold tracking-widest">{inv.cardName}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">
                        Fecha dia {inv.closingDay} • Vence dia {inv.dueDay}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] opacity-60 uppercase">Limite</p>
                      <p className="text-xs font-bold">{formatCurrency(inv.limit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Details Grid */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              
              {/* Limit usage */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Limite Utilizado</span>
                  <span className="text-xs font-bold">{usagePct.toFixed(0)}%</span>
                </div>
                <Progress 
                  value={usagePct} 
                  className={cn("h-2.5", usagePct > 80 && "[&>div]:bg-destructive")}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    Usado: <span className="font-semibold text-foreground">{formatCurrency(inv.total)}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Disponível: <span className="font-semibold text-accent-foreground">{formatCurrency(available)}</span>
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Transações</span>
                  </div>
                  <p className="text-lg font-bold">{inv.transactions.length}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Vencimento</span>
                  </div>
                  <p className="text-sm font-bold">{formatInvoiceDate(inv.dueDate)}</p>
                </div>
                <div className="rounded-xl bg-accent/20 p-3 col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShoppingBag className="h-3.5 w-3.5 text-accent-foreground" />
                    <span className="text-[11px] text-muted-foreground">Melhor Dia de Compra</span>
                  </div>
                  <p className="text-lg font-bold text-accent-foreground">Dia {bestDay}</p>
                </div>
              </div>

              {/* Last 3 transactions */}
              {last3.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Últimas Transações</p>
                  <div className="space-y-2">
                    {last3.map(tx => {
                      return (
                        <div key={tx.id} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Wallet className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              {tx.installment_info && ` • ${tx.installment_info}`}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-destructive shrink-0">
                            -{formatCurrency(tx.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-auto pt-1">
                {canPay && (
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                    onClick={() => openPayDialog(inv)}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Pagar Fatura
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-xl gap-2 font-semibold"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Fatura Completa
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceDetailsModal
          open={!!selectedInvoice}
          invoice={selectedInvoice}
          allExpenses={allExpenses}
          cards={cards}
          wallets={wallets}
          onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
          onPaid={fetchData}
          refetch={fetchData}
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
