import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeftRight, Wallet, Pencil, Trash2, CreditCard, Layers, LayoutList, Receipt, Pin, Check, Undo2, CalendarIcon, MoreHorizontal, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/constants';
import { currencyFitClass, labelFitClass } from '@/lib/textFit';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { showFriendlyError } from '@/lib/errorHandler';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { InvoiceDetailsModal } from '@/components/modals/InvoiceDetailsModal';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { deleteSingleRecurringOccurrence } from '@/lib/recurringExceptions';
import { getCreditCardPaymentCardId, isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { buildInvoiceCashEvents } from '@/lib/invoiceCashFlow';
import { buildDailyBalanceMap, transferCashDelta } from '@/lib/projectedBalanceMath';
import { DynamicCategoryIcon } from '@/components/DynamicCategoryIcon';
import { resolveTransactionCategory } from '@/lib/categoryMatch';
import type { DbCategory } from '@/hooks/useStaticData';
import type { Database } from '@/integrations/supabase/types';

type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

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
  wallets?: { id: string; name: string; asset_type?: string }[];
  investmentWalletIds?: string[];
  startingMonthBalance?: number;
  creditCards?: CreditCardType[];
  currentMonth?: string;
  categories?: DbCategory[];
  invoiceDisplayFilter?: (expense: Expense) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
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
  investmentWalletIds = [],
  startingMonthBalance = 0,
  creditCards = [],
  currentMonth,
  categories = [],
  invoiceDisplayFilter,
  emptyTitle = 'Nenhuma transação neste período',
  emptyDescription = 'Os lançamentos aparecerão aqui quando forem registrados.',
  onClearFilters,
}: TransactionFeedProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [payValue, setPayValue] = useState('');
  const [payValueChanged, setPayValueChanged] = useState(false);
  const [payApplyScope, setPayApplyScope] = useState<'single' | 'all' | null>(null);
  const [payDateMode, setPayDateMode] = useState<'original' | 'today' | 'custom'>('original');
  const [payCustomDate, setPayCustomDate] = useState<Date | undefined>(undefined);
  const [groupCards, setGroupCards] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [invoiceModal, setInvoiceModal] = useState<InvoicePeriod | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(groupCards)); } catch { /* Storage may be unavailable in private contexts. */ }
  }, [groupCards]);

  const openPayDialog = (exp: Expense) => {
    setPayingExpense(exp);
    setPayValue(String(exp.value));
    setPayValueChanged(false);
    setPayApplyScope(null);
    setPayDateMode('original');
    setPayCustomDate(undefined);
  };

  const handleMarkAsUnpaid = async (exp: Expense) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('expenses').update({ is_paid: false }).eq('id', exp.id).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: exp.type === 'income' ? 'Recebimento desmarcado' : 'Pagamento desmarcado' });
      queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
      onDeleted();
    } catch (err: any) {
      showFriendlyError(err);
    }
  };

  const handleMarkAsPaid = async (exp: Expense) => {
    if (!user) return;
    try {
      const newValue = parseFloat(payValue);
      const valueChanged = !isNaN(newValue) && newValue !== exp.value;
      const finalValue = valueChanged && !isNaN(newValue) ? newValue : exp.value;

      const payDate = (() => {
        if (payDateMode === 'original') return exp.date;
        if (payDateMode === 'custom' && payCustomDate) {
          return `${payCustomDate.getFullYear()}-${String(payCustomDate.getMonth() + 1).padStart(2, '0')}-${String(payCustomDate.getDate()).padStart(2, '0')}`;
        }
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      })();

      const dateChanged = payDate !== exp.date;

      // If this is a recurring template, INSERT a new paid copy instead of updating the template
      if (exp.is_recurring) {
        // The virtual projected occurrence keeps the template id intact
        const templateId = exp.id;
        // The date the user is "replacing" — i.e. the projected occurrence date.
        const projectedOccurrenceDate = exp.date;

        const { error } = await supabase.from('expenses').insert({
          user_id: (exp as any).user_id || user?.id,
          description: exp.description,
          value: finalValue,
          final_category: exp.final_category,
          type: exp.type,
          date: payDate,
          is_recurring: false,
          is_paid: true,
          wallet_id: exp.wallet_id || null,
          credit_card_id: exp.credit_card_id || null,
          payment_method: exp.payment_method || null,
          notes: exp.notes || null,
          tags: exp.tags || null,
          project_id: exp.project_id || null,
          invoice_month: exp.invoice_month || null,
        });
        if (error) throw error;

        // Always register an exception for the projected occurrence so that
        // neither the projection engine nor the generate-recurring background
        // job re-creates this occurrence (which would cause a duplicate when
        // payDate ≠ projectedOccurrenceDate).
        const { error: excErr } = await (supabase.from as any)('recurring_exceptions').insert({
          user_id: (exp as any).user_id || user?.id,
          template_id: templateId,
          occurrence_date: projectedOccurrenceDate,
        });
        if (excErr && !`${excErr.message}`.toLowerCase().includes('duplicate')) {
          throw excErr;
        }

        // If user opted to apply changes to all future occurrences, update the template
        if ((valueChanged || dateChanged) && payApplyScope === 'all') {
          const templateUpdate: ExpenseUpdate = {};
          if (valueChanged) templateUpdate.value = newValue;
          if (dateChanged) {
            // Update the template's day-of-month so future projections use the new day
            const newDay = String(new Date(payDate + 'T12:00:00').getDate()).padStart(2, '0');
            const origDate = new Date(exp.date + 'T12:00:00');
            const newTemplateDate = `${origDate.getFullYear()}-${String(origDate.getMonth() + 1).padStart(2, '0')}-${newDay}`;
            templateUpdate.date = newTemplateDate;
          }
          if (Object.keys(templateUpdate).length > 0) {
            const { error: tplErr } = await supabase
              .from('expenses')
              .update(templateUpdate)
              .eq('id', templateId)
              .eq('user_id', user.id);
            if (tplErr) throw tplErr;
          }
        }
      } else {
        // Normal (non-recurring) transaction: update in place
        const updateFields: ExpenseUpdate = { is_paid: true, date: payDate };
        if (valueChanged) updateFields.value = newValue;
        const { error } = await supabase.from('expenses').update(updateFields).eq('id', exp.id).eq('user_id', user.id);
        if (error) throw error;

        // If value changed and user chose to apply to all installments
        if (valueChanged && payApplyScope === 'all' && exp.installment_group_id) {
          const { error: groupErr } = await supabase
            .from('expenses')
            .update({ value: newValue })
            .eq('installment_group_id', exp.installment_group_id)
            .eq('user_id', user.id)
            .neq('id', exp.id);
          if (groupErr) throw groupErr;
        }
      }

      toast({ title: exp.type === 'income' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
      await queryClient.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('projected-') || k.startsWith('analytics') || k.startsWith('budget') || k === 'expenses' || k === 'history');
      }, refetchType: 'active' });
      onDeleted();
    } catch (err: any) {
      showFriendlyError(err);
    } finally {
      setPayingExpense(null);
      setPayApplyScope(null);
    }
  };

  const handleDeleteClick = (exp: Expense) => {
    setDeletingExpense(exp);
    if (exp.is_recurring) {
      setDeleteMode(null); // show choice dialog
    } else {
      setDeleteMode('single'); // go straight to confirm
    }
  };

  const handleDelete = async (mode: 'single' | 'all') => {
    if (!deletingExpense || !user) return;
    setDeleting(true);
    try {
      if (mode === 'all') {
        // A recurring series is represented by one template row. Delete by its
        // stable id so unrelated series with the same description/value survive.
        const { error } = await supabase.from('expenses').delete()
          .eq('id', deletingExpense.id)
          .eq('user_id', user.id)
          .eq('is_recurring', true);
        if (error) throw error;
        toast({ title: 'Todas as recorrências excluídas', description: 'Todos os lançamentos recorrentes foram removidos.' });
      } else if (deletingExpense.is_recurring) {
        // "Apenas esta": skip a single occurrence without breaking the series
        if (!user) throw new Error('Sessão expirada');
        await deleteSingleRecurringOccurrence({
          userId: user.id,
          expenseId: deletingExpense.id,
          occurrenceDate: deletingExpense.date,
          isRecurring: deletingExpense.is_recurring,
          frequency: deletingExpense.frequency,
        });
        toast({ title: 'Ocorrência excluída', description: 'Apenas este lançamento foi removido. A recorrência continua nos próximos meses.' });
      } else {
        const { error } = await supabase.from('expenses').delete().eq('id', deletingExpense.id).eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Transação excluída' });
      }
      await queryClient.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('projected-') || k.startsWith('analytics') || k.startsWith('budget') || k === 'expenses' || k === 'history');
      }, refetchType: 'active' });
      onDeleted();
    } catch (err: any) {
      showFriendlyError(err, 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setDeletingExpense(null);
      setDeleteMode(null);
    }
  };

  const targetYear = currentMonth ? parseInt(currentMonth.slice(0, 4)) : new Date().getFullYear();
  const targetMonth = currentMonth ? parseInt(currentMonth.slice(5, 7)) - 1 : new Date().getMonth();

  // getInvoicePeriod recebe o mês do vencimento. Além da fatura que vence no
  // mês selecionado, a lista precisa montar toda fatura paga dentro desse mês,
  // mesmo que o vencimento pertença ao mês seguinte ou anterior.
  const invoicePeriods = useMemo(() => {
    if (creditCards.length === 0) return [];
    const ccPool = invoiceExpenses && invoiceExpenses.length > 0 ? invoiceExpenses : (allExpenses || expenses);
    const monthStartKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    const monthEndKey = toDateKey(new Date(targetYear, targetMonth + 1, 0));
    const requestedPeriods = new Map<string, { card: CreditCardType; monthLabel: string }>();

    const addPeriod = (card: CreditCardType, monthLabel: string) => {
      if (!/^\d{4}-\d{2}$/.test(monthLabel)) return;
      requestedPeriods.set(`${card.id}|${monthLabel}`, { card, monthLabel });
    };

    // Mantém as faturas que vencem no mês escolhido, pagas ou não.
    creditCards.forEach((card) => addPeriod(card, `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`));

    // Inclui faturas pagas na janela atual pela sua data efetiva de pagamento.
    // Sem isso, uma fatura de setembro paga em 29/08 desaparece de setembro
    // pelo vencimento e de agosto por não ter sido criada naquele mês.
    buildInvoiceCashEvents(creditCards, ccPool).forEach((event) => {
      if (!event.paid || event.date < monthStartKey || event.date > monthEndKey) return;
      const card = creditCards.find((candidate) => candidate.id === event.cardId);
      if (card) addPeriod(card, event.monthLabel);
    });

    return Array.from(requestedPeriods.values()).map(({ card, monthLabel }) => {
      const [year, month] = monthLabel.split('-').map(Number);
      return matchExpensesToInvoice(ccPool, getInvoicePeriod(card, year, month - 1));
    });
  }, [creditCards, invoiceExpenses, allExpenses, expenses, targetYear, targetMonth]);



  const investmentWalletSet = useMemo(() => new Set(investmentWalletIds), [investmentWalletIds]);

  const walletMap = useMemo(() => {
    const m: Record<string, string> = {};
    wallets.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [wallets]);

  // Selected month boundaries for strict filtering
  const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
  const monthEndDate = new Date(targetYear, targetMonth + 1, 0);
  const monthEnd = toDateKey(monthEndDate);

    // Build feed items: place CC expenses on invoice due/payment date
    const grouped: DayGroup[] = useMemo(() => {
      const dayMap: Record<string, FeedItem[]> = {};
      const invoicesByDay: Record<string, InvoicePeriod[]> = {};

      const ensureDay = (key: string) => { if (!dayMap[key]) dayMap[key] = []; };
      const isInSelectedMonth = (dateKey: string) => dateKey >= monthStart && dateKey <= monthEnd;

      // A data exibida da fatura usa o mesmo evento de caixa que atualiza o saldo.
      // Isso impede que a lista fique no vencimento quando o pagamento foi feito em outro dia.
      const invoiceCashPool = invoiceExpenses && invoiceExpenses.length > 0
        ? invoiceExpenses
        : (allExpenses || expenses);
      const paymentDateMap = new Map<string, string>(); // cardId|invoice_month -> payment date
      buildInvoiceCashEvents(creditCards, invoiceCashPool).forEach((event) => {
        if (!event.paid) return;
        paymentDateMap.set(`${event.cardId}|${event.monthLabel}`, event.date);
      });

      // Build a set of paid invoice card names to hide their "Pagamento fatura" records
      const paidInvoiceCardNames = new Set<string>();
      if (groupCards) {
        invoicePeriods.forEach(inv => {
          if (inv.status === 'paid') paidInvoiceCardNames.add(inv.cardName.toLowerCase());
        });
      }

      // Track IDs already added to avoid duplicates
      const addedIds = new Set<string>();

      // 1. Add non-CC expenses from the calendar month (already filtered by HistoryPage)
      expenses.forEach(exp => {
        if (exp.credit_card_id) return; // CC expenses handled below
        // Hide "Pagamento fatura X" when the invoice for card X is already shown as paid
        if (groupCards && isTrackedCreditCardPayment(exp, creditCards)) {
          const cardId = getCreditCardPaymentCardId(exp, creditCards);
          const cardName = creditCards.find(card => card.id === cardId)?.name.toLowerCase();
          if (cardName && paidInvoiceCardNames.has(cardName)) return;
        }
        ensureDay(exp.date);
        dayMap[exp.date].push({ expense: exp, isInvoiceItem: false });
        addedIds.add(exp.id);
      });

      // 2. Add CC expenses from invoice periods
      // For PAID invoices, use the actual payment date; otherwise use the due date
      invoicePeriods.forEach(inv => {
        const dueKey = toDateKey(inv.dueDate);
        const paymentDate = paymentDateMap.get(`${inv.cardId}|${inv.monthLabel}`);
        const displayKey = paymentDate ?? dueKey;
        if (!isInSelectedMonth(displayKey)) return;

        const visibleTransactions = invoiceDisplayFilter
          ? inv.transactions.filter(invoiceDisplayFilter)
          : inv.transactions;
        if (visibleTransactions.length === 0) return;
        const displayInvoice = invoiceDisplayFilter
          ? {
              ...inv,
              transactions: visibleTransactions,
              total: visibleTransactions.reduce((sum, transaction) => sum + transaction.value, 0),
            }
          : inv;

        if (groupCards) {
          // Grouped mode: show summary item only
          ensureDay(displayKey);
          if (!invoicesByDay[displayKey]) invoicesByDay[displayKey] = [];
          invoicesByDay[displayKey].push(displayInvoice);
        } else {
          // Ungrouped: show each CC expense individually on the display date
          visibleTransactions.forEach(tx => {
            if (addedIds.has(tx.id)) return;
            addedIds.add(tx.id);
            ensureDay(displayKey);
            dayMap[displayKey].push({
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
    const { balanceMap } = buildDailyBalanceMap({
      monthExpenses: allExpenses && allExpenses.length > 0 ? allExpenses : expenses,
      invoiceExpenses: invoiceExpenses && invoiceExpenses.length > 0 ? invoiceExpenses : allExpenses || expenses,
      creditCards,
      startDate: monthStart,
      endDate: monthEnd,
      startingBalance: startingMonthBalance,
      isCreditCardPayment: (expense) => isTrackedCreditCardPayment(expense, creditCards),
      investmentWalletIds,
    });

    const allDayKeys = new Set<string>([
      ...Object.keys(balanceMap),
      ...Object.keys(dayMap),
    ]);

    const allDisplayDays = new Set<string>([...Object.keys(dayMap), ...Object.keys(invoicesByDay)]);
    const sortedDays = Array.from(allDisplayDays).sort((a, b) => b.localeCompare(a));

    return sortedDays.map(dateKey => ({
      dateKey,
      items: dayMap[dateKey] || [],
      invoices: invoicesByDay[dateKey] || [],
      endOfDayBalance: balanceMap[dateKey] ?? startingMonthBalance,
    }));
  }, [expenses, allExpenses, invoiceExpenses, startingMonthBalance, groupCards, invoicePeriods, monthStart, monthEnd, creditCards, investmentWalletIds, invoiceDisplayFilter]);

  const statusConfig: Record<string, { label: string; className: string }> = {
    open: { label: 'Aberta', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    closed: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-border' },
    overdue: { label: 'Vencida', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    paid: { label: 'Paga', className: 'bg-primary/15 text-primary border-primary/30' },
  };

  const getInvoiceDisplayStatus = (inv: InvoicePeriod) => {
    return statusConfig[inv.status] || statusConfig.open;
  };

  // Auto-scroll to today
  const todayRef = useRef<HTMLDivElement>(null);
  const didScrollToToday = useRef(false);

  useEffect(() => {
    if (!loading && todayRef.current && !didScrollToToday.current) {
      didScrollToToday.current = true;
      // Small delay to ensure layout is settled
      requestAnimationFrame(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [loading, grouped]);

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
                variant="ghost"
                size="sm"
                className={`gap-2 rounded-full h-8 px-3 text-[11px] font-medium border ${groupCards ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted/40 text-muted-foreground border-border/60'}`}
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
            <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>

      ) : !hasContent ? (
        <div role="status" className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{emptyTitle}</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{emptyDescription}</p>
          {onClearFilters && (
            <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onClearFilters}>
              Limpar busca e filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map(({ dateKey, items, invoices, endOfDayBalance }) => {
            if (items.length === 0 && invoices.length === 0) return null;
            return (
              <div key={dateKey} ref={dateKey === toDateKey(new Date()) ? todayRef : undefined}>
                {/* Day header */}
                {(() => {
                  const todayKey = toDateKey(new Date());
                  const isToday = dateKey === todayKey;
                  return (
                    <div className="flex items-center justify-between gap-2 py-2 mb-1">
                      <h3 className={`text-xs sm:text-sm font-semibold capitalize tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {formatGroupDate(dateKey)}
                      </h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold tabular-nums border ${
                        endOfDayBalance >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }`}>
                        {endOfDayBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(endOfDayBalance))}
                      </span>
                    </div>
                  );
                })()}

                {/* Day content */}
                <div className="hairline">

                  {/* Invoice summaries (grouped mode) */}
                  {invoices.map(inv => {
                    const displayStatus = getInvoiceDisplayStatus(inv);
                    const isPaid = inv.status === 'paid';
                    return (
                      <div
                        key={`inv-${inv.cardId}`}
                        className="w-full flex items-center gap-3 px-1 sm:px-2 py-3 hover:bg-muted/40 transition-colors cursor-pointer rounded-xl"
                        onClick={() => setInvoiceModal(inv)}
                      >
                        <div className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
                          <CreditCard className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">Fatura {inv.cardName}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {inv.transactions.length} {inv.transactions.length === 1 ? 'transação' : 'transações'} • Vence {inv.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center justify-end gap-2 text-right">
                          {inv.status !== 'open' && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${displayStatus.className}`}>
                              {displayStatus.label}
                            </Badge>
                          )}
                          <span className="text-sm font-semibold text-destructive tabular-nums">
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
                    const category = resolveTransactionCategory(categories, exp);
                    const isIncome = exp.type === 'income';
                    const isTransfer = exp.type === 'transfer';
                    const isPending = !exp.is_paid;
                    const walletName = exp.wallet_id ? walletMap[exp.wallet_id] : null;
                    const destWalletName = (exp as any).destination_wallet_id ? walletMap[(exp as any).destination_wallet_id] : null;
                    const transferDelta = isTransfer ? transferCashDelta(exp as any, investmentWalletSet) : 0;
                    const transferSign = transferDelta > 0 ? '+' : transferDelta < 0 ? '-' : '';

                    const statusDot = isPending
                      ? 'bg-muted-foreground/40'
                      : isIncome
                        ? 'bg-emerald-500'
                        : isTransfer
                          ? 'bg-primary'
                          : 'bg-emerald-500';

                    return (
                      <div
                        key={exp.id}
                        className="relative w-full flex items-center gap-2.5 sm:gap-3 px-1 sm:px-2 py-2.5 rounded-xl hover:bg-muted/40 transition-colors group"
                      >
                        {/* Category icon */}
                        <div
                          className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border ${isInvoiceItem ? 'bg-primary/10 border-primary/20' : 'bg-muted/70 border-border/50'}`}
                          style={!isInvoiceItem && category ? {
                            color: category.color,
                            backgroundColor: `color-mix(in srgb, ${category.color} 14%, transparent)`,
                            borderColor: `color-mix(in srgb, ${category.color} 24%, transparent)`,
                          } : undefined}
                          title={category?.name || 'Sem categoria'}
                        >

                          {isTransfer ? (
                            <ArrowLeftRight className="h-4.5 w-4.5 text-primary" />
                          ) : isInvoiceItem ? (
                            <CreditCard className="h-4.5 w-4.5 text-primary" />
                          ) : (
                            <DynamicCategoryIcon name={category?.icon} className="h-4.5 w-4.5" />
                          )}
                        </div>


                        {/* Description + meta */}
                         <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <p className={`font-medium min-w-0 break-words ${labelFitClass(exp.description || '')}`} title={exp.description}>
                              {exp.description}
                              {exp.installment_info && !exp.is_recurring && (
                                <span className="text-[10px] font-normal text-muted-foreground ml-1">({exp.installment_info})</span>
                              )}
                            </p>

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
                              <span className="text-[10px] text-muted-foreground">
                                Compra em {formatPurchaseDate(originalDate)}
                              </span>
                            )}
                            {isInvoiceItem && originalDate && (walletName || exp.credit_card_id) && (
                              <span className="text-[10px] text-muted-foreground">•</span>
                            )}
                            {isTransfer ? (
                              <>
                                <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-[10px] sm:text-[11px] text-muted-foreground break-words">
                                  {walletName || 'Origem'} → {destWalletName || 'Destino'}
                                </span>
                                {transferDelta !== 0 && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 shrink-0 ${
                                      transferDelta > 0
                                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                        : 'bg-destructive/15 text-destructive border-destructive/30'
                                    }`}
                                  >
                                    {transferDelta > 0 ? 'Entrada no caixa' : 'Saída do caixa'}
                                  </Badge>
                                )}
                              </>
                            ) : (walletName || exp.credit_card_id) ? (
                              <>
                                <Wallet className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-[10px] sm:text-[11px] text-muted-foreground break-words">
                                  {walletName || ''}
                                  {walletName && exp.credit_card_id ? ' • ' : ''}
                                  {exp.credit_card_id ? 'Cartão' : !walletName ? '' : ' • Débito'}
                                </span>

                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Value + status */}
                        <div className="shrink-0 flex flex-col items-end justify-center min-w-fit sm:min-w-[130px] text-right whitespace-nowrap">
                          <span className={`font-semibold tabular-nums ${currencyFitClass(`${isIncome ? '+' : '-'}${formatCurrency(exp.value)}`)} ${
                            isTransfer
                              ? transferDelta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : transferDelta < 0
                                  ? 'text-destructive'
                                  : 'text-foreground'
                              : isIncome
                                ? isPending ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-emerald-600 dark:text-emerald-400'
                                : isPending ? 'text-destructive/70' : 'text-destructive'
                          }`}>
                            {isIncome ? '+' : isTransfer ? transferSign : '-'}{formatCurrency(exp.value)}
                          </span>

                          {!isTransfer && (
                            <span className="flex items-center gap-1 mt-0.5">
                              <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                              <span className="text-[10px] text-muted-foreground">
                                {isPending ? 'Pendente' : isIncome ? 'Recebido' : 'Pago'}
                              </span>
                            </span>
                          )}
                        </div>


                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Ações de ${exp.description}`}
                            >
                              <MoreHorizontal className="h-4.5 w-4.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="floating-glass w-56 rounded-2xl p-2">
                            {isPending && !isTransfer && (
                              <DropdownMenuItem className="gap-2 rounded-xl" onClick={() => openPayDialog(exp)}>
                                <Check className="h-4 w-4 text-emerald-600" />
                                {isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'}
                              </DropdownMenuItem>
                            )}
                            {!isPending && !isTransfer && !exp.is_recurring && (
                              <DropdownMenuItem className="gap-2 rounded-xl" onClick={() => handleMarkAsUnpaid(exp)}>
                                <Undo2 className="h-4 w-4 text-amber-600" />
                                Desfazer pagamento
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 rounded-xl" onClick={() => setEditingExpense(exp)}>
                              <Pencil className="h-4 w-4" />
                              Editar transação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 rounded-xl text-destructive focus:text-destructive" onClick={() => handleDeleteClick(exp)}>
                              <Trash2 className="h-4 w-4" />
                              Excluir transação
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      <AlertDialog open={!!deletingExpense} onOpenChange={(open) => { if (!open) { setDeletingExpense(null); setDeleteMode(null); } }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingExpense?.is_recurring && deleteMode === null
                ? 'Esta é uma transação recorrente. Deseja excluir apenas este lançamento ou todos os lançamentos recorrentes?'
                : 'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={deletingExpense?.is_recurring && deleteMode === null ? 'flex-col sm:flex-row gap-2' : ''}>
            <AlertDialogCancel className="rounded-xl" onClick={() => { setDeletingExpense(null); setDeleteMode(null); }}>Cancelar</AlertDialogCancel>
            {deletingExpense?.is_recurring && deleteMode === null ? (
              <>
                <Button variant="outline" className="rounded-xl" disabled={deleting} onClick={() => handleDelete('single')}>
                  Apenas esta
                </Button>
                <Button variant="destructive" className="rounded-xl" disabled={deleting} onClick={() => handleDelete('all')}>
                  {deleting ? 'Excluindo...' : 'Todas as recorrências'}
                </Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => handleDelete('single')} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
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
          refetch={onDeleted}
        />
      )}

      {/* Pay/receive dialog with value edit */}
      <AlertDialog open={!!payingExpense} onOpenChange={(open) => { if (!open) { setPayingExpense(null); setPayApplyScope(null); } }}>
        <AlertDialogContent className="rounded-2xl max-w-[calc(100vw-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {payingExpense?.type === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {/* Editable value */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="flex h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={payValue}
                      onChange={(e) => {
                        setPayValue(e.target.value);
                        const newVal = parseFloat(e.target.value);
                        setPayValueChanged(!isNaN(newVal) && newVal !== payingExpense?.value);
                      }}
                    />
                  </div>
                </div>

                {/* Scope choice if value changed and has installments */}
                {payValueChanged && payingExpense?.installment_group_id && !payingExpense?.is_recurring && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Aplicar novo valor em:</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={payApplyScope === 'single' ? 'default' : 'outline'}
                        className="rounded-xl text-xs flex-1"
                        onClick={() => setPayApplyScope('single')}
                      >
                        Apenas esta
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={payApplyScope === 'all' ? 'default' : 'outline'}
                        className="rounded-xl text-xs flex-1"
                        onClick={() => setPayApplyScope('all')}
                      >
                        Todas as parcelas
                      </Button>
                    </div>
                  </div>
                )}

                {/* Scope choice for recurring transactions when value or date changed */}
                {payingExpense?.is_recurring && (payValueChanged || payDateMode !== 'original') && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-foreground">
                      Esta é uma transação recorrente. Aplicar a alteração em:
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={payApplyScope === 'single' ? 'default' : 'outline'}
                        className="rounded-xl text-xs flex-1"
                        onClick={() => setPayApplyScope('single')}
                      >
                        Apenas esta
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={payApplyScope === 'all' ? 'default' : 'outline'}
                        className="rounded-xl text-xs flex-1"
                        onClick={() => setPayApplyScope('all')}
                      >
                        Todas as próximas
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Data do pagamento:</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={payDateMode === 'original' ? 'default' : 'outline'}
                      className="rounded-xl text-xs justify-start"
                      onClick={() => setPayDateMode('original')}
                    >
                      Manter data original ({payingExpense ? new Date(payingExpense.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={payDateMode === 'today' ? 'default' : 'outline'}
                      className="rounded-xl text-xs justify-start"
                      onClick={() => setPayDateMode('today')}
                    >
                      Data de hoje ({new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })})
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={payDateMode === 'custom' ? 'default' : 'outline'}
                        className="rounded-xl text-xs justify-start flex-1"
                        onClick={() => setPayDateMode('custom')}
                      >
                        <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                        {payDateMode === 'custom' && payCustomDate
                          ? payCustomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Escolher data'}
                      </Button>
                    </div>
                    {payDateMode === 'custom' && (
                      <div className="flex justify-center">
                        <Calendar
                          mode="single"
                          selected={payCustomDate}
                          onSelect={setPayCustomDate}
                          className={cn("p-3 pointer-events-auto rounded-xl border")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" onClick={() => { setPayingExpense(null); setPayApplyScope(null); }}>Cancelar</AlertDialogCancel>
            <Button
              className="rounded-xl bg-success text-success-foreground hover:bg-success/90"
              disabled={
                (payValueChanged && !!payingExpense?.installment_group_id && !payingExpense?.is_recurring && !payApplyScope) ||
                (!!payingExpense?.is_recurring && (payValueChanged || payDateMode !== 'original') && !payApplyScope) ||
                (payDateMode === 'custom' && !payCustomDate)
              }
              onClick={() => payingExpense && handleMarkAsPaid(payingExpense)}
            >
              Confirmar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
