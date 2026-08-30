import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalFooter } from '@/components/ui/responsive-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { PlusCircle, Wallet, Landmark, TrendingUp, Bitcoin, Trash2, CreditCard, Calendar, ChevronLeft, ChevronRight, ArrowLeft, Pencil, PiggyBank } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { useExchangeRates, convertToBRL, formatForeignCurrency, type ExchangeRates } from '@/hooks/useExchangeRates';
import { useProjectedTotals } from '@/hooks/useProjectedTotals';
import { useSelectedDate } from '@/contexts/DateContext';
import { buildWalletBalances } from '@/lib/walletBalances';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { getInvoicePeriod, matchExpensesToInvoice, type InvoicePeriod } from '@/lib/invoiceHelpers';
import { useUserSettingsRow, useInvalidateUserSettings } from '@/hooks/useUserSettingsRow';
import { MonthSelector } from '@/components/MonthSelector';
import { PageHeader } from '@/components/ui/page-header';
import { AdjustBalanceModal } from '@/components/wallet/AdjustBalanceModal';
import { InvoicePaymentModal } from '@/components/modals/InvoicePaymentModal';
import { NetWorthChart } from '@/components/analytics/NetWorthChart';
import { useQueryClient } from '@tanstack/react-query';

// ─── Wallet types ───
interface WalletRow {
  id: string;
  user_id: string;
  name: string;
  asset_type: 'checking_account' | 'savings' | 'stocks' | 'crypto' | 'investment';
  currency: string;
  current_balance: number;
  initial_balance: number;
  crypto_symbol: string | null;
  crypto_amount: number | null;
  crypto_price: number | null;
  created_at: string;
}

const ASSET_LABELS: Record<string, string> = {
  checking_account: 'Conta Corrente',
  savings: 'Poupança',
  stocks: 'Investimentos',
  crypto: 'Criptomoedas',
  investment: 'Aplicações / Caixinhas',
};

const ASSET_ICONS: Record<string, typeof Wallet> = {
  checking_account: Wallet,
  savings: Landmark,
  stocks: TrendingUp,
  crypto: Bitcoin,
  investment: PiggyBank,
};

const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'Real (BRL)' },
  { value: 'USD', label: 'Dólar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'BTC', label: 'Bitcoin (BTC)' },
];

// Saldos derivados das transações (mesmo motor da página de Transações).
const walletPaidMap = new Map<string, number>();
const walletProjectedMap = new Map<string, number>();

function getWalletValue(w: WalletRow): number {
  if (w.asset_type === 'crypto' && w.crypto_amount && w.crypto_price) {
    return w.crypto_amount * w.crypto_price;
  }
  return walletPaidMap.has(w.id) ? walletPaidMap.get(w.id)! : w.initial_balance;
}

function getWalletProjectedValue(w: WalletRow): number {
  if (w.asset_type === 'crypto' && w.crypto_amount && w.crypto_price) {
    return w.crypto_amount * w.crypto_price;
  }
  return walletProjectedMap.has(w.id) ? walletProjectedMap.get(w.id)! : w.initial_balance;
}

function getWalletValueBRL(w: WalletRow, rates: ExchangeRates | undefined): number {
  const val = getWalletValue(w);
  const converted = convertToBRL(val, w.currency, rates);
  return converted ?? val;
}

function getWalletProjectedBRL(w: WalletRow, rates: ExchangeRates | undefined): number {
  const val = getWalletProjectedValue(w);
  const converted = convertToBRL(val, w.currency, rates);
  return converted ?? val;
}

