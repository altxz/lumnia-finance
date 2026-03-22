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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, getCategoryInfo } from '@/lib/constants';
import { PlusCircle, Wallet, Landmark, TrendingUp, Bitcoin, Trash2, CreditCard, Calendar, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Wallet types ───
interface WalletRow {
  id: string;
  user_id: string;
  name: string;
  asset_type: 'checking_account' | 'savings' | 'stocks' | 'crypto';
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
};

const ASSET_ICONS: Record<string, typeof Wallet> = {
  checking_account: Wallet,
  savings: Landmark,
  stocks: TrendingUp,
  crypto: Bitcoin,
};

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--ai))', '#F59E0B'];

const walletBalanceMap = new Map<string, number>();

function getWalletValue(w: WalletRow): number {
  if (w.asset_type === 'crypto' && w.crypto_amount && w.crypto_price) {
    return w.crypto_amount * w.crypto_price;
  }
  const txBalance = walletBalanceMap.get(w.id) || 0;
  return w.initial_balance + txBalance;
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

  // ─── Wallets state ───
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletForm, setWalletForm] = useState({
    name: '', asset_type: 'checking_account' as string, current_balance: '',
    crypto_symbol: '', crypto_amount: '', crypto_price: '',
  });

  // ─── Credit Cards state ───
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [cardExpenses, setCardExpenses] = useState<{ credit_card_id: string; value: number }[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardForm, setCardForm] = useState({ name: '', limit_amount: '', closing_day: '25', due_day: '10', closing_strategy: 'fixed' as string, closing_days_before_due: '7' });

  // ─── Invoice View state ───
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [invoiceTransactions, setInvoiceTransactions] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  // ─── Fetch wallets ───
  const fetchWallets = useCallback(async () => {
    if (!user) return;
    setWalletsLoading(true);
    const [{ data: walletsData }, { data: txData }] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).order('asset_type'),
      supabase.from('expenses').select('wallet_id, value, type').eq('user_id', user.id).not('wallet_id', 'is', null),
    ]);
    walletBalanceMap.clear();
    (txData || []).forEach((tx: any) => {
      if (!tx.wallet_id) return;
      const prev = walletBalanceMap.get(tx.wallet_id) || 0;
      walletBalanceMap.set(tx.wallet_id, prev + (tx.type === 'income' ? tx.value : -tx.value));
    });
    setWallets((walletsData || []) as WalletRow[]);
    setWalletsLoading(false);
  }, [user]);

  // ─── Fetch credit cards ───
  const fetchCards = useCallback(async () => {
    if (!user) return;
    setCardsLoading(true);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const [{ data: cardsData }, { data: expData }] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name'),
      supabase.from('expenses').select('credit_card_id, value').eq('user_id', user.id).eq('type', 'expense').not('credit_card_id', 'is', null).gte('date', firstOfMonth),
    ]);
    setCards((cardsData || []) as CreditCardRow[]);
    setCardExpenses((expData || []) as { credit_card_id: string; value: number }[]);
    setCardsLoading(false);
  }, [user]);

  // ─── Fetch invoice transactions ───
  const fetchInvoiceTransactions = useCallback(async () => {
    if (!user || !selectedCardId || !invoiceMonth) return;
    setInvoiceLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('credit_card_id', selectedCardId)
      .eq('invoice_month', invoiceMonth)
      .order('date', { ascending: false });
    setInvoiceTransactions(data || []);
    setInvoiceLoading(false);
  }, [user, selectedCardId, invoiceMonth]);

  useEffect(() => { fetchInvoiceTransactions(); }, [fetchInvoiceTransactions]);

  const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);

  const invoiceTotal = useMemo(() => invoiceTransactions.reduce((s, t) => s + t.value, 0), [invoiceTransactions]);

  const getInvoiceStatus = useCallback((card: CreditCardRow, month: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    const now = new Date();
    const [y, m] = month.split('-').map(Number);
    const closingDay = card.closing_strategy === 'relative'
      ? Math.max(card.due_day - card.closing_days_before_due, 1)
      : card.closing_day;
    const closingDate = new Date(y, m - 1, closingDay);
    const dueDate = new Date(y, m - 1, card.due_day);
    // If due date is before closing date, due is next month
    const effectiveDue = dueDate <= closingDate ? new Date(y, m, card.due_day) : dueDate;

    if (now < closingDate) return { label: 'Aberta', variant: 'default' };
    if (now < effectiveDue) return { label: 'Fechada', variant: 'secondary' };
    return { label: 'Vencida', variant: 'destructive' };
  }, []);

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
  const resetWalletForm = () => setWalletForm({ name: '', asset_type: 'checking_account', current_balance: '', crypto_symbol: '', crypto_amount: '', crypto_price: '' });

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
  const handleAddCard = async () => {
    if (!cardForm.name.trim() || !cardForm.limit_amount) {
      toast({ title: 'Erro', description: 'Preencha nome e limite.', variant: 'destructive' });
      return;
    }
    setCardSaving(true);
    const { error } = await supabase.from('credit_cards').insert({
      user_id: user?.id,
      name: cardForm.name.trim(),
      limit_amount: parseFloat(cardForm.limit_amount),
      closing_day: cardForm.closing_strategy === 'fixed' ? (parseInt(cardForm.closing_day) || 25) : 1,
      due_day: parseInt(cardForm.due_day) || 10,
      closing_strategy: cardForm.closing_strategy,
      closing_days_before_due: cardForm.closing_strategy === 'relative' ? (parseInt(cardForm.closing_days_before_due) || 7) : 7,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cartão adicionado!' });
      setCardForm({ name: '', limit_amount: '', closing_day: '25', due_day: '10', closing_strategy: 'fixed', closing_days_before_due: '7' });
      setCardModalOpen(false);
      fetchCards();
    }
    setCardSaving(false);
  };

  const handleDeleteCard = async (id: string) => {
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Cartão removido' }); fetchCards(); }
  };

  // ─── Computed data ───
  const totalWealth = useMemo(() => wallets.reduce((s, w) => s + getWalletValue(w), 0), [wallets]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    wallets.forEach(w => { map[w.asset_type] = (map[w.asset_type] || 0) + getWalletValue(w); });
    return Object.entries(map).map(([type, value]) => ({ name: ASSET_LABELS[type] || type, value }));
  }, [wallets]);

  const grouped = useMemo(() => {
    const g: Record<string, WalletRow[]> = {};
    wallets.forEach(w => { if (!g[w.asset_type]) g[w.asset_type] = []; g[w.asset_type].push(w); });
    return g;
  }, [wallets]);

  const usageByCard = useMemo(() => {
    const map: Record<string, number> = {};
    cardExpenses.forEach(e => { if (e.credit_card_id) map[e.credit_card_id] = (map[e.credit_card_id] || 0) + e.value; });
    return map;
  }, [cardExpenses]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Minha Carteira</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Contas, ativos e cartões de crédito</p>
            </div>

            <Tabs defaultValue="accounts" className="w-full">
              <TabsList className="w-full max-w-md">
                <TabsTrigger value="accounts" className="flex-1 text-xs sm:text-sm">Minhas Contas</TabsTrigger>
                <TabsTrigger value="cards" className="flex-1 text-xs sm:text-sm">Cartões de Crédito</TabsTrigger>
              </TabsList>

              {/* ════════ TAB: Minhas Contas ════════ */}
              <TabsContent value="accounts" className="space-y-6">
                <div className="flex justify-end">
                  <Button onClick={() => setWalletModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                    <PlusCircle className="h-5 w-5" />
                    Novo Ativo
                  </Button>
                </div>

                {/* Total Net Worth */}
                <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                  <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
                      <Wallet className="h-5 w-5 sm:h-7 sm:w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium opacity-80">Património Líquido Total</p>
                      <p className="text-xl sm:text-3xl font-bold tracking-tight">{formatCurrency(totalWealth)}</p>
                      <p className="text-[10px] sm:text-xs opacity-60 mt-0.5">{wallets.length} ativo{wallets.length !== 1 ? 's' : ''}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts */}
                {wallets.length > 0 && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Distribuição por Tipo</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Valor por Categoria</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={byType}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

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
                    const typeTotal = items.reduce((s, w) => s + getWalletValue(w), 0);
                    const pct = totalWealth > 0 ? (typeTotal / totalWealth) * 100 : 0;
                    return (
                      <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">{ASSET_LABELS[type]}</h2>
                            <Badge variant="secondary" className="text-xs">{pct.toFixed(0)}%</Badge>
                          </div>
                          <span className="font-bold text-lg">{formatCurrency(typeTotal)}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {items.map(w => {
                            const val = getWalletValue(w);
                            return (
                              <Card key={w.id} className="rounded-2xl hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                  <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                      <p className="font-semibold truncate">{w.name}</p>
                                      {w.asset_type === 'crypto' && w.crypto_symbol && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {w.crypto_amount} {w.crypto_symbol} × {formatCurrency(w.crypto_price || 0)}
                                        </p>
                                      )}
                                    </div>
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
                                  <p className="text-2xl font-bold mt-3">{formatCurrency(val)}</p>
                                  {totalWealth > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <Progress value={(val / totalWealth) * 100} className="h-1.5" />
                                      <p className="text-[11px] text-muted-foreground">{((val / totalWealth) * 100).toFixed(1)}% do património</p>
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
                <div className="flex justify-between items-center">
                  {selectedCardId && (
                    <Button variant="ghost" onClick={() => setSelectedCardId(null)} className="gap-2 rounded-xl">
                      <ArrowLeft className="h-4 w-4" />
                      Voltar aos cartões
                    </Button>
                  )}
                  <div className={selectedCardId ? '' : 'ml-auto'}>
                    <Button onClick={() => setCardModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                      <PlusCircle className="h-5 w-5" />
                      Novo Cartão
                    </Button>
                  </div>
                </div>

                {selectedCardId && selectedCard ? (
                  /* ─── Invoice View ─── */
                  <div className="space-y-5">
                    {/* Card header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selectedCard.name}</h2>
                        <p className="text-sm text-muted-foreground">Limite: {formatCurrency(selectedCard.limit_amount)}</p>
                      </div>
                    </div>

                    {/* Month Navigator */}
                    <Card className="rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="icon" onClick={() => navigateInvoiceMonth(-1)} className="rounded-xl">
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <div className="text-center">
                            <p className="text-lg font-bold">{formatMonthLabel(invoiceMonth)}</p>
                            <p className="text-xs text-muted-foreground">Fatura</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => navigateInvoiceMonth(1)} className="rounded-xl">
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Invoice Summary */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card className="rounded-2xl">
                        <CardContent className="p-5 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                          <p className="text-2xl font-bold">{formatCurrency(invoiceTotal)}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl">
                        <CardContent className="p-5 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Transações</p>
                          <p className="text-2xl font-bold">{invoiceTransactions.length}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl">
                        <CardContent className="p-5 text-center">
                          <p className="text-sm text-muted-foreground mb-1">Status</p>
                          {(() => {
                            const status = getInvoiceStatus(selectedCard, invoiceMonth);
                            return <Badge variant={status.variant} className="text-base px-4 py-1">{status.label}</Badge>;
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Invoice Transactions */}
                    <Card className="rounded-2xl">
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
                                <div key={tx.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{tx.description}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-xs text-muted-foreground">{format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cat.label}</Badge>
                                      {tx.installments > 1 && <span className="text-[10px] text-muted-foreground">{tx.installments}x</span>}
                                    </div>
                                  </div>
                                  <span className="text-sm font-semibold shrink-0">{formatCurrency(tx.value)}</span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Desktop table view for invoice */}
                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Data</TableHead>
                                  <TableHead>Descrição</TableHead>
                                  <TableHead>Categoria</TableHead>
                                  <TableHead>Parcelas</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {invoiceTransactions.map(tx => {
                                  const cat = getCategoryInfo(tx.final_category);
                                  return (
                                    <TableRow key={tx.id}>
                                      <TableCell className="text-sm">{format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                      <TableCell className="font-medium">{tx.description}</TableCell>
                                      <TableCell><Badge variant="secondary" className="text-xs">{cat.label}</Badge></TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{tx.installments > 1 ? `${tx.installments}x` : '—'}</TableCell>
                                      <TableCell className="text-right font-semibold">{formatCurrency(tx.value)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
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
                            <Card key={card.id} className="rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedCardId(card.id)}>
                              <div className={`h-2 ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                      <CreditCard className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-semibold">{card.name}</p>
                                      <p className="text-xs text-muted-foreground">Limite: {formatCurrency(card.limit_amount)}</p>
                                    </div>
                                  </div>
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
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Fatura atual</span>
                                    <span className="font-semibold">{formatCurrency(used)}</span>
                                  </div>
                                  <Progress value={pct} className="h-2.5" />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{pct.toFixed(0)}% utilizado</span>
                                    <span>Disponível: {formatCurrency(available)}</span>
                                  </div>
                                </div>
                                <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {card.closing_strategy === 'relative'
                                      ? `Fecha ${card.closing_days_before_due}d antes`
                                      : `Fecha dia ${card.closing_day}`}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Vence dia {card.due_day}
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
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Ativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <div className="space-y-2">
                <Label>Saldo atual (R$)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0,00" value={walletForm.current_balance} onChange={e => setWalletForm(f => ({ ...f, current_balance: e.target.value }))} className="rounded-xl h-11" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetWalletForm(); setWalletModalOpen(false); }} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddWallet} disabled={walletSaving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {walletSaving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Card Modal */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do cartão</Label>
              <Input placeholder="Ex: Nubank, ActivoBank" value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="5000" value={cardForm.limit_amount} onChange={e => setCardForm(f => ({ ...f, limit_amount: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Input type="number" min="1" max="31" value={cardForm.due_day} onChange={e => setCardForm(f => ({ ...f, due_day: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Estratégia de fecho da fatura</Label>
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
                <Label>Dia de fecho (1-31)</Label>
                <Input type="number" min="1" max="31" value={cardForm.closing_day} onChange={e => setCardForm(f => ({ ...f, closing_day: e.target.value }))} className="rounded-xl h-11" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Dias antes do vencimento</Label>
                <Input type="number" min="1" max="30" placeholder="7" value={cardForm.closing_days_before_due} onChange={e => setCardForm(f => ({ ...f, closing_days_before_due: e.target.value }))} className="rounded-xl h-11" />
                <p className="text-xs text-muted-foreground">A fatura fechará {cardForm.closing_days_before_due || '7'} dias antes do dia {cardForm.due_day || '10'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddCard} disabled={cardSaving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {cardSaving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
