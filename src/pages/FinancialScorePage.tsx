import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { InfoPopover } from '@/components/ui/info-popover';
import {
  Activity, TrendingUp, TrendingDown, PiggyBank, CreditCard,
  Target, BarChart3, RefreshCw, Shield, Wallet, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Legend
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getScoreColor(score: number): string {
  if (score >= 80) return 'hsl(142, 71%, 45%)';
  if (score >= 60) return 'hsl(45, 93%, 47%)';
  if (score >= 40) return 'hsl(25, 95%, 53%)';
  return 'hsl(0, 72%, 51%)';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Muito Bom';
  if (score >= 70) return 'Bom';
  if (score >= 60) return 'Regular';
  if (score >= 40) return 'Atenção';
  return 'Crítico';
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '🏆';
  if (score >= 60) return '👍';
  if (score >= 40) return '⚠️';
  return '🚨';
}

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

interface SubScore {
  key: string;
  label: string;
  score: number;
  icon: React.ReactNode;
  description: string;
  tip: string;
}

function calculateScores(
  totalIncome: number,
  totalExpense: number,
  totalBudget: number,
  totalSpentInBudget: number,
  hasOverdueCards: boolean,
  debtCount: number,
  prevIncome: number,
  prevExpense: number,
  ccUsageRatio: number,
): { overall: number; sub: SubScore[] } {
  // 1. Savings (0-100): how much you save
  let savingsScore = 0;
  if (totalIncome > 0) {
    const savingsRate = (totalIncome - totalExpense) / totalIncome;
    if (savingsRate >= 0.3) savingsScore = 100;
    else if (savingsRate >= 0.2) savingsScore = 85;
    else if (savingsRate >= 0.1) savingsScore = 70;
    else if (savingsRate >= 0) savingsScore = 50;
    else if (savingsRate >= -0.1) savingsScore = 30;
    else savingsScore = 10;
  }

  // 2. Budget adherence (0-100)
  let budgetScore = 75; // default if no budget
  if (totalBudget > 0) {
    const ratio = totalSpentInBudget / totalBudget;
    if (ratio <= 0.8) budgetScore = 100;
    else if (ratio <= 0.95) budgetScore = 85;
    else if (ratio <= 1) budgetScore = 70;
    else if (ratio <= 1.1) budgetScore = 50;
    else budgetScore = 20;
  }

  // 3. Debt health (0-100)
  let debtScore = 100;
  if (debtCount > 0) debtScore -= debtCount * 10;
  if (hasOverdueCards) debtScore -= 20;
  debtScore = Math.max(0, Math.min(100, debtScore));

  // 4. Consistency (0-100): month-over-month spending stability
  let consistencyScore = 70;
  if (prevExpense > 0 && totalExpense > 0) {
    const variation = Math.abs(totalExpense - prevExpense) / prevExpense;
    if (variation <= 0.05) consistencyScore = 100;
    else if (variation <= 0.15) consistencyScore = 85;
    else if (variation <= 0.3) consistencyScore = 65;
    else consistencyScore = 40;
  }

  // 5. Credit health (0-100)
  let creditScore = 100;
  if (ccUsageRatio > 0.9) creditScore = 20;
  else if (ccUsageRatio > 0.7) creditScore = 50;
  else if (ccUsageRatio > 0.5) creditScore = 70;
  else if (ccUsageRatio > 0.3) creditScore = 85;
  if (hasOverdueCards) creditScore = Math.min(creditScore, 30);

  const weights = { savings: 0.30, budget: 0.20, debt: 0.20, consistency: 0.15, credit: 0.15 };
  const overall = Math.round(
    savingsScore * weights.savings +
    budgetScore * weights.budget +
    debtScore * weights.debt +
    consistencyScore * weights.consistency +
    creditScore * weights.credit
  );

  const sub: SubScore[] = [
    {
      key: 'savings', label: 'Poupança', score: savingsScore,
      icon: <PiggyBank className="h-4 w-4" />,
      description: savingsScore >= 70 ? 'Boa taxa de poupança' : 'Tente poupar mais',
      tip: 'Baseado na porcentagem da renda que você economiza. Meta ideal: 20%+.',
    },
    {
      key: 'budget', label: 'Orçamento', score: budgetScore,
      icon: <Target className="h-4 w-4" />,
      description: budgetScore >= 70 ? 'Dentro do orçamento' : 'Gastos acima do planejado',
      tip: 'Avalia se você está dentro dos limites de orçamento definidos.',
    },
    {
      key: 'debt', label: 'Dívidas', score: debtScore,
      icon: <Shield className="h-4 w-4" />,
      description: debtScore >= 80 ? 'Dívidas sob controle' : 'Muitas dívidas ativas',
      tip: 'Considera o número de dívidas ativas e faturas vencidas.',
    },
    {
      key: 'consistency', label: 'Consistência', score: consistencyScore,
      icon: <BarChart3 className="h-4 w-4" />,
      description: consistencyScore >= 70 ? 'Gastos estáveis' : 'Gastos instáveis',
      tip: 'Mede a estabilidade dos seus gastos em relação ao mês anterior.',
    },
    {
      key: 'credit', label: 'Crédito', score: creditScore,
      icon: <CreditCard className="h-4 w-4" />,
      description: creditScore >= 70 ? 'Uso saudável do crédito' : 'Alto uso de crédito',
      tip: 'Baseado na utilização do limite de crédito. Ideal: abaixo de 30%.',
    },
  ];

  return { overall, sub };
}

export default function FinancialScorePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ScoreHistory[]>([]);

  // Current month data
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpentInBudget, setTotalSpentInBudget] = useState(0);
  const [hasOverdueCards, setHasOverdueCards] = useState(false);
  const [debtCount, setDebtCount] = useState(0);
  const [prevIncome, setPrevIncome] = useState(0);
  const [prevExpense, setPrevExpense] = useState(0);
  const [ccUsageRatio, setCcUsageRatio] = useState(0);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const prevPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevPrevStr = `${prevPrevMonth.getFullYear()}-${String(prevPrevMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        { data: currExp },
        { data: prevExp },
        { data: budgetData },
        { data: cards },
        { data: debts },
        { data: scoreHistory },
      ] = await Promise.all([
        supabase.from('expenses').select('value, type, credit_card_id, final_category')
          .eq('user_id', user.id).gte('date', currentMonth).lt('date', nextMonthStr),
        supabase.from('expenses').select('value, type')
          .eq('user_id', user.id).gte('date', prevMonthStr).lt('date', currentMonth),
        supabase.from('budgets').select('allocated_amount, category')
          .eq('user_id', user.id).eq('month_year', currentMonth),
        supabase.from('credit_cards').select('id, due_day, limit_amount')
          .eq('user_id', user.id),
        supabase.from('debts').select('id')
          .eq('user_id', user.id).eq('type', 'i_owe'),
        supabase.from('financial_scores').select('*')
          .eq('user_id', user.id).order('month_year', { ascending: true }).limit(12),
      ]);

      // Current month
      const expenses = (currExp || []).filter((e: any) => e.type !== 'transfer');
      const inc = expenses.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
      const exp = expenses.filter((e: any) => e.type !== 'income').reduce((s: number, e: any) => s + e.value, 0);
      setTotalIncome(inc);
      setTotalExpense(exp);

      // Previous month
      const prevFiltered = (prevExp || []).filter((e: any) => e.type !== 'transfer');
      setPrevIncome(prevFiltered.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0));
      setPrevExpense(prevFiltered.filter((e: any) => e.type !== 'income').reduce((s: number, e: any) => s + e.value, 0));

      // Budget
      const bTotal = (budgetData || []).reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0);
      setTotalBudget(bTotal);
      const spent: Record<string, number> = {};
      expenses.forEach((e: any) => {
        if (e.type !== 'income' && !e.description?.startsWith('Pagamento fatura')) spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
      });
      const budgetSpent = (budgetData || []).reduce((s: number, b: any) => s + (spent[b.category] || 0), 0);
      setTotalSpentInBudget(budgetSpent);

      // Cards
      const today = now.getDate();
      setHasOverdueCards((cards || []).some((c: any) => c.due_day < today));
      const totalLimit = (cards || []).reduce((s: number, c: any) => s + (c.limit_amount || 0), 0);
      const ccExpenses = expenses.filter((e: any) => e.credit_card_id).reduce((s: number, e: any) => s + e.value, 0);
      setCcUsageRatio(totalLimit > 0 ? ccExpenses / totalLimit : 0);

      // Debts
      setDebtCount((debts || []).length);

      // History
      setHistory((scoreHistory || []) as ScoreHistory[]);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, nextMonthStr, prevMonthStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { overall, sub } = useMemo(() =>
    calculateScores(totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards, debtCount, prevIncome, prevExpense, ccUsageRatio),
    [totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards, debtCount, prevIncome, prevExpense, ccUsageRatio]
  );

  // Save current month score
  const saveScore = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('financial_scores').upsert({
        user_id: user.id,
        month_year: currentMonth,
        overall_score: overall,
        savings_score: sub.find(s => s.key === 'savings')!.score,
        budget_score: sub.find(s => s.key === 'budget')!.score,
        debt_score: sub.find(s => s.key === 'debt')!.score,
        consistency_score: sub.find(s => s.key === 'consistency')!.score,
        credit_score: sub.find(s => s.key === 'credit')!.score,
        total_income: totalIncome,
        total_expense: totalExpense,
      }, { onConflict: 'user_id,month_year' });
      if (!error) await fetchData();
    } finally {
      setSaving(false);
    }
  }, [user, currentMonth, overall, sub, totalIncome, totalExpense, fetchData]);

  // Chart data
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return history.map(h => {
      const d = new Date(h.month_year);
      return {
        label: `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        score: h.overall_score,
        savings: h.savings_score,
        budget: h.budget_score,
        debt: h.debt_score,
        consistency: h.consistency_score,
        credit: h.credit_score,
      };
    });
  }, [history]);

  // Radar data
  const radarData = useMemo(() =>
    sub.map(s => ({ subject: s.label, score: s.score, fullMark: 100 })),
    [sub]
  );

  // Previous month comparison
  const prevScore = history.length > 0 ? history[history.length - 1] : null;
  const scoreDiff = prevScore ? overall - prevScore.overall_score : null;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const color = getScoreColor(overall);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (overall / 100) * circumference;

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
                  Análise detalhada e evolução da sua saúde financeira
                </p>
              </div>
              <Button onClick={saveScore} disabled={saving || loading} size="sm" className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Salvando...' : 'Salvar Score do Mês'}
              </Button>
            </div>

            {loading ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : (
              <>
                {/* Main Score + Radar */}
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                  {/* Big Score Card */}
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
                          <span className="text-4xl font-bold" style={{ color }}>{overall}</span>
                          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-lg font-semibold" style={{ color }}>
                          {getScoreEmoji(overall)} {getScoreLabel(overall)}
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
                      <div className="w-full text-xs text-center text-muted-foreground bg-muted/50 rounded-lg p-3">
                        Receita: {fmt(totalIncome)} · Despesa: {fmt(totalExpense)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radar Chart */}
                  <Card className="lg:col-span-2 h-full flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        Perfil Financeiro
                        <InfoPopover>Visão geral das 5 dimensões que compõem seu score. Quanto maior a área, melhor sua saúde financeira.</InfoPopover>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[280px]">
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

                {/* Sub-scores */}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalhamento por Dimensão</h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                  {sub.map(s => {
                    const sColor = getScoreColor(s.score);
                    return (
                      <Card key={s.key}>
                        <CardContent className="pt-4 pb-3 px-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <span style={{ color: sColor }}>{s.icon}</span>
                              {s.label}
                            </div>
                            <InfoPopover>{s.tip}</InfoPopover>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold" style={{ color: sColor }}>{s.score}</span>
                            <span className="text-xs text-muted-foreground mb-1">/ 100</span>
                          </div>
                          <Progress
                            value={s.score}
                            className="h-1.5"
                            style={{ '--progress-color': sColor } as React.CSSProperties}
                          />
                          <p className="text-[10px] text-muted-foreground">{s.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Historical Chart */}
                {chartData.length > 1 && (
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Evolução do Score
                        <InfoPopover>Histórico mensal do seu score financeiro. Salve o score todo mês para acompanhar sua evolução.</InfoPopover>
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
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                            formatter={(v: number, name: string) => {
                              const labels: Record<string, string> = { score: 'Geral', savings: 'Poupança', budget: 'Orçamento', debt: 'Dívidas', consistency: 'Consistência', credit: 'Crédito' };
                              return [v, labels[name] || name];
                            }}
                          />
                          <Legend formatter={(v) => {
                            const labels: Record<string, string> = { score: 'Geral', savings: 'Poupança', budget: 'Orçamento', debt: 'Dívidas', consistency: 'Consistência', credit: 'Crédito' };
                            return labels[v] || v;
                          }} />
                          <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#gradScore)" strokeWidth={2.5} />
                          <Area type="monotone" dataKey="savings" stroke="hsl(142, 71%, 45%)" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                          <Area type="monotone" dataKey="budget" stroke="hsl(45, 93%, 47%)" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {chartData.length <= 1 && (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                      <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground font-medium">Histórico de evolução</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Salve o score de cada mês para acompanhar sua evolução ao longo do tempo.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Tips */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      💡 Dicas para Melhorar seu Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {sub.filter(s => s.score < 70).map(s => (
                        <div key={s.key} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/50">
                          <span className="shrink-0 mt-0.5" style={{ color: getScoreColor(s.score) }}>{s.icon}</span>
                          <div>
                            <p className="font-medium text-foreground">{s.label}: {s.score}/100</p>
                            <p className="text-muted-foreground mt-0.5">{s.tip}</p>
                          </div>
                        </div>
                      ))}
                      {sub.every(s => s.score >= 70) && (
                        <p className="text-sm text-muted-foreground col-span-2 text-center py-2">
                          🎉 Todas as dimensões estão acima de 70! Continue assim!
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