// ─── Credit Card types ───
interface CreditCardRow {
  id: string;
  user_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  closing_strategy: string;
  closing_days_before_due: number;
  created_at: string;
}

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: rates } = useExchangeRates();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const projected = useProjectedTotals();
  const { data: settingsRow } = useUserSettingsRow();
  const { patch: patchSettings } = useInvalidateUserSettings();
  const defaultWalletId: string | null = settingsRow?.default_wallet_id ?? null;

  // ─── Wallets state ───
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletForm, setWalletForm] = useState({
    name: '', asset_type: 'checking_account' as string, currency: 'BRL' as string, current_balance: '',
    crypto_symbol: '', crypto_amount: '', crypto_price: '',
  });
  const queryClient = useQueryClient();
  const [adjustWallet, setAdjustWallet] = useState<WalletRow | null>(null);

  const handleAdjustSaved = () => {
    projected.refetch?.();
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    fetchWallets();
  };


  // ─── Credit Cards state ───
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState({ name: '', limit_amount: '', closing_day: '25', due_day: '10', closing_strategy: 'fixed' as string, closing_days_before_due: '7' });
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [pendingCardSave, setPendingCardSave] = useState<(() => Promise<void>) | null>(null);

  // ─── Invoice View state ───
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState(
    () => `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
  );
  const [payInvoiceOpen, setPayInvoiceOpen] = useState(false);
  const [payingSaving, setPayingSaving] = useState(false);
  // ─── Fetch wallets ───
  const fetchWallets = useCallback(async () => {
    if (!user) return;
    setWalletsLoading(true);
    const { data: walletsData } = await supabase
      .from('wallets').select('*').eq('user_id', user.id).order('asset_type');
    setWallets((walletsData || []) as WalletRow[]);
    setWalletsLoading(false);
  }, [user]);

  // ─── Fetch credit cards ───
  const fetchCards = useCallback(async () => {
    if (!user) return;
    setCardsLoading(true);
    const { data: cardsData } = await supabase
      .from('credit_cards').select('*').eq('user_id', user.id).order('name');
    setCards((cardsData || []) as CreditCardRow[]);
    setCardsLoading(false);
  }, [user]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);
  useEffect(() => { fetchCards(); }, [fetchCards]);

  // A fatura exibida acompanha o mês selecionado no seletor global.
  useEffect(() => {
    setInvoiceMonth(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`);
  }, [selectedMonth, selectedYear]);

  const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);

  const invoiceLoading = projected.loading;

  /**
   * Faturas montadas pelo motor único da plataforma (mesmo usado em Análises):
   * exclui os registros de "Pagamento fatura", ignora receitas/transferências
   * e resolve o mês de vencimento pelo ciclo do cartão.
   */
  const buildInvoice = useCallback((card: CreditCardRow, monthLabel: string): InvoicePeriod => {
    const [y, m] = monthLabel.split('-').map(Number);
    const period = getInvoicePeriod(card as any, y, m - 1);
    return matchExpensesToInvoice(projected.invoiceExpenses, period);
  }, [projected.invoiceExpenses]);

  const selectedInvoice = useMemo(
    () => (selectedCard ? buildInvoice(selectedCard, invoiceMonth) : null),
    [selectedCard, invoiceMonth, buildInvoice],
  );

  const invoiceTransactions = selectedInvoice?.transactions ?? [];
  const invoiceTotal = selectedInvoice?.total ?? 0;

  const INVOICE_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    open: { label: 'Aberta', variant: 'default' },
    closed: { label: 'Fechada', variant: 'secondary' },
    overdue: { label: 'Vencida', variant: 'destructive' },
    paid: { label: 'Paga', variant: 'outline' },
  };

  const navigateInvoiceMonth = (direction: -1 | 1) => {
    const [y, m] = invoiceMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setInvoiceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthLabel = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return format(d, 'MMMM yyyy', { locale: pt }).replace(/^\w/, c => c.toUpperCase());
  };



  // ─── Wallet handlers ───
  const resetWalletForm = () => setWalletForm({ name: '', asset_type: 'checking_account', currency: 'BRL', current_balance: '', crypto_symbol: '', crypto_amount: '', crypto_price: '' });

  const handleAddWallet = async () => {
    if (!walletForm.name.trim()) {
      toast({ title: 'Erro', description: 'Preencha o nome.', variant: 'destructive' });
      return;
    }
    setWalletSaving(true);
    const isCrypto = walletForm.asset_type === 'crypto';
    const { error } = await supabase.from('wallets').insert({
      user_id: user?.id,
      name: walletForm.name.trim(),
      asset_type: walletForm.asset_type,
      currency: isCrypto ? 'BTC' : walletForm.currency,
      initial_balance: isCrypto ? 0 : parseFloat(walletForm.current_balance) || 0,
      current_balance: isCrypto ? 0 : parseFloat(walletForm.current_balance) || 0,
      crypto_symbol: isCrypto ? (walletForm.crypto_symbol.trim().toUpperCase() || 'BTC') : null,
      crypto_amount: isCrypto ? parseFloat(walletForm.crypto_amount) || 0 : null,
      crypto_price: isCrypto ? parseFloat(walletForm.crypto_price) || 0 : null,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ativo adicionado!' });
      resetWalletForm();
      setWalletModalOpen(false);
      fetchWallets();
    }
    setWalletSaving(false);
  };

  const handleDeleteWallet = async (id: string) => {
    const { error } = await supabase.from('wallets').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Ativo removido' }); fetchWallets(); }
  };

  // ─── Credit Card handlers ───
  const openEditCard = (card: CreditCardRow) => {
    setEditingCardId(card.id);
    setCardForm({
      name: card.name,
      limit_amount: String(card.limit_amount),
      closing_day: String(card.closing_day),
      due_day: String(card.due_day),
      closing_strategy: card.closing_strategy,
      closing_days_before_due: String(card.closing_days_before_due),
    });
    setCardModalOpen(true);
  };

  const resetCardForm = () => {
    setEditingCardId(null);
    setCardForm({ name: '', limit_amount: '', closing_day: '25', due_day: '10', closing_strategy: 'fixed', closing_days_before_due: '7' });
  };

  const buildCardPayload = () => ({
    user_id: user?.id,
    name: cardForm.name.trim(),
    limit_amount: parseFloat(cardForm.limit_amount),
    closing_day: cardForm.closing_strategy === 'fixed' ? (parseInt(cardForm.closing_day) || 25) : 1,
    due_day: parseInt(cardForm.due_day) || 10,
    closing_strategy: cardForm.closing_strategy,
    closing_days_before_due: cardForm.closing_strategy === 'relative' ? (parseInt(cardForm.closing_days_before_due) || 7) : 7,
  });

  const handleAddCard = async () => {
    if (!cardForm.name.trim() || !cardForm.limit_amount) {
      toast({ title: 'Erro', description: 'Preencha nome e limite.', variant: 'destructive' });
      return;
    }
    setCardSaving(true);
    const { error } = await supabase.from('credit_cards').insert(buildCardPayload());
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cartão adicionado!' });
      resetCardForm();
      setCardModalOpen(false);
      fetchCards();
    }
    setCardSaving(false);
  };

  const handleSaveEditCard = async (recalculate: boolean) => {
    if (!editingCardId || !user) return;
    setCardSaving(true);
    const payload = buildCardPayload();
    delete (payload as any).user_id;
    const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCardId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      setCardSaving(false);
      return;
    }

    if (recalculate) {
      // Recalculate invoice_month for all expenses on this card
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, date')
        .eq('user_id', user.id)
        .eq('credit_card_id', editingCardId);

      if (expenses && expenses.length > 0) {
        const closingDay = payload.closing_strategy === 'fixed'
          ? payload.closing_day
          : Math.max((payload.due_day || 10) - (payload.closing_days_before_due || 7), 1);

        for (const exp of expenses) {
          const [year, month, day] = exp.date.split('-').map(Number);
          let invMonth: string;
          if (day > closingDay) {
            const nm = month === 12 ? 1 : month + 1;
            const ny = month === 12 ? year + 1 : year;
            invMonth = `${ny}-${String(nm).padStart(2, '0')}`;
          } else {
            invMonth = `${year}-${String(month).padStart(2, '0')}`;
          }
          await supabase.from('expenses').update({ invoice_month: invMonth }).eq('id', exp.id);
        }
        toast({ title: 'Cartão atualizado!', description: `${expenses.length} faturas recalculadas.` });
      } else {
        toast({ title: 'Cartão atualizado!' });
      }
    } else {
      toast({ title: 'Cartão atualizado!' });
    }

    resetCardForm();
    setCardModalOpen(false);
    setRecalcDialogOpen(false);
    fetchCards();
    projected.refetch();
    setCardSaving(false);
  };

  const handleSubmitCard = () => {
    if (!cardForm.name.trim() || !cardForm.limit_amount) {
      toast({ title: 'Erro', description: 'Preencha nome e limite.', variant: 'destructive' });
      return;
    }
    if (editingCardId) {
      setRecalcDialogOpen(true);
    } else {
      handleAddCard();
    }
  };

  const handleDeleteCard = async (id: string) => {
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Cartão removido' }); fetchCards(); }
  };

  // ─── Invoice date preview ───
  const invoiceDatePreview = useMemo(() => {
    const dueDay = parseInt(cardForm.due_day) || 10;
    let closingDay: number;
    if (cardForm.closing_strategy === 'relative') {
      closingDay = dueDay - (parseInt(cardForm.closing_days_before_due) || 7);
      if (closingDay <= 0) closingDay += 30;
    } else {
      closingDay = parseInt(cardForm.closing_day) || 25;
    }
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const closingMonth = monthNames[month];
    const dueMonthIdx = closingDay >= dueDay ? (month + 1) % 12 : month;
    const dueMonthName = monthNames[dueMonthIdx];
    const dueYear = closingDay >= dueDay && month === 11 ? year + 1 : year;
    return `Com essas configurações, sua fatura de ${closingMonth} fechará dia ${String(closingDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} e vencerá dia ${String(dueDay).padStart(2, '0')}/${String(dueMonthIdx + 1).padStart(2, '0')}`;
  }, [cardForm.due_day, cardForm.closing_day, cardForm.closing_strategy, cardForm.closing_days_before_due]);

  // ─── Pay Invoice handler ───
  const handlePayInvoice = async (walletId: string, paymentDate: string) => {
    if (!user || !selectedInvoice || !walletId || selectedInvoice.total <= 0) return;
    setPayingSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      description: `Pagamento fatura ${selectedInvoice.cardName} - ${selectedInvoice.monthLabel}`,
      value: selectedInvoice.total,
      type: 'expense',
      final_category: 'Cartão de Crédito',
      date: paymentDate,
      wallet_id: walletId,
      credit_card_id: selectedInvoice.cardId,
      payment_method: 'debit',
      is_paid: true,
      invoice_month: selectedInvoice.monthLabel,
      notes: `Pagamento da fatura do cartão ${selectedInvoice.cardName}`,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // Mark all invoice transactions as paid
      await supabase.from('expenses').update({ is_paid: true }).eq('user_id', user.id).eq('credit_card_id', selectedInvoice.cardId).eq('invoice_month', selectedInvoice.monthLabel);
      toast({ title: 'Fatura paga!', description: `${formatCurrency(selectedInvoice.total)} debitado da conta.` });
      setPayInvoiceOpen(false);
      projected.refetch();
      fetchWallets();
    }
    setPayingSaving(false);
  };

  // ─── Saldos derivados das transações (mesmo motor da página de Transações) ───
  const today = format(new Date(), 'yyyy-MM-dd');

  const walletBalances = useMemo(() => buildWalletBalances({
    wallets: wallets.map(w => ({ id: w.id, initial_balance: w.initial_balance ?? 0 })),
    historicalExpenses: projected.effectiveHistoricalExpenses,
    monthExpenses: projected.monthExpenses,
    invoiceExpenses: projected.invoiceExpenses,
    creditCards: projected.creditCards,
    defaultWalletId,
    today,
    startDate,
    endDate,
    isCreditCardPayment: (e: any) => isTrackedCreditCardPayment(e, projected.creditCards),
  }), [wallets, projected.effectiveHistoricalExpenses, projected.monthExpenses, projected.invoiceExpenses, projected.creditCards, defaultWalletId, today, startDate, endDate]);

  walletPaidMap.clear();
  walletProjectedMap.clear();
  walletBalances.forEach(b => {
    walletPaidMap.set(b.walletId, b.paidBalanceToday);
    walletProjectedMap.set(b.walletId, b.projectedEndOfMonth);
  });

  const handleDefaultWalletChange = async (walletId: string) => {
    if (!user) return;
    patchSettings({ default_wallet_id: walletId });
    const { error } = await supabase.from('user_settings')
      .update({ default_wallet_id: walletId, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Erro ao definir carteira padrão', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Carteira padrão atualizada' });
  };

  // ─── Computed data ───
  const totalWealth = useMemo(() => wallets.reduce((s, w) => s + getWalletValueBRL(w, rates), 0), [wallets, rates]);

  const liquidBalance = useMemo(
    () => wallets.filter(w => w.asset_type === 'checking_account' || w.asset_type === 'savings').reduce((s, w) => s + getWalletValueBRL(w, rates), 0),
    [wallets, rates],
  );

  const investedBalance = useMemo(
    () => wallets.filter(w => w.asset_type === 'investment' || w.asset_type === 'stocks' || w.asset_type === 'crypto').reduce((s, w) => s + getWalletValueBRL(w, rates), 0),
    [wallets, rates],
  );

  const projectedTotalWealth = useMemo(
    () => wallets.reduce((s, w) => s + getWalletProjectedBRL(w, rates), 0),
    [wallets, rates],
  );

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    wallets.forEach(w => { map[w.asset_type] = (map[w.asset_type] || 0) + getWalletValueBRL(w, rates); });
    return Object.entries(map)
      .map(([type, value]) => ({ type, name: ASSET_LABELS[type] || type, value }))
      .sort((a, b) => b.value - a.value);
  }, [wallets, rates]);

  const grouped = useMemo(() => {
    const g: Record<string, WalletRow[]> = {};
    wallets.forEach(w => { if (!g[w.asset_type]) g[w.asset_type] = []; g[w.asset_type].push(w); });
    return g;
  }, [wallets]);

  // Uso do limite = total da fatura do mês selecionado (sem pagamentos de fatura).
  const usageByCard = useMemo(() => {
    const monthLabel = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const map: Record<string, number> = {};
    cards.forEach(card => { map[card.id] = buildInvoice(card, monthLabel).total; });
    return map;
  }, [cards, buildInvoice, selectedMonth, selectedYear]);

  if (authLoading) return <PageLoadingSkeleton title="Carregando patrimônio" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <PageHeader
              eyebrow="Patrimônio"
              title="Carteira"
              description="Contas, saldos e cartões de crédito em uma visão consolidada."
            />

            <Tabs defaultValue="accounts" className="w-full">
              <TabsList className="w-full max-w-md">
                <TabsTrigger value="accounts" className="flex-1 text-xs sm:text-sm">Contas</TabsTrigger>
                <TabsTrigger value="cards" className="flex-1 text-xs sm:text-sm">Cartões</TabsTrigger>
              </TabsList>

              {/* ════════ TAB: Minhas Contas ════════ */}
              <TabsContent value="accounts" className="space-y-6">
                <MonthSelector />

                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
                  <div className="w-full sm:max-w-xs space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Carteira padrão</Label>
                    <Select value={defaultWalletId ?? ''} onValueChange={handleDefaultWalletChange}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Definir carteira padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.filter(w => w.asset_type !== 'crypto').map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {defaultWalletId
                        ? 'Transações sem carteira definida entram nesta conta.'
                        : 'Defina uma carteira para receber as transações sem carteira definida.'}
                    </p>
                  </div>
                  <Button onClick={() => setWalletModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                    <PlusCircle className="h-5 w-5" />
                    Novo ativo
                  </Button>
                </div>

                {/* Visão consolidada dos ativos. Passivos de cartão permanecem
                    separados até a etapa específica de patrimônio líquido. */}
                <Card className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-card">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total em ativos</p>
                        <p className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{formatCurrency(totalWealth)}</p>
                        <p className="text-sm text-muted-foreground">
                          {wallets.length} ativo{wallets.length !== 1 ? 's' : ''} cadastrado{wallets.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Wallet className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-xs font-medium text-muted-foreground">Em contas</p>
                        <p className="mt-1 break-words text-lg font-semibold">{formatCurrency(liquidBalance)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-xs font-medium text-muted-foreground">Em investimentos</p>
                        <p className="mt-1 break-words text-lg font-semibold">{formatCurrency(investedBalance)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                        <p className="text-xs font-medium text-muted-foreground">Previsão do mês</p>
                        <p className="mt-1 break-words text-lg font-semibold">{formatCurrency(projectedTotalWealth)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Composição substitui gráficos redundantes: é mais legível em
                    tela estreita e permite comparar valores completos. */}
                {wallets.length > 0 && (
                  <Card className="rounded-3xl border-border/70 bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Composição dos ativos</CardTitle>
                      <p className="text-sm text-muted-foreground">Valores atuais por tipo de ativo.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {byType.map(({ type, name, value }) => {
                        const Icon = ASSET_ICONS[type] || Wallet;
                        const percentage = totalWealth > 0 ? (value / totalWealth) * 100 : 0;
                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                                <Icon className="h-4 w-4" />
                              </div>
                              <p className="min-w-0 flex-1 break-words text-sm font-medium">{name}</p>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold">{formatCurrency(value)}</p>
                                <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                <NetWorthChart />

                {/* Asset sections */}
                {walletsLoading ? (
                  <p className="text-muted-foreground text-center py-12">Carregando...</p>
                ) : wallets.length === 0 ? (
                  <Card className="rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">Nenhum ativo registrado</p>
                      <p className="text-sm mt-1">Adicione contas, investimentos ou criptomoedas.</p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(grouped).map(([type, items]) => {
                    const Icon = ASSET_ICONS[type] || Wallet;
                    const typeTotal = items.reduce((s, w) => s + getWalletValueBRL(w, rates), 0);
                    const pct = totalWealth > 0 ? (typeTotal / totalWealth) * 100 : 0;
                    return (
                      <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <h2 className="break-words text-lg font-semibold">{ASSET_LABELS[type]}</h2>
                            <Badge variant="secondary" className="shrink-0 text-xs">{pct.toFixed(0)}%</Badge>
                          </div>
                          <span className="shrink-0 text-right font-bold text-lg">{formatCurrency(typeTotal)}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {items.map(w => {
                            const val = getWalletValue(w);
                            const valBRL = getWalletValueBRL(w, rates);
                            const projectedVal = getWalletProjectedValue(w);
                            const isForeign = w.currency !== 'BRL';
                            return (
                              <Card key={w.id} className="rounded-3xl border-border/70 bg-card transition-shadow hover:shadow-card">
                                <CardContent className="p-5">
                                  <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                      <p className="break-words font-semibold">{w.name}</p>
                                      {w.asset_type === 'crypto' && w.crypto_symbol && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {w.crypto_amount} {w.crypto_symbol} × {formatCurrency(w.crypto_price || 0)}
                                        </p>
                                      )}
                                      {isForeign && (
                                        <Badge variant="outline" className="text-[10px] mt-1">{w.currency}</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                    {w.asset_type !== 'crypto' && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Ajustar saldo"
                                        aria-label={`Ajustar saldo de ${w.name}`}
                                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-xl"
                                        onClick={() => setAdjustWallet(w)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remover ativo?</AlertDialogTitle>
                                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteWallet(w.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Remover</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    </div>
                                  </div>
                                  {isForeign ? (
                                    <div className="mt-3">
                                      <p className="text-xl font-bold">{formatForeignCurrency(val, w.currency)}</p>
                                      <p className="text-sm text-muted-foreground">≈ {formatCurrency(valBRL)}</p>
                                    </div>
                                  ) : (
                                    <p className="text-2xl font-bold mt-3">{formatCurrency(val)}</p>
                                  )}
                                  {w.asset_type !== 'crypto' && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      Previsto fim do mês: <span className={projectedVal < 0 ? 'text-destructive font-semibold' : 'font-semibold'}>
                                        {isForeign ? formatForeignCurrency(projectedVal, w.currency) : formatCurrency(projectedVal)}
                                      </span>
                                    </p>
                                  )}
                                  {totalWealth > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <Progress value={(valBRL / totalWealth) * 100} className="h-1.5" />
                                      <p className="text-[11px] text-muted-foreground">{((valBRL / totalWealth) * 100).toFixed(1)}% do património</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* ════════ TAB: Cartões de Crédito ════════ */}
              <TabsContent value="cards" className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {selectedCardId && (
                    <Button variant="ghost" onClick={() => setSelectedCardId(null)} className="gap-2 rounded-xl">
                      <ArrowLeft className="h-4 w-4" />
                      Voltar aos cartões
                    </Button>
                  )}
                  <div className="ml-auto">
                    <Button onClick={() => setCardModalOpen(true)} className="gap-2 rounded-xl h-11 px-5 sm:px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                      <PlusCircle className="h-5 w-5" />
                      Novo Cartão
                    </Button>
                  </div>
                </div>

                {selectedCardId && selectedCard ? (
                  /* ─── Invoice View ─── */
                  <div className="space-y-5">
                    {/* Card header */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-xl font-bold">{selectedCard.name}</h2>
                        <p className="break-words text-sm text-muted-foreground">Limite: {formatCurrency(selectedCard.limit_amount)}</p>
                      </div>
                    </div>

                    {/* Month Navigator */}
                    <Card className="rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Button variant="ghost" size="icon" onClick={() => navigateInvoiceMonth(-1)} className="rounded-xl">
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <div className="min-w-0 flex-1 text-center">
                            <p className="break-words text-lg font-bold">{formatMonthLabel(invoiceMonth)}</p>
                            <p className="text-xs text-muted-foreground">Fatura</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => navigateInvoiceMonth(1)} className="rounded-xl">
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Invoice Summary */}
                    <div className="grid gap-3 min-[480px]:grid-cols-3">
                      <Card className="rounded-2xl border-border/70 bg-card">
                        <CardContent className="p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                          <p className="break-words text-2xl font-bold">{formatCurrency(invoiceTotal)}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border/70 bg-card">
                        <CardContent className="p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Transações</p>
                          <p className="text-2xl font-bold">{invoiceTransactions.length}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border/70 bg-card">
                        <CardContent className="p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Status</p>
                          {(() => {
                            const status = INVOICE_STATUS_LABELS[selectedInvoice?.status ?? 'open'];
                            return <Badge variant={status.variant} className="text-base px-4 py-1">{status.label}</Badge>;
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Pay Invoice Button */}
                    {invoiceTotal > 0 && selectedInvoice?.status !== 'paid' && (
                      <div className="flex justify-center">
                        <Button onClick={() => setPayInvoiceOpen(true)} className="h-auto min-h-12 w-full max-w-md gap-2 rounded-xl px-5 py-3 text-center font-semibold whitespace-normal bg-success text-success-foreground hover:bg-success/90 sm:w-auto sm:text-base">
                          <Wallet className="h-5 w-5" />
                          <span>Pagar fatura</span>
                          <span className="font-bold">{formatCurrency(invoiceTotal)}</span>
                        </Button>
                      </div>
                    )}

                    {/* Invoice Transactions */}
                    <Card className="rounded-3xl border-border/70 bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Transações da Fatura</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {invoiceLoading ? (
                          <p className="text-muted-foreground text-center py-8">Carregando...</p>
                        ) : invoiceTransactions.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">Nenhuma transação nesta fatura.</p>
                        ) : (
                          <>
                          {/* Mobile card view for invoice */}
                          <div className="md:hidden space-y-2">
                            {invoiceTransactions.map(tx => {
                              const cat = getCategoryInfo(tx.final_category);
                              return (
                                <div key={tx.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3 border-b last:border-0">
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm font-medium leading-snug">{tx.description}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-xs text-muted-foreground">{format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cat.label}</Badge>
                                      {tx.installments > 1 && <span className="text-[10px] text-muted-foreground">{tx.installments}x</span>}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-right text-sm font-semibold">{formatCurrency(tx.value)}</span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Desktop table view for invoice */}
                          <div className="hidden md:block">
                            <Table className="table-fixed">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Data</TableHead>
                                  <TableHead className="w-[34%]">Descrição</TableHead>
                                  <TableHead className="w-[22%]">Categoria</TableHead>
                                  <TableHead className="w-[12%]">Parcelas</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {invoiceTransactions.map(tx => {
                                  const cat = getCategoryInfo(tx.final_category);
                                  return (
                                    <TableRow key={tx.id}>
                                      <TableCell className="text-sm">{format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                      <TableCell className="break-words font-medium">{tx.description}</TableCell>
                                      <TableCell className="break-words"><Badge variant="secondary" className="max-w-full whitespace-normal break-words text-xs">{cat.label}</Badge></TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{tx.installments > 1 ? `${tx.installments}x` : '—'}</TableCell>
                                      <TableCell className="text-right font-semibold">{formatCurrency(tx.value)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  /* ─── Cards Grid ─── */
                  <>
                    {cardsLoading ? (
                      <p className="text-muted-foreground text-center py-12">Carregando...</p>
                    ) : cards.length === 0 ? (
                      <Card className="rounded-2xl">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhum cartão cadastrado</p>
                          <p className="text-sm mt-1">Adicione seu primeiro cartão de crédito.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {cards.map(card => {
                          const used = usageByCard[card.id] || 0;
                          const pct = card.limit_amount > 0 ? Math.min((used / card.limit_amount) * 100, 100) : 0;
                          const available = Math.max(card.limit_amount - used, 0);
                          return (
                            <Card key={card.id} className="cursor-pointer overflow-hidden rounded-3xl border-border/70 bg-card transition-shadow hover:shadow-card" onClick={() => setSelectedCardId(card.id)}>
                              <div className={`h-2 ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                      <CreditCard className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="break-words font-semibold leading-snug">{card.name}</p>
                                      <p className="break-words text-xs text-muted-foreground">Limite: {formatCurrency(card.limit_amount)}</p>
                                    </div>
                                  </div>
                                   <div className="flex shrink-0 items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-xl" onClick={e => { e.stopPropagation(); openEditCard(card); }}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl" onClick={e => e.stopPropagation()}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
                                          <AlertDialogDescription>O cartão será removido mas as transações vinculadas serão mantidas.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteCard(card.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Remover</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                   </div>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm">
                                    <span className="break-words text-muted-foreground">Fatura {formatMonthLabel(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`)}</span>
                                    <span className="text-right font-semibold">{formatCurrency(used)}</span>
                                  </div>
                                  <Progress value={pct} className="h-2.5" />
                                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-xs text-muted-foreground">
                                    <span>{pct.toFixed(0)}% utilizado</span>
                                    <span className="text-right break-words">Disponível: {formatCurrency(available)}</span>
                                  </div>
                                </div>
                                <div className="grid gap-2 border-t pt-3 text-xs text-muted-foreground min-[480px]:grid-cols-2">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span className="break-words">{card.closing_strategy === 'relative'
                                      ? `Fecha ${card.closing_days_before_due}d antes`
                                      : `Fecha dia ${card.closing_day}`}</span>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span className="break-words">Vence dia {card.due_day}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      {/* Add Wallet Modal */}
      <ResponsiveModal open={walletModalOpen} onOpenChange={setWalletModalOpen} className="sm:max-w-md rounded-2xl">
        <ResponsiveModalHeader className="p-4 pb-2">
          <ResponsiveModalTitle className="text-xl font-bold">Novo Ativo</ResponsiveModalTitle>
        </ResponsiveModalHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de ativo</Label>
              <Select value={walletForm.asset_type} onValueChange={v => setWalletForm(f => ({ ...f, asset_type: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking_account">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="stocks">Investimentos</SelectItem>
                  <SelectItem value="crypto">Criptomoedas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder={walletForm.asset_type === 'crypto' ? 'Ex: Bitcoin, Ethereum' : 'Ex: Nubank, XP'} value={walletForm.name} onChange={e => setWalletForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
            </div>
            {walletForm.asset_type === 'crypto' ? (
              <>
                <div className="space-y-2">
                  <Label>Símbolo (ex: BTC, ETH)</Label>
                  <Input placeholder="BTC" value={walletForm.crypto_symbol} onChange={e => setWalletForm(f => ({ ...f, crypto_symbol: e.target.value }))} className="rounded-xl h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantidade de moedas</Label>
                    <Input type="number" step="any" min="0" placeholder="0.5" value={walletForm.crypto_amount} onChange={e => setWalletForm(f => ({ ...f, crypto_amount: e.target.value }))} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cotação atual (R$)</Label>
                    <Input type="number" step="0.01" min="0" placeholder="350000" value={walletForm.crypto_price} onChange={e => setWalletForm(f => ({ ...f, crypto_price: e.target.value }))} className="rounded-xl h-11" />
                  </div>
                </div>
                {walletForm.crypto_amount && walletForm.crypto_price && (
                  <div className="rounded-xl bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="text-lg font-bold">{formatCurrency((parseFloat(walletForm.crypto_amount) || 0) * (parseFloat(walletForm.crypto_price) || 0))}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select value={walletForm.currency} onValueChange={v => setWalletForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.filter(c => c.value !== 'BTC').map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Saldo atual ({walletForm.currency})</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00" value={walletForm.current_balance} onChange={e => setWalletForm(f => ({ ...f, current_balance: e.target.value }))} className="rounded-xl h-11" />
                </div>
              </>
            )}
          </div>
        <ResponsiveModalFooter className="p-4 pt-2">
          <Button variant="outline" onClick={() => { resetWalletForm(); setWalletModalOpen(false); }} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleAddWallet} disabled={walletSaving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
            {walletSaving ? 'Salvando...' : 'Adicionar'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModal>

      {/* Add/Edit Card Modal */}
      <ResponsiveModal open={cardModalOpen} onOpenChange={(open) => { if (!open) resetCardForm(); setCardModalOpen(open); }} className="sm:max-w-md rounded-2xl">
        <ResponsiveModalHeader className="p-4 pb-2">
          <ResponsiveModalTitle className="text-xl font-bold">{editingCardId ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <div className="space-y-2">
              <Label>Nome do cartão</Label>
              <Input placeholder="Ex: Nubank, Inter" value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="5000" value={cardForm.limit_amount} onChange={e => setCardForm(f => ({ ...f, limit_amount: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Select value={cardForm.due_day} onValueChange={v => setCardForm(f => ({ ...f, due_day: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de fechamento</Label>
              <Select value={cardForm.closing_strategy} onValueChange={v => setCardForm(f => ({ ...f, closing_strategy: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Dia Fixo</SelectItem>
                  <SelectItem value="relative">Dias antes do Vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cardForm.closing_strategy === 'fixed' ? (
              <div className="space-y-2">
                <Label>Dia de fechamento (1-31)</Label>
                <Select value={cardForm.closing_day} onValueChange={v => setCardForm(f => ({ ...f, closing_day: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Quantos dias antes do vencimento?</Label>
                <Input type="number" min="1" max="30" placeholder="7" value={cardForm.closing_days_before_due} onChange={e => setCardForm(f => ({ ...f, closing_days_before_due: e.target.value }))} className="rounded-xl h-11" />
              </div>
            )}
            {/* Invoice date preview */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {invoiceDatePreview}
              </p>
            </div>
          </div>
        <ResponsiveModalFooter className="p-4 pt-2">
          <Button variant="outline" onClick={() => { resetCardForm(); setCardModalOpen(false); }} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSubmitCard} disabled={cardSaving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
            {cardSaving ? 'Salvando...' : editingCardId ? 'Salvar Alterações' : 'Adicionar'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModal>

      {/* Recalculate Invoices Dialog */}
      <AlertDialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Recalcular faturas?</AlertDialogTitle>
            <AlertDialogDescription>
              As configurações de fechamento foram alteradas. Deseja recalcular o mês da fatura de todas as transações passadas deste cartão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => { setRecalcDialogOpen(false); handleSaveEditCard(false); }}>
              Apenas novas transações
            </Button>
            <Button className="rounded-xl bg-primary text-primary-foreground" disabled={cardSaving} onClick={() => handleSaveEditCard(true)}>
              {cardSaving ? 'Recalculando...' : 'Recalcular tudo'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedInvoice && (
        <InvoicePaymentModal
          open={payInvoiceOpen}
          onOpenChange={setPayInvoiceOpen}
          invoice={selectedInvoice}
          wallets={wallets.map((wallet) => ({
            id: wallet.id,
            name: wallet.name,
            detail: formatCurrency(getWalletValue(wallet)),
          }))}
          submitting={payingSaving}
          onConfirm={handlePayInvoice}
        />
      )}

      {/* ─── Ajustar saldo da conta ─── */}
      <AdjustBalanceModal
        open={!!adjustWallet}
        onOpenChange={v => { if (!v) setAdjustWallet(null); }}
        wallet={adjustWallet ? { id: adjustWallet.id, name: adjustWallet.name } : null}
        currentBalance={adjustWallet ? getWalletValue(adjustWallet) : 0}
        onSaved={handleAdjustSaved}
      />
    </SidebarProvider>
  );
}
