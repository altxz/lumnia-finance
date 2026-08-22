import { useState, useEffect, useMemo, useCallback } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { isInvoicePayment } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { InfoPopover } from '@/components/ui/info-popover';
import {
  Activity, TrendingUp, PiggyBank, CreditCard, Target, BarChart3,
  RefreshCw, Wallet, ArrowUp, ArrowDown, Lightbulb,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
} from 'recharts';
import {
  computeFinancialScore, getScoreColor, type ScoreDimensionKey,
} from '@/lib/financialScore';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const DIMENSION_ICONS: Record<ScoreDimensionKey, React.ReactNode> = {
  savings: <PiggyBank className="h-4 w-4" />,
  budget: <Target className="h-4 w-4" />,
  debtCredit: <CreditCard className="h-4 w-4" />,
  reserve: <Wallet className="h-4 w-4" />,
  consistency: <BarChart3 className="h-4 w-4" />,
};

interface ScoreHistory {
  month_year: string;
  overall_score: number;
  savings_score: number;
  budget_score: number;
  debt_score: number;
  consistency_score: number;
  credit_score: number;
  total_income: number;
  total_expense: number;
}

interface ScoreData {
  totalIncome: number;
  totalExpense: number;
  budgets: { category: string; allocated: number; spent: number }[];
  committedAmount: number;
  creditUsageRatio: number;
  hasOverdueInvoice: boolean;
  liquidReserve: number;
  previousExpenses: number[];
}

