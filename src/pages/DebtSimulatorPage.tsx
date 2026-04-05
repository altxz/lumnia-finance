import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { InfoPopover } from '@/components/ui/info-popover';
import { Plus, Trash2, TrendingDown, Snowflake, Flame, Calculator, DollarSign, Calendar, ArrowDown, Trophy } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, Legend } from 'recharts';

interface SimDebt {
  id: string;
  name: string;
  balance: number;
  interestRate: number; // monthly %
  minimumPayment: number;
}

interface PayoffStep {
  month: number;
  label: string;
  totalBalance: number;
  totalPaid: number;
  totalInterest: number;
  debts: Record<string, number>;
}

function simulatePayoff(debts: SimDebt[], extraPayment: number, method: 'avalanche' | 'snowball'): PayoffStep[] {
  if (debts.length === 0) return [];
  
  // Deep copy
  let balances = Object.fromEntries(debts.map(d => [d.id, d.balance]));
  const steps: PayoffStep[] = [];
  let month = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  const maxMonths = 600; // 50 years safety

  // Initial state
  steps.push({
    month: 0,
    label: 'Início',
    totalBalance: debts.reduce((s, d) => s + d.balance, 0),
    totalPaid: 0,
    totalInterest: 0,
    debts: { ...balances },
  });

  while (month < maxMonths) {
    const totalBalance = Object.values(balances).reduce((s, v) => s + v, 0);
    if (totalBalance <= 0.01) break;

    month++;

    // Apply interest
    for (const d of debts) {
      if (balances[d.id] > 0) {
        const interest = balances[d.id] * (d.interestRate / 100);
        balances[d.id] += interest;
        totalInterest += interest;
      }
    }

    // Pay minimums
    let availableExtra = extraPayment;
    for (const d of debts) {
      if (balances[d.id] > 0) {
        const payment = Math.min(d.minimumPayment, balances[d.id]);
        balances[d.id] -= payment;
        totalPaid += payment;
      }
    }

    // Sort for extra payment priority
    const activeDebts = debts.filter(d => balances[d.id] > 0.01);
    if (method === 'avalanche') {
      activeDebts.sort((a, b) => b.interestRate - a.interestRate); // highest rate first
    } else {
      activeDebts.sort((a, b) => balances[a.id] - balances[b.id]); // smallest balance first
    }

    // Apply extra payment
    for (const d of activeDebts) {
      if (availableExtra <= 0) break;
      const payment = Math.min(availableExtra, balances[d.id]);
      balances[d.id] -= payment;
      totalPaid += payment;
      availableExtra -= payment;
    }

    const newTotal = Object.values(balances).reduce((s, v) => s + Math.max(0, v), 0);
    
    steps.push({
      month,
      label: `Mês ${month}`,
      totalBalance: Math.max(0, newTotal),
      totalPaid,
      totalInterest,
      debts: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, Math.max(0, v)])),
    });

    if (newTotal <= 0.01) break;
  }

  return steps;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function DebtSimulatorPage() {
  const { user, loading: authLoading } = useAuth();
  const [debts, setDebts] = useState<SimDebt[]>([]);
  const [extraPayment, setExtraPayment] = useState(200);
  const [loadingDebts, setLoadingDebts] = useState(true);

  // Load existing debts from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingDebts(true);
      const { data } = await supabase
        .from('debts')
        .select('id, person_name, remaining_amount, total_amount')
        .eq('user_id', user.id)
        .eq('type', 'i_owe');
      
      if (data && data.length > 0) {
        setDebts(data.map(d => ({
          id: d.id,
          name: d.person_name,
          balance: d.remaining_amount,
          interestRate: 2, // default 2% monthly
          minimumPayment: Math.max(50, d.remaining_amount * 0.05),
        })));
      }
      setLoadingDebts(false);
    })();
  }, [user]);

  const addDebt = useCallback(() => {
    setDebts(prev => [...prev, {
      id: crypto.randomUUID(),
      name: `Dívida ${prev.length + 1}`,
      balance: 1000,
      interestRate: 2,
      minimumPayment: 50,
    }]);
  }, []);

  const removeDebt = useCallback((id: string) => {
    setDebts(prev => prev.filter(d => d.id !== id));
  }, []);

  const updateDebt = useCallback((id: string, field: keyof SimDebt, value: string | number) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  }, []);

  const avalancheSteps = useMemo(() => simulatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment]);
  const snowballSteps = useMemo(() => simulatePayoff(debts, extraPayment, 'snowball'), [debts, extraPayment]);

  const comparison = useMemo(() => {
    const avLast = avalancheSteps[avalancheSteps.length - 1];
    const snLast = snowballSteps[snowballSteps.length - 1];
    if (!avLast || !snLast) return null;
    return {
      avalancheMonths: avLast.month,
      snowballMonths: snLast.month,
      avalancheInterest: avLast.totalInterest,
      snowballInterest: snLast.totalInterest,
      savedInterest: snLast.totalInterest - avLast.totalInterest,
      savedMonths: snLast.month - avLast.month,
    };
  }, [avalancheSteps, snowballSteps]);

  // Merge data for comparison chart
  const comparisonChart = useMemo(() => {
    const maxLen = Math.max(avalancheSteps.length, snowballSteps.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        month: i,
        label: `Mês ${i}`,
        avalanche: avalancheSteps[i]?.totalBalance ?? 0,
        snowball: snowballSteps[i]?.totalBalance ?? 0,
      });
    }
    return data;
  }, [avalancheSteps, snowballSteps]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-primary" />
                  Simulador de Quitação
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Compare os métodos Avalanche e Bola de Neve para eliminar suas dívidas
                </p>
              </div>
              <Button onClick={addDebt} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar Dívida
              </Button>
            </div>

            {loadingDebts ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
              </div>
            ) : (
              <>
                {/* Debt Cards */}
                {debts.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground font-medium">Nenhuma dívida cadastrada</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Adicione suas dívidas para simular a quitação</p>
                      <Button onClick={addDebt} variant="outline" size="sm" className="mt-4 gap-1.5">
                        <Plus className="h-4 w-4" /> Adicionar Dívida
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                      {debts.map((debt) => (
                        <Card key={debt.id} className="relative group">
                          <CardContent className="pt-5 pb-4 px-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <Input
                                value={debt.name}
                                onChange={e => updateDebt(debt.id, 'name', e.target.value)}
                                className="text-sm font-semibold h-8 border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => removeDebt(debt.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Saldo (R$)</Label>
                                <Input
                                  type="number"
                                  value={debt.balance}
                                  onChange={e => updateDebt(debt.id, 'balance', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Juros (%/mês)</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={debt.interestRate}
                                  onChange={e => updateDebt(debt.id, 'interestRate', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Mín. (R$)</Label>
                                <Input
                                  type="number"
                                  value={debt.minimumPayment}
                                  onChange={e => updateDebt(debt.id, 'minimumPayment', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Extra payment input */}
                    <Card>
                      <CardContent className="py-4 px-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium whitespace-nowrap">Pagamento extra mensal:</Label>
                        </div>
                        <Input
                          type="number"
                          value={extraPayment}
                          onChange={e => setExtraPayment(parseFloat(e.target.value) || 0)}
                          className="h-9 w-full sm:w-40"
                          placeholder="R$ 200"
                        />
                        <InfoPopover>Valor adicional que você pode pagar por mês além do mínimo de cada dívida. Será direcionado à dívida prioritária de acordo com o método escolhido.</InfoPopover>
                      </CardContent>
                    </Card>

                    {/* Comparison Summary */}
                    {comparison && debts.length > 0 && (
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                          <CardContent className="py-4 px-4 text-center">
                            <Flame className="h-5 w-5 mx-auto text-primary mb-1" />
                            <p className="text-[11px] text-muted-foreground">Avalanche</p>
                            <p className="text-lg font-bold text-foreground">{comparison.avalancheMonths} meses</p>
                            <p className="text-[10px] text-muted-foreground">Juros: {fmt(comparison.avalancheInterest)}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                          <CardContent className="py-4 px-4 text-center">
                            <Snowflake className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                            <p className="text-[11px] text-muted-foreground">Bola de Neve</p>
                            <p className="text-lg font-bold text-foreground">{comparison.snowballMonths} meses</p>
                            <p className="text-[10px] text-muted-foreground">Juros: {fmt(comparison.snowballInterest)}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                          <CardContent className="py-4 px-4 text-center">
                            <TrendingDown className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                            <p className="text-[11px] text-muted-foreground">Economia (Avalanche)</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {comparison.savedInterest > 0 ? fmt(comparison.savedInterest) : 'Igual'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {comparison.savedMonths > 0 ? `${comparison.savedMonths} meses antes` : 'Mesmo prazo'}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                          <CardContent className="py-4 px-4 text-center">
                            <Trophy className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                            <p className="text-[11px] text-muted-foreground">Melhor Método</p>
                            <p className="text-lg font-bold text-foreground">
                              {comparison.avalancheInterest <= comparison.snowballInterest ? 'Avalanche' : 'Bola de Neve'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Menor custo total</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Charts */}
                    {debts.length > 0 && comparisonChart.length > 1 && (
                      <Tabs defaultValue="comparison" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="comparison" className="text-xs sm:text-sm">Comparativo</TabsTrigger>
                          <TabsTrigger value="avalanche" className="text-xs sm:text-sm">
                            <Flame className="h-3.5 w-3.5 mr-1 hidden sm:inline" /> Avalanche
                          </TabsTrigger>
                          <TabsTrigger value="snowball" className="text-xs sm:text-sm">
                            <Snowflake className="h-3.5 w-3.5 mr-1 hidden sm:inline" /> Bola de Neve
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="comparison">
                          <Card className="h-full flex flex-col">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                Saldo Total ao Longo do Tempo
                                <InfoPopover>Comparação do saldo devedor total usando cada método. Avalanche prioriza juros altos; Bola de Neve prioriza saldos pequenos.</InfoPopover>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 min-h-[300px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={comparisonChart}>
                                  <defs>
                                    <linearGradient id="gradAvalanche" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradSnowball" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                                  <Tooltip
                                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                                    formatter={(v: number, name: string) => [fmt(v), name === 'avalanche' ? 'Avalanche' : 'Bola de Neve']}
                                  />
                                  <Legend formatter={(v) => v === 'avalanche' ? 'Avalanche' : 'Bola de Neve'} />
                                  <Area type="monotone" dataKey="avalanche" stroke="hsl(var(--primary))" fill="url(#gradAvalanche)" strokeWidth={2} />
                                  <Area type="monotone" dataKey="snowball" stroke="#3b82f6" fill="url(#gradSnowball)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="avalanche">
                          <MethodDetail steps={avalancheSteps} debts={debts} method="avalanche" />
                        </TabsContent>

                        <TabsContent value="snowball">
                          <MethodDetail steps={snowballSteps} debts={debts} method="snowball" />
                        </TabsContent>
                      </Tabs>
                    )}

                    {/* Method Explanation */}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Flame className="h-4 w-4 text-primary" /> Método Avalanche
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-2">
                          <p>Prioriza o pagamento da dívida com <strong className="text-foreground">maior taxa de juros</strong> primeiro.</p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Matematicamente mais eficiente</li>
                            <li>Menor custo total de juros</li>
                            <li>Pode demorar mais para quitar a primeira dívida</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Snowflake className="h-4 w-4 text-blue-500" /> Método Bola de Neve
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-2">
                          <p>Prioriza o pagamento da dívida com <strong className="text-foreground">menor saldo</strong> primeiro.</p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Motivação psicológica — vitórias rápidas</li>
                            <li>Elimina dívidas menores rapidamente</li>
                            <li>Pode custar mais em juros no total</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function MethodDetail({ steps, debts, method }: { steps: PayoffStep[]; debts: SimDebt[]; method: 'avalanche' | 'snowball' }) {
  const last = steps[steps.length - 1];
  if (!last) return null;

  // Per-debt payoff order
  const payoffOrder = useMemo(() => {
    const order: { name: string; month: number }[] = [];
    for (const d of debts) {
      for (let i = 1; i < steps.length; i++) {
        if ((steps[i].debts[d.id] ?? 0) <= 0.01 && (steps[i - 1].debts[d.id] ?? 0) > 0.01) {
          order.push({ name: d.name, month: steps[i].month });
          break;
        }
      }
    }
    return order.sort((a, b) => a.month - b.month);
  }, [steps, debts]);

  return (
    <div className="space-y-4">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {method === 'avalanche' ? <Flame className="h-4 w-4 text-primary" /> : <Snowflake className="h-4 w-4 text-blue-500" />}
            Evolução do Saldo — {method === 'avalanche' ? 'Avalanche' : 'Bola de Neve'}
          </CardTitle>
          <CardDescription className="text-xs">
            Conclusão em <strong>{last.month} meses</strong> · Juros totais: <strong>{fmt(last.totalInterest)}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={steps}>
              <defs>
                <linearGradient id={`grad-${method}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={method === 'avalanche' ? 'hsl(var(--primary))' : '#3b82f6'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={method === 'avalanche' ? 'hsl(var(--primary))' : '#3b82f6'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                formatter={(v: number) => [fmt(v), 'Saldo']}
              />
              <Area type="monotone" dataKey="totalBalance" stroke={method === 'avalanche' ? 'hsl(var(--primary))' : '#3b82f6'} fill={`url(#grad-${method})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payoff timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Ordem de Quitação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payoffOrder.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="tabular-nums shrink-0">Mês {item.month}</Badge>
                <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">{item.name}</span>
                {i === 0 && <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">1ª quitação</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
