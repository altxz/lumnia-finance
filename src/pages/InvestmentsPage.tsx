import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletsList } from '@/hooks/useStaticData';
import { useInvestments } from '@/hooks/useInvestments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlusCircle, TrendingUp, PiggyBank, Wallet, Target, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { CHART_SERIES } from '@/lib/chartPalette';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal';
import { InvestmentMovementModal } from '@/components/investments/InvestmentMovementModal';
import {
  computeStats, buildGrowthSeries, rateLabel, investmentTypeLabel,
  type Investment, type InvestmentMovement,
} from '@/lib/investmentMath';

const PIE_COLORS = CHART_SERIES;

export default function InvestmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: wallets = [] } = useWalletsList();
  const { data: investments = [], isLoading, invalidate } = useInvestments();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [movementTarget, setMovementTarget] = useState<{ inv: Investment; movements: InvestmentMovement[]; mode: 'deposit' | 'withdrawal' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const active = useMemo(() => investments.filter(i => i.inv.status === 'active'), [investments]);
  const redeemed = useMemo(() => investments.filter(i => i.inv.status === 'redeemed'), [investments]);

  const totals = useMemo(() => {
    return active.reduce(
      (acc, i) => {
        const s = computeStats(i.inv, i.movements);
        acc.invested += s.invested;
        acc.current += s.currentValue;
        acc.earnings += s.earnings;
        acc.projected += s.projectedValue;
        return acc;
      },
      { invested: 0, current: 0, earnings: 0, projected: 0 },
    );
  }, [active]);

  const growth = useMemo(() => buildGrowthSeries(active), [active]);

  const allocation = useMemo(() => {
    const map: Record<string, number> = {};
    active.forEach(i => {
      const label = investmentTypeLabel(i.inv.investment_type);
      map[label] = (map[label] || 0) + computeStats(i.inv, i.movements).currentValue;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [active]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { data: movs } = await supabase.from('investment_movements').select('expense_id').eq('investment_id', deleteTarget.id);
      const expenseIds = (movs || []).map((m: { expense_id: string | null }) => m.expense_id).filter(Boolean) as string[];
      await supabase.from('investment_movements').delete().eq('investment_id', deleteTarget.id);
      if (expenseIds.length) await supabase.from('expenses').delete().in('id', expenseIds);
      await supabase.from('investments').delete().eq('id', deleteTarget.id);
      if (deleteTarget.investment_wallet_id) {
        await supabase.from('wallets').delete().eq('id', deleteTarget.investment_wallet_id);
      }
      toast({ title: 'Investimento excluído', description: 'As transferências relacionadas também foram removidas.' });
      setDeleteTarget(null);
      invalidate();
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (authLoading) return <PageLoadingSkeleton title="Carregando investimentos" />;
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
              title="Investimentos"
              description="Aplicações, rendimentos e projeções de vencimento."
              actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2 rounded-full h-11 px-5 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" />
                Novo investimento
              </Button>}
            />

            {/* Resumo */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon={PiggyBank} label="Total aportado" value={totals.invested} />
              <SummaryCard icon={Wallet} label="Valor atual" value={totals.current} highlight />
              <SummaryCard icon={TrendingUp} label="Rendimento" value={totals.earnings} positive />
              <SummaryCard icon={Target} label="No vencimento" value={totals.projected} />
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[300px] rounded-2xl" />
                <Skeleton className="h-[200px] rounded-2xl" />
              </div>
            ) : investments.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum investimento cadastrado</p>
                  <p className="text-sm mt-1">Crie uma caixinha e acompanhe o rendimento automaticamente.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Gráficos */}
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="rounded-2xl lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Evolução do patrimônio investido</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={growth}>
                          <defs>
                            <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n === 'value' ? 'Valor com juros' : 'Aportado']} />
                          <Area type="monotone" dataKey="invested" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="none" name="invested" />
                          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#invGrad)" name="value" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Distribuição por tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                            {allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Meus investimentos</h2>
                  {active.map(({ inv, movements }) => {
                    const s = computeStats(inv, movements);
                    const totalDays = inv.maturity_date
                      ? Math.max(1, differenceInCalendarDays(parseISO(inv.maturity_date), parseISO(inv.start_date)))
                      : null;
                    const elapsed = totalDays ? Math.min(100, Math.max(0, ((totalDays - (s.daysRemaining ?? 0)) / totalDays) * 100)) : null;
                    const wallet = wallets.find((w: { id: string }) => w.id === inv.wallet_id) as { name?: string } | undefined;
                    return (
                      <Card key={inv.id} className="rounded-2xl">
                        <CardContent className="p-4 sm:p-5 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold truncate">{inv.name}</p>
                                <Badge variant="secondary" className="text-[10px]">{investmentTypeLabel(inv.investment_type)}</Badge>
                                {s.daysRemaining !== null && s.daysRemaining <= 0 && <Badge className="text-[10px]">Vencido</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{rateLabel(inv)} · {s.annualRate.toFixed(2)}% a.a.</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Início {format(parseISO(inv.start_date), 'dd/MM/yyyy')}
                                {inv.maturity_date ? ` · Vence ${format(parseISO(inv.maturity_date), 'dd/MM/yyyy')}` : ' · Liquidez diária'}
                                {wallet?.name ? ` · Origem: ${wallet.name}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => setMovementTarget({ inv, movements, mode: 'deposit' })} title="Novo aporte">
                                <ArrowDownToLine className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => setMovementTarget({ inv, movements, mode: 'withdrawal' })} title="Resgatar">
                                <ArrowUpFromLine className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => { setEditing(inv); setFormOpen(true); }} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="rounded-xl text-destructive" onClick={() => setDeleteTarget(inv)} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Metric label="Aportado" value={formatCurrency(s.invested)} />
                            <Metric label="Valor atual" value={formatCurrency(s.currentValue)} strong />
                            <Metric label="Rendimento" value={`${formatCurrency(s.earnings)} (${s.earningsPct.toFixed(2)}%)`} accent />
                            <Metric label="No vencimento" value={formatCurrency(s.projectedValue)} />
                          </div>

                          {elapsed !== null && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Prazo decorrido</span>
                                <span>{s.daysRemaining! > 0 ? `${s.daysRemaining} dias restantes` : 'Prazo concluído'}</span>
                              </div>
                              <Progress value={elapsed} className="h-2" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {redeemed.length > 0 && (
                    <>
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Resgatados</h2>
                      {redeemed.map(({ inv, movements }) => {
                        const withdrawn = movements.filter(m => m.kind === 'withdrawal').reduce((s, m) => s + m.amount, 0);
                        const deposited = movements.filter(m => m.kind === 'deposit').reduce((s, m) => s + m.amount, 0);
                        return (
                          <Card key={inv.id} className="rounded-2xl opacity-80">
                            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{inv.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Aportado {formatCurrency(deposited)} · Resgatado {formatCurrency(withdrawn)}
                                </p>
                              </div>
                              <Button size="icon" variant="ghost" className="rounded-xl text-destructive" onClick={() => setDeleteTarget(inv)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <InvestmentFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        wallets={wallets as { id: string; name: string; asset_type: string }[]}
        investment={editing}
        onSaved={invalidate}
      />

      {movementTarget && (
        <InvestmentMovementModal
          open={!!movementTarget}
          onOpenChange={v => !v && setMovementTarget(null)}
          mode={movementTarget.mode}
          investment={movementTarget.inv}
          movements={movementTarget.movements}
          wallets={wallets as { id: string; name: string; asset_type: string }[]}
          onSaved={invalidate}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir investimento?</AlertDialogTitle>
            <AlertDialogDescription>
              As transferências de aporte e resgate deste investimento também serão removidas do seu extrato. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function SummaryCard({ icon: Icon, label, value, highlight, positive }: { icon: typeof Wallet; label: string; value: number; highlight?: boolean; positive?: boolean }) {
  return (
    <Card className={`rounded-2xl border-0 shadow-soft ${highlight ? 'gradient-primary text-primary-foreground' : ''}`}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${highlight ? 'opacity-80' : 'text-muted-foreground'}`} />
          <p className={`text-xs font-medium ${highlight ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
        </div>
        <p className={`text-lg sm:text-xl font-bold tracking-tight ${!highlight && positive ? 'text-accent' : ''}`}>{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm ${strong ? 'font-bold' : 'font-semibold'} ${accent ? 'text-accent' : ''}`}>{value}</p>
    </div>
  );
}
