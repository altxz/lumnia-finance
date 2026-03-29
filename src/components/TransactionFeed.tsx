import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Utensils, Car, Gamepad2, Heart, Home, GraduationCap, Tag, ArrowLeftRight, ChevronLeft, ChevronRight, Wallet, Pencil, Trash2, CreditCard, Layers, LayoutList, Receipt, Pin } from 'lucide-react';
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

const ITEMS_PER_PAGE = 30;

interface TransactionFeedProps {
  expenses: Expense[];
  allExpenses?: Expense[];
  /** All credit card expenses across all months for invoice matching */
  invoiceExpenses?: Expense[];
  loading: boolean;
  onDeleted: () => void;
  filters: { category: string };
  onFilterChange: (key: string, value: string) => void;
  wallets?: { id: string; name: string }[];
  startingMonthBalance?: number;
  creditCards?: CreditCardType[];
  currentMonth?: string;
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

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPurchaseDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** An expense item displayed in the feed, possibly relocated to a different day */
interface FeedItem {
  expense: Expense;
  /** Original purchase date if this was moved from its original day */
  originalDate?: string;
  /** Whether this item belongs to a credit card invoice */
  isInvoiceItem: boolean;
}

interface DayGroup {
  dateKey: string;
  items: FeedItem[];
  invoices: InvoicePeriod[]; // only used when groupCards is active
  endOfDayBalance: number;
}

export function TransactionFeed({
  expenses,
  allExpenses,
  invoiceExpenses,
  loading,
  onDeleted,
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

  const targetYear = currentMonth ? parseInt(currentMonth.slice(0, 4)) : new Date().getFullYear();
  const targetMonth = currentMonth ? parseInt(currentMonth.slice(5, 7)) - 1 : new Date().getMonth();

  // To show invoices whose DUE DATE falls in the selected month,
  // we need the closing period from the PREVIOUS month
  // (getInvoicePeriod produces dueDate in targetMonth+1, so we call with targetMonth-1)
  const invoicePrevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
  const invoicePrevYear = targetMonth === 0 ? targetYear - 1 : targetYear;

  // Build invoice periods using ALL CC expenses (from any month)
  const invoicePeriods = useMemo(() => {
    if (creditCards.length === 0) return [];
    const ccPool = invoiceExpenses && invoiceExpenses.length > 0 ? invoiceExpenses : (allExpenses || expenses);
    return creditCards.map(card => {
      const period = getInvoicePeriod(card, invoicePrevYear, invoicePrevMonth);
      return matchExpensesToInvoice(ccPool, period);
    });
  }, [creditCards, invoiceExpenses, allExpenses, expenses, invoicePrevYear, invoicePrevMonth]);



  const walletMap = useMemo(() => {
    const m: Record<string, string> = {};
    wallets.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [wallets]);

  // Selected month boundaries for strict filtering
  const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
  const monthEndDate = new Date(targetYear, targetMonth + 1, 0);
  const monthEnd = toDateKey(monthEndDate);

  // Build feed items: place CC expenses on invoice due date, inject from other months
  const grouped: DayGroup[] = useMemo(() => {
    const dayMap: Record<string, FeedItem[]> = {};
    const invoicesByDay: Record<string, InvoicePeriod[]> = {};

    const ensureDay = (key: string) => { if (!dayMap[key]) dayMap[key] = []; };
    const isInSelectedMonth = (dateKey: string) => dateKey >= monthStart && dateKey <= monthEnd;

    // Track IDs already added to avoid duplicates
    const addedIds = new Set<string>();

    // 1. Add non-CC expenses from the calendar month (already filtered by HistoryPage)
    expenses.forEach(exp => {
      if (exp.credit_card_id) return; // CC expenses handled below
      ensureDay(exp.date);
      dayMap[exp.date].push({ expense: exp, isInvoiceItem: false });
      addedIds.add(exp.id);
    });

    // 2. Add CC expenses from invoice periods whose due date is in the selected month
    invoicePeriods.forEach(inv => {
      const dueKey = toDateKey(inv.dueDate);
      if (!isInSelectedMonth(dueKey)) return;

      if (groupCards) {
        // Grouped mode: show summary item only
        ensureDay(dueKey);
        if (!invoicesByDay[dueKey]) invoicesByDay[dueKey] = [];
        invoicesByDay[dueKey].push(inv);
      } else {
        // Ungrouped: show each CC expense individually on the due date
        inv.transactions.forEach(tx => {
          if (addedIds.has(tx.id)) return;
          addedIds.add(tx.id);
          ensureDay(dueKey);
          dayMap[dueKey].push({
            expense: tx,
            originalDate: tx.date,
            isInvoiceItem: true,
          });
        });
      }
    });

    // 3. Regra de ouro: NUNCA exibir compra de cartão no mês da compra.
    // Se não caiu em nenhuma fatura com vencimento no mês selecionado, fica oculta neste mês.

    // Calculate running balance for the selected month
    const allTxns = allExpenses || expenses;

    const nonCcFlowByDay: Record<string, number> = {};
    allTxns.forEach(exp => {
      if (exp.type === 'transfer' || !exp.is_paid) return;
      if (exp.credit_card_id) return;
      const key = exp.date;
      if (key < monthStart || key > monthEnd) return;
      if (!nonCcFlowByDay[key]) nonCcFlowByDay[key] = 0;
      if (exp.type === 'income') nonCcFlowByDay[key] += exp.value;
      else nonCcFlowByDay[key] -= exp.value;
    });

    // Invoice totals hit balance on due date (only if in selected month)
    const invoiceTotalByDay: Record<string, number> = {};
    invoicePeriods.forEach(inv => {
      const key = toDateKey(inv.dueDate);
      if (!isInSelectedMonth(key)) return;
      invoiceTotalByDay[key] = (invoiceTotalByDay[key] || 0) + inv.total;
    });

    const allDayKeys = new Set<string>([
      ...Object.keys(nonCcFlowByDay),
      ...Object.keys(invoiceTotalByDay),
      ...Object.keys(dayMap),
    ]);
    const allDaysSorted = Array.from(allDayKeys).sort();

    let runningBalance = startingMonthBalance;
    const balanceMap: Record<string, number> = {};
    for (const day of allDaysSorted) {
      runningBalance += (nonCcFlowByDay[day] || 0);
      runningBalance -= (invoiceTotalByDay[day] || 0);
      balanceMap[day] = runningBalance;
    }

    const allDisplayDays = new Set<string>([...Object.keys(dayMap), ...Object.keys(invoicesByDay)]);
    const sortedDays = Array.from(allDisplayDays).sort((a, b) => b.localeCompare(a));

    return sortedDays.map(dateKey => ({
      dateKey,
      items: dayMap[dateKey] || [],
      invoices: invoicesByDay[dateKey] || [],
      endOfDayBalance: balanceMap[dateKey] ?? startingMonthBalance,
    }));
  }, [expenses, allExpenses, startingMonthBalance, groupCards, invoicePeriods, monthStart, monthEnd]);

  const statusConfig: Record<string, { label: string; className: string }> = {
    open: { label: 'Aberta', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    closed: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-border' },
    overdue: { label: 'Vencida', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    paid: { label: 'Paga', className: 'bg-primary/15 text-primary border-primary/30' },
  };

  const getInvoiceDisplayStatus = (inv: InvoicePeriod) => {
    return statusConfig[inv.status] || statusConfig.open;
  };

  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when expenses change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [expenses]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => prev + ITEMS_PER_PAGE);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [grouped]);

  const hasContent = grouped.some(g => g.items.length > 0 || g.invoices.length > 0);

  // Slice grouped items for infinite scroll
  const visibleGroups = useMemo(() => {
    let count = 0;
    const result: typeof grouped = [];
    for (const group of grouped) {
      if (count >= visibleCount) break;
      const remaining = visibleCount - count;
      const totalItems = group.items.length + group.invoices.length;
      if (totalItems <= remaining) {
        result.push(group);
        count += totalItems;
      } else {
        // Partially show items
        result.push({
          ...group,
          items: group.items.slice(0, Math.max(0, remaining - group.invoices.length)),
          invoices: group.invoices.slice(0, remaining),
        });
        count = visibleCount;
      }
    }
    return result;
  }, [grouped, visibleCount]);

  const allItemsCount = grouped.reduce((s, g) => s + g.items.length + g.invoices.length, 0);
  const hasMore = visibleCount < allItemsCount;

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

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : !hasContent ? (
        <p className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map(({ dateKey, items, invoices, endOfDayBalance }) => {
            if (items.length === 0 && invoices.length === 0) return null;
            return (
              <div key={dateKey}>
                {/* Day header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/60 rounded-t-xl border border-b-0 border-border">
                  <h3 className="text-sm font-bold text-foreground capitalize">
                    {formatGroupDate(dateKey)}
                  </h3>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${endOfDayBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Saldo: {endOfDayBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(endOfDayBalance))}</span>
                  </div>
                </div>

                {/* Day content */}
                <div className="rounded-b-xl border border-t-0 bg-card overflow-hidden divide-y divide-border">
                  {/* Invoice summaries (grouped mode) */}
                  {invoices.map(inv => {
                    const displayStatus = getInvoiceDisplayStatus(inv);
                    const isPaid = inv.status === 'paid';
                    return (
                      <div
                        key={`inv-${inv.cardId}`}
                        className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setInvoiceModal(inv)}
                      >
                        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-accent/30">
                          <CreditCard className="h-4.5 w-4.5 text-accent-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
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
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-sm font-bold text-destructive">
                            {inv.total > 0 ? `-${formatCurrency(inv.total)}` : formatCurrency(0)}
                          </span>
                          {!isPaid && inv.total > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 rounded-lg"
                              onClick={(e) => { e.stopPropagation(); setInvoiceModal(inv); }}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Individual transaction items */}
                  {items.map(({ expense: exp, originalDate, isInvoiceItem }) => {
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
                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isInvoiceItem ? 'bg-accent/30' : catData.bg}`}>
                          {isTransfer ? (
                            <ArrowLeftRight className="h-4.5 w-4.5" />
                          ) : isInvoiceItem ? (
                            <CreditCard className={`h-4.5 w-4.5 text-accent-foreground`} />
                          ) : (
                            <Icon className={`h-4.5 w-4.5 ${catData.text}`} />
                          )}
                        </div>

                        {/* Description + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate" title={exp.description}>{exp.description}</p>
                            {isInvoiceItem && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-accent/15 text-accent-foreground border-accent/30 shrink-0">
                                <Receipt className="h-2.5 w-2.5 mr-0.5" />
                                Fatura
                              </Badge>
                            )}
                            {exp.invoice_month && exp.credit_card_id && (
                              <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {isInvoiceItem && originalDate && (
                              <span className="text-[11px] text-muted-foreground">
                                Compra em {formatPurchaseDate(originalDate)}
                              </span>
                            )}
                            {isInvoiceItem && originalDate && (walletName || exp.credit_card_id) && (
                              <span className="text-[11px] text-muted-foreground">•</span>
                            )}
                            {(walletName || exp.credit_card_id) && (
                              <>
                                <Wallet className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {walletName || ''}
                                  {walletName && exp.credit_card_id ? ' | ' : ''}
                                  {exp.credit_card_id ? 'Cartão de crédito' : !walletName ? '' : ' | Débito em conta'}
                                </span>
                              </>
                            )}
                          </div>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditingExpense(exp)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingExpense(exp)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
            <AlertDialogDescription>Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
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
          allExpenses={invoiceExpenses && invoiceExpenses.length > 0 ? invoiceExpenses : (allExpenses || expenses)}
          cards={creditCards}
          wallets={wallets}
          onPaid={() => { setInvoiceModal(null); onDeleted(); }}
        />
      )}
    </div>
  );
}
