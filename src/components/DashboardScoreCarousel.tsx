import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoPopover } from '@/components/ui/info-popover';
import { Activity, ChevronLeft, ChevronRight, Lightbulb, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { isInvoicePayment } from '@/lib/utils';
import {
  computeFinancialScore, getScoreColor, type ScoreDimension,
} from '@/lib/financialScore';
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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Barra de 5 pontos: leitura rápida sem depender de largura de pixel. */
function Dots({ score }: { score: number | null }) {
  const filled = score === null ? 0 : Math.round(score / 20);
  const color = score === null ? 'hsl(var(--muted-foreground))' : getScoreColor(score);
  return (
    <span className="flex items-center gap-[3px] shrink-0">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="block w-1.5 h-1.5 rounded-full transition-colors"
          style={{ backgroundColor: i < filled ? color : 'hsl(var(--muted))' }}
        />
      ))}
    </span>
  );
}

function DimensionRow({ d }: { d: ScoreDimension }) {
  const color = d.score === null ? 'hsl(var(--muted-foreground))' : getScoreColor(d.score);
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 whitespace-nowrap text-muted-foreground w-20">{d.label}</span>
        <Dots score={d.score} />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-5 text-right font-semibold tabular-nums shrink-0" style={{ color }}>
          {d.score === null ? '—' : d.score}
        </span>
        <span className="text-muted-foreground truncate max-w-[120px] hidden sm:inline">{d.detail}</span>
      </div>
    </div>
  );
}

