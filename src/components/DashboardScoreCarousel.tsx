import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { InfoPopover } from '@/components/ui/info-popover';
import { Activity, PiggyBank, Target, Shield, BarChart3, CreditCard, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

interface DashboardScoreCarouselProps {
  totalIncome: number;
  totalExpense: number;
  totalBudget: number;
  totalSpentInBudget: number;
  hasOverdueCards: boolean;
  creditCards: any[];
  monthExpenses: any[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'hsl(142, 71%, 45%)';
  if (score >= 60) return 'hsl(45, 93%, 47%)';
  if (score >= 40) return 'hsl(25, 95%, 53%)';
  return 'hsl(0, 72%, 51%)';
}

function getHealthMessage(score: number) {
  if (score < 40) return 'Cuidado! Reveja seus gastos.';
  if (score < 70) return 'Você está no caminho certo!';
  return 'Excelente! Finanças saudáveis!';
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
  prevExpense: number,
  ccUsageRatio: number,
): { overall: number; sub: SubScore[] } {
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

  let budgetScore = 75;
  if (totalBudget > 0) {
    const ratio = totalSpentInBudget / totalBudget;
    if (ratio <= 0.8) budgetScore = 100;
    else if (ratio <= 0.95) budgetScore = 85;
    else if (ratio <= 1) budgetScore = 70;
    else if (ratio <= 1.1) budgetScore = 50;
    else budgetScore = 20;
  }

  let debtScore = 100;
  if (debtCount > 0) debtScore -= debtCount * 10;
  if (hasOverdueCards) debtScore -= 20;
  debtScore = Math.max(0, Math.min(100, debtScore));

  let consistencyScore = 70;
  if (prevExpense > 0 && totalExpense > 0) {
    const variation = Math.abs(totalExpense - prevExpense) / prevExpense;
    if (variation <= 0.05) consistencyScore = 100;
    else if (variation <= 0.15) consistencyScore = 85;
    else if (variation <= 0.3) consistencyScore = 65;
    else consistencyScore = 40;
  }

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

export function DashboardScoreCarousel({
  totalIncome, totalExpense, totalBudget, totalSpentInBudget,
  hasOverdueCards, creditCards, monthExpenses,
}: DashboardScoreCarouselProps) {
  const { user } = useAuth();
  const [slide, setSlide] = useState(0);
  const [debtCount, setDebtCount] = useState(0);
  const [prevExpense, setPrevExpense] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fetch extra data for score calculation
  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    Promise.all([
      supabase.from('debts').select('id').eq('user_id', user.id).eq('type', 'i_owe'),
      supabase.from('expenses').select('value, type').eq('user_id', user.id)
        .gte('date', prevMonthStr).lt('date', currentMonth),
    ]).then(([{ data: debts }, { data: prevExp }]) => {
      setDebtCount((debts || []).length);
      const filtered = (prevExp || []).filter((e: any) => e.type !== 'transfer' && e.type !== 'income');
      setPrevExpense(filtered.reduce((s: number, e: any) => s + e.value, 0));
    });
  }, [user]);

  const ccUsageRatio = useMemo(() => {
    const totalLimit = creditCards.reduce((s, c) => s + (c.limit_amount || 0), 0);
    const ccExp = monthExpenses.filter(e => e.credit_card_id && e.type !== 'income').reduce((s, e) => s + e.value, 0);
    return totalLimit > 0 ? ccExp / totalLimit : 0;
  }, [creditCards, monthExpenses]);

  const { overall, sub } = useMemo(() =>
    calculateScores(totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards, debtCount, prevExpense, ccUsageRatio),
    [totalIncome, totalExpense, totalBudget, totalSpentInBudget, hasOverdueCards, debtCount, prevExpense, ccUsageRatio]
  );

  const radarData = useMemo(() =>
    sub.map(s => ({ subject: s.label, score: s.score, fullMark: 100 })),
    [sub]
  );

  const saveScore = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    try {
      await supabase.from('financial_scores').upsert({
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
    } finally {
      setSaving(false);
    }
  }, [user, overall, sub, totalIncome, totalExpense]);

  const totalSlides = 2;
  const prev = () => setSlide(s => (s - 1 + totalSlides) % totalSlides);
  const next = () => setSlide(s => (s + 1) % totalSlides);

  const scoreColor = getScoreColor(overall);

  return (
    <Card className="rounded-2xl border-border/50 h-full flex flex-col">
      <CardHeader className="pb-1 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {slide === 0 ? 'Score Financeiro' : 'Perfil Financeiro'}
          </CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1 rounded-full hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <span
                  key={i}
                  className={`block h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                />
              ))}
            </div>
            <button onClick={next} className="p-1 rounded-full hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center px-4 pb-4 pt-0 overflow-hidden">
        <div className="w-full relative" style={{ minHeight: 200 }}>
          {/* Slide 0: Health Score (simple) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-400 ease-in-out"
            style={{
              opacity: slide === 0 ? 1 : 0,
              transform: `translateX(${slide === 0 ? 0 : slide > 0 ? -100 : 100}%)`,
              pointerEvents: slide === 0 ? 'auto' : 'none',
            }}
          >
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={54} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r={54} fill="none"
                  stroke={healthColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 54}
                  strokeDashoffset={2 * Math.PI * 54 - (healthScore / 100) * 2 * Math.PI * 54}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: healthColor }}>{healthScore}</span>
                <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
              </div>
            </div>
            <p className="text-sm font-medium text-center" style={{ color: healthColor }}>{getHealthMessage(healthScore)}</p>
          </div>

          {/* Slide 1: Detailed Score + Sub-scores */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-400 ease-in-out"
            style={{
              opacity: slide === 1 ? 1 : 0,
              transform: `translateX(${slide === 1 ? 0 : slide > 1 ? -100 : 100}%)`,
              pointerEvents: slide === 1 ? 'auto' : 'none',
            }}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r={50} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r={50} fill="none"
                    stroke={scoreColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 - (overall / 100) * 2 * Math.PI * 50}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: scoreColor }}>{overall}</span>
                  <span className="text-[8px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: scoreColor }}>
                  {getScoreEmoji(overall)} {getScoreLabel(overall)}
                </p>
                <div className="space-y-1 mt-1.5">
                  {sub.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span className="text-[10px] w-20 truncate text-muted-foreground">{s.label}</span>
                      <Progress value={s.score} className="h-1 flex-1" />
                      <span className="text-[10px] font-medium w-6 text-right" style={{ color: getScoreColor(s.score) }}>{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={saveScore} disabled={saving} variant="outline" size="sm" className="mt-1 text-xs h-7 gap-1">
              <RefreshCw className={`h-3 w-3 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Salvando...' : 'Salvar Score'}
            </Button>
          </div>

          {/* Slide 2: Radar Chart */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-400 ease-in-out"
            style={{
              opacity: slide === 2 ? 1 : 0,
              transform: `translateX(${slide === 2 ? 0 : -100}%)`,
              pointerEvents: slide === 2 ? 'auto' : 'none',
            }}
          >
            <ResponsiveContainer width="100%" height={190}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
