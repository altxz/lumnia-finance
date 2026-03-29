import { useMemo, useState, useEffect } from 'react';
import { Clock, Utensils, Car, Gamepad2, Heart, Home, GraduationCap, Tag, ArrowLeftRight, ChevronLeft, ChevronRight, Wallet, Pencil, Trash2, CreditCard, Layers, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { InvoiceDetailsModal } from '@/components/modals/InvoiceDetailsModal';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';

const CATEGORY_ICONS: Record<string, { icon: typeof Utensils; bg: string; text: string }> = {
  alimentacao: { icon: Utensils, bg: 'bg-accent/30', text: 'text-accent-foreground' },
  transporte: { icon: Car, bg: 'bg-ai/15', text: 'text-ai' },
  lazer: { icon: Gamepad2, bg: 'bg-pink/30', text: 'text-pink-foreground' },
  saude: { icon: Heart, bg: 'bg-destructive/15', text: 'text-destructive' },
  moradia: { icon: Home, bg: 'bg-primary/15', text: 'text-primary' },
  educacao: { icon: GraduationCap, bg: 'bg-ai/15', text: 'text-ai' },
  outros: { icon: Tag, bg: 'bg-muted', text: 'text-muted-foreground' },
  transferencia: { icon: ArrowLeftRight, bg: 'bg-primary/15', text: 'text-primary' },
};

const STORAGE_KEY = 'txfeed_group_cards';

interface TransactionFeedProps {
  expenses: Expense[];
  allExpenses?: Expense[];
  loading: boolean;
  onDeleted: () => void;
  filters: { category: string };
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  wallets?: { id: string; name: string }[];
  startingMonthBalance?: number;
  creditCards?: CreditCardType[];
  currentMonth?: string; // YYYY-MM-DD start of month
}

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = new Date(date);
  d.setHours(12, 0, 0, 0);

  if (d.getTime() === today.getTime()) return 'Hoje';
  if (d.getTime() === yesterday.getTime()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });
}

