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
import { formatCurrency } from '@/lib/constants';
import { PlusCircle, Wallet, Landmark, TrendingUp, Bitcoin, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

// Calculated balance map (from transactions)
const walletBalanceMap = new Map<string, number>();

function getWalletValue(w: WalletRow): number {
  if (w.asset_type === 'crypto' && w.crypto_amount && w.crypto_price) {
    return w.crypto_amount * w.crypto_price;
  }
  const txBalance = walletBalanceMap.get(w.id) || 0;
  return w.initial_balance + txBalance;
}

export default function WealthPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', asset_type: 'checking_account' as string, current_balance: '',
    crypto_symbol: '', crypto_amount: '', crypto_price: '',
  });

  const fetchWallets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).order('asset_type');
    setWallets((data || []) as WalletRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const resetForm = () => setForm({ name: '', asset_type: 'checking_account', current_balance: '', crypto_symbol: '', crypto_amount: '', crypto_price: '' });

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Preencha o nome.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const isCrypto = form.asset_type === 'crypto';
    const { error } = await supabase.from('wallets').insert({
      user_id: user?.id,
      name: form.name.trim(),
      asset_type: form.asset_type,
      current_balance: isCrypto ? 0 : parseFloat(form.current_balance) || 0,
      crypto_symbol: isCrypto ? (form.crypto_symbol.trim().toUpperCase() || 'BTC') : null,
      crypto_amount: isCrypto ? parseFloat(form.crypto_amount) || 0 : null,
      crypto_price: isCrypto ? parseFloat(form.crypto_price) || 0 : null,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ativo adicionado!' });
      resetForm();
      setModalOpen(false);
      fetchWallets();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('wallets').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Ativo removido' }); fetchWallets(); }
  };

  // Grouped data
  const totalWealth = useMemo(() => wallets.reduce((s, w) => s + getWalletValue(w), 0), [wallets]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    wallets.forEach(w => {
      const t = w.asset_type;
      map[t] = (map[t] || 0) + getWalletValue(w);
    });
    return Object.entries(map).map(([type, value]) => ({ name: ASSET_LABELS[type] || type, value }));
  }, [wallets]);

  const grouped = useMemo(() => {
    const g: Record<string, WalletRow[]> = {};
    wallets.forEach(w => {
      if (!g[w.asset_type]) g[w.asset_type] = [];
      g[w.asset_type].push(w);
    });
    return g;
  }, [wallets]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Património</h1>
                <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus ativos e patrimônio líquido</p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" />
                Novo Ativo
              </Button>
            </div>

            {/* Total Net Worth */}
            <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
                  <Wallet className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Património Líquido Total</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(totalWealth)}</p>
                  <p className="text-xs opacity-60 mt-0.5">{wallets.length} ativo{wallets.length !== 1 ? 's' : ''} registrado{wallets.length !== 1 ? 's' : ''}</p>
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

            {/* Asset sections by type */}
            {loading ? (
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
                                <div className="flex items-center gap-1">
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
                                        <AlertDialogAction onClick={() => handleDelete(w.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Remover</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
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
          </main>
        </div>
      </div>

      {/* Add Wallet Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Ativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de ativo</Label>
              <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v }))}>
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
              <Input
                placeholder={form.asset_type === 'crypto' ? 'Ex: Bitcoin, Ethereum' : 'Ex: Nubank, XP'}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-xl h-11"
              />
            </div>

            {form.asset_type === 'crypto' ? (
              <>
                <div className="space-y-2">
                  <Label>Símbolo (ex: BTC, ETH)</Label>
                  <Input
                    placeholder="BTC"
                    value={form.crypto_symbol}
                    onChange={e => setForm(f => ({ ...f, crypto_symbol: e.target.value }))}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantidade de moedas</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.5"
                      value={form.crypto_amount}
                      onChange={e => setForm(f => ({ ...f, crypto_amount: e.target.value }))}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cotação atual (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="350000"
                      value={form.crypto_price}
                      onChange={e => setForm(f => ({ ...f, crypto_price: e.target.value }))}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
                {form.crypto_amount && form.crypto_price && (
                  <div className="rounded-xl bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="text-lg font-bold">{formatCurrency((parseFloat(form.crypto_amount) || 0) * (parseFloat(form.crypto_price) || 0))}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label>Saldo atual (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.current_balance}
                  onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))}
                  className="rounded-xl h-11"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setModalOpen(false); }} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