const EMPTY: ScoreData = {
  totalIncome: 0, totalExpense: 0, budgets: [], committedAmount: 0,
  creditUsageRatio: 0, hasOverdueInvoice: false, liquidReserve: 0, previousExpenses: [],
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function FinancialScorePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [data, setData] = useState<ScoreData>(EMPTY);

  const now = new Date();
  const currentMonth = monthKey(now);
  const nextMonthStr = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const threeAgoStr = monthKey(new Date(now.getFullYear(), now.getMonth() - 3, 1));

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        { data: currExp },
        { data: histExp },
        { data: budgetData },
        { data: cards },
        { data: wallets },
        { data: investments },
        { data: scoreHistory },
      ] = await Promise.all([
        supabase.from('expenses')
          .select('value, type, credit_card_id, installment_group_id, debt_id, final_category, description')
          .eq('user_id', user.id).gte('date', currentMonth).lt('date', nextMonthStr),
        supabase.from('expenses').select('value, type, date, final_category, description')
          .eq('user_id', user.id).gte('date', threeAgoStr).lt('date', currentMonth),
        supabase.from('budgets').select('allocated_amount, category')
          .eq('user_id', user.id).eq('month_year', currentMonth),
        supabase.from('credit_cards').select('id, due_day, limit_amount').eq('user_id', user.id),
        supabase.from('wallets').select('current_balance, asset_type').eq('user_id', user.id),
        supabase.from('investments').select('principal, status').eq('user_id', user.id),
        supabase.from('financial_scores').select('*')
          .eq('user_id', user.id).order('month_year', { ascending: true }).limit(12),
      ]);

      const relevant = (currExp || []).filter(
        (e: any) => e.type !== 'transfer' && !isBalanceAdjustment(e) && !isInvoicePayment(e)
      );
      const totalIncome = relevant.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + Number(e.value), 0);
      const outflows = relevant.filter((e: any) => e.type !== 'income');
      const totalExpense = outflows.reduce((s: number, e: any) => s + Number(e.value), 0);

      const spent: Record<string, number> = {};
      let ccExpenses = 0;
      let committed = 0;
      outflows.forEach((e: any) => {
        spent[e.final_category] = (spent[e.final_category] || 0) + Number(e.value);
        if (e.credit_card_id) { ccExpenses += Number(e.value); committed += Number(e.value); }
        else if (e.installment_group_id) committed += Number(e.value);
        if (e.debt_id) committed += Number(e.value);
      });

      const buckets: Record<string, number> = {};
      (histExp || []).forEach((e: any) => {
        if (e.type === 'income' || e.type === 'transfer') return;
        if (isBalanceAdjustment(e) || isInvoicePayment(e)) return;
        const k = e.date.slice(0, 7);
        buckets[k] = (buckets[k] || 0) + Number(e.value);
      });
      const previousExpenses = Object.keys(buckets).sort().reverse().map(k => buckets[k]);

      const totalLimit = (cards || []).reduce((s: number, c: any) => s + Number(c.limit_amount || 0), 0);
      const today = now.getDate();

      const liquid = (wallets || [])
        .filter((w: any) => w.asset_type !== 'crypto')
        .reduce((s: number, w: any) => s + Number(w.current_balance || 0), 0);
      const invested = (investments || [])
        .filter((i: any) => i.status === 'active')
        .reduce((s: number, i: any) => s + Number(i.principal || 0), 0);

      setData({
        totalIncome,
        totalExpense,
        budgets: (budgetData || []).map((b: any) => ({
          category: b.category,
          allocated: Number(b.allocated_amount || 0),
          spent: spent[b.category] || 0,
        })),
        committedAmount: committed,
        creditUsageRatio: totalLimit > 0 ? ccExpenses / totalLimit : 0,
        hasOverdueInvoice: (cards || []).some((c: any) => c.due_day < today) && ccExpenses > 0,
        liquidReserve: liquid + invested,
        previousExpenses,
      });

      setHistory((scoreHistory || []) as ScoreHistory[]);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, nextMonthStr, threeAgoStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const result = useMemo(() => computeFinancialScore(data), [data]);

  const saveScore = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('financial_scores').upsert({
        user_id: user.id,
        month_year: currentMonth,
        overall_score: result.overall,
        ...result.persisted,
        total_income: data.totalIncome,
        total_expense: data.totalExpense,
      }, { onConflict: 'user_id,month_year' });
      if (!error) await fetchData();
    } finally {
      setSaving(false);
    }
  }, [user, currentMonth, result, data, fetchData]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return history.map(h => {
      const d = new Date(h.month_year);
      return {
        label: `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        score: h.overall_score,
        savings: h.savings_score,
        budget: h.budget_score,
      };
    });
  }, [history]);

  const radarData = useMemo(
    () => result.dimensions.map(d => ({ subject: `${d.label} ${d.score ?? '—'}`, score: d.score ?? 0, fullMark: 100 })),
    [result]
  );

  const prevScore = history.filter(h => h.month_year < currentMonth).slice(-1)[0] || null;
  const scoreDiff = prevScore ? result.overall - prevScore.overall_score : null;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const color = getScoreColor(result.overall);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.overall / 100) * circumference;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-6 w-6 text-primary" />
                  Score Financeiro
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Cinco dimensões, cada uma com o número real que sustenta a nota
                </p>
              </div>
              <Button onClick={saveScore} disabled={saving || loading} size="sm" variant="outline" className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Recalculando...' : 'Recalcular agora'}
              </Button>
            </div>

            {loading ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                  <Card className="lg:col-span-1">
                    <CardContent className="pt-6 flex flex-col items-center gap-4">
                      <div className="relative w-40 h-40">
                        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                          <circle
                            cx="70" cy="70" r={radius} fill="none"
                            stroke={color}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold" style={{ color }}>{result.overall}</span>
                          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-lg font-semibold" style={{ color }}>
                          {result.emoji} {result.label}
                        </p>
                        {scoreDiff !== null && (
                          <div className="flex items-center justify-center gap-1 text-sm">
                            {scoreDiff > 0 ? (
                              <><ArrowUp className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-500 font-medium">+{scoreDiff} pts</span></>
                            ) : scoreDiff < 0 ? (
                              <><ArrowDown className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive font-medium">{scoreDiff} pts</span></>
                            ) : (
                              <span className="text-muted-foreground">Sem alteração</span>
                            )}
                            <span className="text-muted-foreground text-xs">vs mês anterior</span>
                          </div>
                        )}
                      </div>
                      <p className="w-full text-xs text-center text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                        {result.headline}
                      </p>
                      <p className="text-[11px] text-center text-muted-foreground">
                        Receita: {fmt(data.totalIncome)} · Despesa: {fmt(data.totalExpense)}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-2 flex flex-col gap-4">
                    {result.nextStep && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="py-4 flex items-start gap-3">
                          <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Próximo passo · {result.nextStep.label} (+{result.nextStep.potentialGain} pts no score)
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">{result.nextStep.action}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="flex-1 flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          Perfil Financeiro
                          <InfoPopover>Visão geral das cinco dimensões. Quanto maior a área, melhor a saúde financeira.</InfoPopover>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <Radar
                              name="Score"
                              dataKey="score"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalhamento por Dimensão</h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                  {result.dimensions.map(d => {
                    const sColor = d.score === null ? 'hsl(var(--muted-foreground))' : getScoreColor(d.score);
                    return (
                      <Card key={d.key}>
                        <CardContent className="pt-4 pb-3 px-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <span style={{ color: sColor }}>{DIMENSION_ICONS[d.key]}</span>
                              {d.label}
                            </div>
                            <InfoPopover>{d.tip}</InfoPopover>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold" style={{ color: sColor }}>
                              {d.score === null ? '—' : d.score}
                            </span>
                            <span className="text-xs text-muted-foreground mb-1">
                              {d.score === null ? 'não avaliada' : `/ 100 · peso ${Math.round(d.weight * 100)}%`}
                            </span>
                          </div>
                          <Progress value={d.score ?? 0} className="h-1.5" />
                          <p className="text-[11px] text-foreground/80">{d.detail}</p>
                          <p className="text-[10px] text-muted-foreground">{d.action}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {chartData.length > 1 ? (
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Evolução do Score
                        <InfoPopover>Histórico mensal do score. O snapshot do mês é gravado automaticamente.</InfoPopover>
                      </CardTitle>
                      <CardDescription className="text-xs">Últimos {chartData.length} meses registrados</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.06 }}
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                            formatter={(v: number, name: string) => {
                              const labels: Record<string, string> = { score: 'Geral', savings: 'Poupança', budget: 'Orçamento' };
                              return [v, labels[name] || name];
                            }}
                          />
                          <Legend formatter={(v) => {
                            const labels: Record<string, string> = { score: 'Geral', savings: 'Poupança', budget: 'Orçamento' };
                            return labels[v] || v;
                          }} />
                          <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#gradScore)" strokeWidth={2.5} />
                          <Area type="monotone" dataKey="savings" stroke="hsl(var(--success))" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                          <Area type="monotone" dataKey="budget" stroke="hsl(var(--accent))" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                      <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground font-medium">Histórico de evolução</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        A partir do segundo mês registrado, a evolução do score aparece aqui.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      💡 O que melhora o seu score agora
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {result.dimensions.filter(d => d.evaluated && (d.score ?? 0) < 75).map(d => (
                        <div key={d.key} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-muted/50">
                          <span className="shrink-0 mt-0.5" style={{ color: getScoreColor(d.score ?? 0) }}>
                            {DIMENSION_ICONS[d.key]}
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{d.label}: {d.score}/100 · {d.detail}</p>
                            <p className="text-muted-foreground mt-0.5">{d.action}</p>
                          </div>
                        </div>
                      ))}
                      {result.dimensions.filter(d => d.evaluated && (d.score ?? 0) < 75).length === 0 && (
                        <p className="text-sm text-muted-foreground col-span-2 text-center py-2">
                          🎉 Todas as dimensões avaliadas estão acima de 75. Continue assim!
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