export function TransactionFeed({
  expenses,
  allExpenses,
  loading,
  onDeleted,
  page,
  totalPages,
  onPageChange,
  wallets = [],
  startingMonthBalance = 0,
  creditCards = [],
  currentMonth,
}: TransactionFeedProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [groupCards, setGroupCards] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [invoiceModal, setInvoiceModal] = useState<InvoicePeriod | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(groupCards)); } catch {}
  }, [groupCards]);

  const handleDelete = async () => {
    if (!deletingExpense) return;
    setDeleting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', deletingExpense.id);
    setDeleting(false);
    setDeletingExpense(null);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transação excluída' });
      onDeleted();
    }
  };

  // Parse current month
  const targetYear = currentMonth ? parseInt(currentMonth.slice(0, 4)) : new Date().getFullYear();
  const targetMonth = currentMonth ? parseInt(currentMonth.slice(5, 7)) - 1 : new Date().getMonth();

  // Build invoice periods for all credit cards
  const invoicePeriods = useMemo(() => {
    if (!groupCards || creditCards.length === 0) return [];
    const allTxns = allExpenses || expenses;
    return creditCards.map(card => {
      const period = getInvoicePeriod(card, targetYear, targetMonth);
      return matchExpensesToInvoice(allTxns, period);
    });
  }, [groupCards, creditCards, allExpenses, expenses, targetYear, targetMonth]);

  // Set of expense IDs that belong to grouped invoices
  const groupedExpenseIds = useMemo(() => {
    if (!groupCards) return new Set<string>();
    const ids = new Set<string>();
    invoicePeriods.forEach(inv => inv.transactions.forEach(tx => ids.add(tx.id)));
    return ids;
  }, [groupCards, invoicePeriods]);

  // Calculate cumulative end-of-day balances
  const dayBalanceMap = useMemo(() => {
    const txns = allExpenses || expenses;
    const groups: Record<string, Expense[]> = {};
    txns.forEach(exp => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    const sortedDays = Object.keys(groups).sort();

    let runningBalance = startingMonthBalance;
    const map: Record<string, number> = {};

    for (const day of sortedDays) {
      for (const exp of groups[day]) {
        if (exp.type === 'transfer') continue;
        if (!exp.is_paid) continue;
        if (exp.type === 'income') runningBalance += exp.value;
        else if (!exp.credit_card_id) runningBalance -= exp.value;
      }
      map[day] = runningBalance;
    }

    return map;
  }, [allExpenses, expenses, startingMonthBalance]);

  // Filter out grouped expenses from display list
  const displayExpenses = useMemo(() => {
    if (!groupCards) return expenses;
    return expenses.filter(e => !groupedExpenseIds.has(e.id));
  }, [expenses, groupCards, groupedExpenseIds]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    displayExpenses.forEach(exp => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items]) => ({
        dateKey,
        items,
        endOfDayBalance: dayBalanceMap[dateKey] ?? startingMonthBalance,
      }));
  }, [displayExpenses, dayBalanceMap, startingMonthBalance]);

  const walletMap = useMemo(() => {
    const m: Record<string, string> = {};
    wallets.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [wallets]);

  const statusConfig = {
    open: { label: 'Aberta', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    closed: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-border' },
    overdue: { label: 'Vencida', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  };

  // Check if all expenses for a card in the month are paid
  const isInvoicePaid = (inv: InvoicePeriod) => {
    if (inv.transactions.length === 0) return false;
    return inv.transactions.every(tx => tx.is_paid);
  };

  const getInvoiceDisplayStatus = (inv: InvoicePeriod) => {
    if (isInvoicePaid(inv)) return { label: 'Paga', className: 'bg-primary/15 text-primary border-primary/30' };
    return statusConfig[inv.status];
  };

  return (
    <div className="space-y-4">
      {/* Grouping toggle */}
      {creditCards.length > 0 && (
        <div className="flex items-center justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={groupCards ? 'default' : 'outline'}
                size="sm"
                className="gap-2 rounded-xl text-xs"
                onClick={() => setGroupCards(!groupCards)}
              >
                {groupCards ? <Layers className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
                {groupCards ? 'Agrupado' : 'Agrupar Cartão'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {groupCards ? 'Desagrupar despesas do cartão' : 'Agrupar despesas por fatura do cartão'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Consolidated invoice items */}
      {groupCards && invoicePeriods.length > 0 && (
        <div className="space-y-2">
          {invoicePeriods.map(inv => {
            const displayStatus = getInvoiceDisplayStatus(inv);
            const paid = isInvoicePaid(inv);
            return (
              <div
                key={inv.cardId}
                className="flex items-center gap-3 px-3 sm:px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
              >
                {/* Card icon */}
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/15">
                  <CreditCard className="h-4.5 w-4.5 text-primary" />
                </div>

                {/* Name + status */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setInvoiceModal(inv)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">Fatura {inv.cardName}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${displayStatus.className}`}>
                      {displayStatus.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.transactions.length} transação{inv.transactions.length !== 1 ? 'ões' : ''} • Vence {inv.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>

                {/* Value + pay button */}
                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className="text-sm font-bold text-destructive cursor-pointer"
                    onClick={() => setInvoiceModal(inv)}
                  >
                    {inv.total > 0 ? `-${formatCurrency(inv.total)}` : formatCurrency(0)}
                  </span>
                  {!paid && inv.total > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 rounded-lg"
                      onClick={() => setInvoiceModal(inv)}
                    >
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Carregando...</p>
      ) : displayExpenses.length === 0 && (!groupCards || invoicePeriods.length === 0) ? (
        <p className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ dateKey, items, endOfDayBalance }) => (
            <div key={dateKey}>
              {/* Day header */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/60 rounded-t-xl border border-b-0 border-border">
                <h3 className="text-sm font-bold text-foreground capitalize">
                  {formatGroupDate(dateKey)}
                </h3>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${endOfDayBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Saldo em conta: {endOfDayBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(endOfDayBalance))}</span>
                </div>
              </div>

              {/* Transactions list */}
              <div className="rounded-b-xl border border-t-0 bg-card overflow-hidden divide-y divide-border">
                {items.map(exp => {
                  const catData = CATEGORY_ICONS[exp.final_category] || CATEGORY_ICONS.outros;
                  const Icon = catData.icon;
                  const isIncome = exp.type === 'income';
                  const isTransfer = exp.type === 'transfer';
                  const isPending = !exp.is_paid;
                  const walletName = exp.wallet_id ? walletMap[exp.wallet_id] : null;

                  return (
                    <div
                      key={exp.id}
                      className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/50 transition-colors group"
                    >
                      {/* Category icon */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${catData.bg}`}>
                        {isTransfer ? (
                          <ArrowLeftRight className="h-4.5 w-4.5" />
                        ) : (
                          <Icon className={`h-4.5 w-4.5 ${catData.text}`} />
                        )}
                      </div>

                      {/* Description + wallet */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={exp.description}>{exp.description}</p>
                        {(walletName || exp.credit_card_id) && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {walletName || ''}
                              {walletName && exp.credit_card_id ? ' | ' : !walletName && exp.credit_card_id ? '' : ''}
                              {exp.credit_card_id ? 'Cartão de crédito' : walletName ? ' | Débito em conta' : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Value */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isPending && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={`text-sm font-bold ${
                          isPending
                            ? 'text-muted-foreground'
                            : isIncome
                              ? 'text-emerald-600'
                              : isTransfer
                                ? 'text-foreground'
                                : 'text-destructive'
                        }`}>
                          {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(exp.value)}
                        </span>
                      </div>

                      {/* Quick actions */}
                      <div className="shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => setEditingExpense(exp)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingExpense(exp)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="rounded-xl">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {editingExpense && (
        <EditExpenseModal
          open={!!editingExpense}
          expense={editingExpense}
          onOpenChange={(open) => { if (!open) setEditingExpense(null); }}
          onExpenseUpdated={() => { setEditingExpense(null); onDeleted(); }}
        />
      )}

      <AlertDialog open={!!deletingExpense} onOpenChange={(open) => { if (!open) setDeletingExpense(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {invoiceModal && (
        <InvoiceDetailsModal
          open={!!invoiceModal}
          onOpenChange={(open) => { if (!open) setInvoiceModal(null); }}
          invoice={invoiceModal}
          allExpenses={allExpenses || expenses}
          cards={creditCards}
        />
      )}
    </div>
  );
}