export function DashboardScoreCarousel({
  totalIncome, totalExpense, hasOverdueCards, creditCards, monthExpenses,
}: DashboardScoreCarouselProps) {
  const { user } = useAuth();
  const [slide, setSlide] = useState(0);

  const { data: extras } = useQuery({
    queryKey: ['dashboard-score-extras-v2', user?.id],
    queryFn: async () => {
      const now = new Date();
      const currentMonth = monthKey(now);
      const threeAgo = monthKey(new Date(now.getFullYear(), now.getMonth() - 3, 1));

      const [{ data: debts }, { data: history }, { data: budgets }, { data: wallets }, { data: investments }, { data: prevScores }] =
        await Promise.all([
          supabase.from('debts').select('id, remaining_amount').eq('user_id', user!.id).eq('type', 'i_owe'),
          supabase.from('expenses').select('value, type, date, description, final_category')
            .eq('user_id', user!.id).gte('date', threeAgo).lt('date', currentMonth),
          supabase.from('budgets').select('category, allocated_amount').eq('user_id', user!.id).eq('month_year', currentMonth),
          supabase.from('wallets').select('current_balance, asset_type').eq('user_id', user!.id),
          supabase.from('investments').select('principal, status').eq('user_id', user!.id),
          supabase.from('financial_scores').select('month_year, overall_score')
            .eq('user_id', user!.id).lt('month_year', currentMonth)
            .order('month_year', { ascending: false }).limit(1),
        ]);

      // Despesas dos 3 meses anteriores, do mais recente para o mais antigo.
      const buckets: Record<string, number> = {};
      (history || []).forEach((e: any) => {
        if (e.type === 'income' || e.type === 'transfer') return;
        if (isBalanceAdjustment(e) || isInvoicePayment(e)) return;
        const k = e.date.slice(0, 7);
        buckets[k] = (buckets[k] || 0) + Number(e.value);
      });
      const previousExpenses = Object.keys(buckets).sort().reverse().map(k => buckets[k]);

      const liquid = (wallets || [])
        .filter((w: any) => w.asset_type !== 'crypto')
        .reduce((s: number, w: any) => s + Number(w.current_balance || 0), 0);
      const invested = (investments || [])
        .filter((i: any) => i.status === 'active')
        .reduce((s: number, i: any) => s + Number(i.principal || 0), 0);

      return {
        debtTotal: (debts || []).reduce((s: number, d: any) => s + Number(d.remaining_amount || 0), 0),
        previousExpenses,
        budgets: (budgets || []).map((b: any) => ({ category: b.category, allocated: Number(b.allocated_amount || 0) })),
        liquidReserve: liquid + invested,
        previousOverall: prevScores?.[0]?.overall_score ?? null,
      };
    },
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
  });

  const result = useMemo(() => {
    const spentByCategory: Record<string, number> = {};
    let ccExpenses = 0;
    let installmentExpenses = 0;
    let debtPayments = 0;

    monthExpenses.forEach((e: any) => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (isBalanceAdjustment(e) || isInvoicePayment(e)) return;
      spentByCategory[e.final_category] = (spentByCategory[e.final_category] || 0) + Number(e.value);
      if (e.credit_card_id) ccExpenses += Number(e.value);
      else if (e.installment_group_id) installmentExpenses += Number(e.value);
      if (e.debt_id) debtPayments += Number(e.value);
    });

    const totalLimit = creditCards.reduce((s, c) => s + Number(c.limit_amount || 0), 0);

    return computeFinancialScore({
      totalIncome,
      totalExpense,
      budgets: (extras?.budgets || []).map(b => ({
        category: b.category,
        allocated: b.allocated,
        spent: spentByCategory[b.category] || 0,
      })),
      committedAmount: ccExpenses + installmentExpenses + debtPayments,
      creditUsageRatio: totalLimit > 0 ? ccExpenses / totalLimit : 0,
      hasOverdueInvoice: hasOverdueCards,
      liquidReserve: extras?.liquidReserve,
      previousExpenses: extras?.previousExpenses || [],
    });
  }, [totalIncome, totalExpense, monthExpenses, creditCards, hasOverdueCards, extras]);

  // Snapshot automático do mês: grava quando a nota muda (mesma tabela/upsert).
  const lastSaved = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !extras) return;
    if (lastSaved.current === result.overall) return;
    lastSaved.current = result.overall;
    const currentMonth = monthKey(new Date());
    supabase.from('financial_scores').upsert({
      user_id: user.id,
      month_year: currentMonth,
      overall_score: result.overall,
      ...result.persisted,
      total_income: totalIncome,
      total_expense: totalExpense,
    }, { onConflict: 'user_id,month_year' }).then(() => {});
  }, [user, extras, result, totalIncome, totalExpense]);

  const radarData = useMemo(
    () => result.dimensions.map(d => ({ subject: `${d.label} ${d.score ?? '—'}`, score: d.score ?? 0, fullMark: 100 })),
    [result]
  );

  const totalSlides = 2;
  const prev = () => setSlide(s => (s - 1 + totalSlides) % totalSlides);
  const next = () => setSlide(s => (s + 1) % totalSlides);

  const scoreColor = getScoreColor(result.overall);
  const diff = extras?.previousOverall != null ? result.overall - extras.previousOverall : null;

  return (
    <Card className="rounded-2xl border-border/50 h-full flex flex-col">
      <CardHeader className="pb-1 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {slide === 0 ? 'Score Financeiro' : 'Perfil Financeiro'}
            <InfoPopover>
              <p className="text-xs">
                Nota de 0 a 100 que combina cinco dimensões: poupança (30%), dívidas e crédito (25%),
                orçamento (20%), reserva (15%) e consistência (10%). Dimensões sem dados suficientes
                ficam de fora e o peso é redistribuído.
              </p>
            </InfoPopover>
          </CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={prev} aria-label="Anterior" className="p-1 rounded-full hover:bg-muted transition-colors">
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
            <button onClick={next} aria-label="Próximo" className="p-1 rounded-full hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-4 pb-4 pt-0 overflow-hidden">
        <div className="w-full relative flex-1" style={{ minHeight: 210 }}>
          {/* Slide 0: nota + dimensões com números reais + próximo passo */}
          <div
            className="absolute inset-0 flex flex-col gap-2 transition-all duration-400 ease-in-out"
            style={{
              opacity: slide === 0 ? 1 : 0,
              transform: `translateX(${slide === 0 ? 0 : 100}%)`,
              pointerEvents: slide === 0 ? 'auto' : 'none',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r={50} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r={50} fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 - (result.overall / 100) * 2 * Math.PI * 50}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold leading-none" style={{ color: scoreColor }}>{result.overall}</span>
                  <span className="text-[8px] text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: scoreColor }}>
                    {result.emoji} {result.label}
                  </p>
                  {diff !== null && diff !== 0 && (
                    <span className={`flex items-center text-[10px] font-medium ${diff > 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(diff)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{result.headline}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/50 pt-2">
              {result.dimensions.map(d => <DimensionRow key={d.key} d={d} />)}
            </div>

            {result.nextStep && (
              <div className="mt-auto flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">Próximo passo: </span>
                  {result.nextStep.action} <span className="text-primary font-medium">(+{result.nextStep.potentialGain} pts)</span>
                </p>
              </div>
            )}
          </div>

          {/* Slide 1: radar */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-400 ease-in-out"
            style={{
              opacity: slide === 1 ? 1 : 0,
              transform: `translateX(${slide === 1 ? 0 : -100}%)`,
              pointerEvents: slide === 1 ? 'auto' : 'none',
            }}
          >
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
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
