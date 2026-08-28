import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import type { CategoryStats } from '@/hooks/useAnalyticsData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { seriesColor } from '@/lib/chartPalette';

interface Props {
  categoryStats: CategoryStats[];
  compare: boolean;
}

interface BudgetRow {
  category: string | null;
  allocated_amount: number | null;
}

interface CategoryBudget extends CategoryStats {
  budget: number;
  ratio: number;
}

function formatShare(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: value < 0.1 ? 1 : 0,
  }).format(value);
}

function transactionLabel(count: number) {
  return `${count} ${count === 1 ? 'lançamento' : 'lançamentos'}`;
}

function formatCategoryVariation(category: CategoryStats) {
  const change = category.change ?? 0;
  const difference = category.total - category.previousTotal;

  if (Math.abs(change) > 250) {
    return `${difference > 0 ? '+' : ''}${formatCurrency(difference)}`;
  }

  return `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
}

export function CategoryCharts({ categoryStats, compare }: Props) {
  const { user } = useAuth();
  const { startDate } = useSelectedDate();
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({});
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState(false);

  useEffect(() => {
    if (!user) {
      setBudgetMap({});
      setBudgetLoading(false);
      return;
    }

    let active = true;
    setBudgetLoading(true);
    setBudgetError(false);

    void supabase
      .from('budgets')
      .select('category, allocated_amount')
      .eq('user_id', user.id)
      .eq('month_year', startDate)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setBudgetMap({});
          setBudgetError(true);
          setBudgetLoading(false);
          return;
        }

        const nextBudgetMap: Record<string, number> = {};
        ((data ?? []) as BudgetRow[]).forEach((budget) => {
          if (budget.category && Number(budget.allocated_amount) > 0) {
            nextBudgetMap[budget.category] = Number(budget.allocated_amount);
          }
        });
        setBudgetMap(nextBudgetMap);
        setBudgetLoading(false);
      });

    return () => {
      active = false;
    };
  }, [startDate, user]);

  const totalSpending = useMemo(
    () => categoryStats.reduce((sum, category) => sum + category.total, 0),
    [categoryStats],
  );

  const rankedCategories = useMemo(
    () => categoryStats.slice(0, 6).map((category) => ({
      ...category,
      share: totalSpending > 0 ? category.total / totalSpending : 0,
    })),
    [categoryStats, totalSpending],
  );

  const budgetCategories = useMemo<CategoryBudget[]>(() => {
    const statsByCategory = new Map(categoryStats.map((category) => [category.category, category]));
    const categoryKeys = new Set([...statsByCategory.keys(), ...Object.keys(budgetMap)]);

    return [...categoryKeys]
      .map((category) => {
        const stats = statsByCategory.get(category) ?? {
          category,
          total: 0,
          count: 0,
          previousTotal: 0,
          change: null,
        };
        const label = getCategoryLabel(category);
        const budget = budgetMap[category] ?? budgetMap[label] ?? 0;
        return { ...stats, budget, ratio: budget > 0 ? stats.total / budget : 0 };
      })
      .filter((category) => category.budget > 0)
      .sort((first, second) => second.ratio - first.ratio)
      .slice(0, 5);
  }, [budgetMap, categoryStats]);

  const relevantChanges = useMemo(
    () => categoryStats
      .filter((category) => category.change !== null)
      .sort((first, second) => Math.abs(second.change ?? 0) - Math.abs(first.change ?? 0))
      .slice(0, 4), [categoryStats]);

  return (
    <section className="space-y-5" aria-labelledby="category-analytics-title">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Despesas por categoria</p>
        <h2 id="category-analytics-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Para onde foi o seu dinheiro</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Veja participação, orçamento e mudanças relevantes sem perder o contexto do período.</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
        <Card className="rounded-3xl border-border/80 shadow-card">
          <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
            <CardTitle className="text-lg font-semibold tracking-tight">Maiores gastos</CardTitle>
            <p className="text-sm leading-5 text-muted-foreground">Participação de cada categoria no total de {formatCurrency(totalSpending)}.</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            {rankedCategories.length > 0 ? (
              <ol className="space-y-4" aria-label="Categorias com maiores gastos">
                {rankedCategories.map((category, index) => {
                  const label = getCategoryLabel(category.category);
                  return (
                    <li key={category.category} className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold leading-5 text-foreground">{label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{transactionLabel(category.count)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{formatCurrency(category.total)}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{formatShare(category.share)} do total</p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(category.share * 100, 2)}%`, backgroundColor: seriesColor(index) }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
                <ReceiptText className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium text-foreground">Ainda não há despesas neste período</p>
                <p className="mt-1 max-w-xs text-sm leading-5 text-muted-foreground">As categorias aparecerão assim que houver lançamentos de despesa.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/80 shadow-card">
          <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
            <CardTitle className="text-lg font-semibold tracking-tight">Orçamentos acompanhados</CardTitle>
            <p className="text-sm leading-5 text-muted-foreground">O que já foi gasto em relação ao limite que você definiu.</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            {budgetLoading ? (
              <div className="space-y-4" role="status" aria-label="Carregando orçamentos">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-muted/60" />)}</div>
            ) : budgetError ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
                <CircleAlert className="mb-3 h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="font-medium text-foreground">Não foi possível carregar os orçamentos</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Tente novamente ao atualizar esta página.</p>
              </div>
            ) : budgetCategories.length > 0 ? (
              <ul className="space-y-4" aria-label="Acompanhamento de orçamentos por categoria">
                {budgetCategories.map((category) => {
                  const label = getCategoryLabel(category.category);
                  const isOverBudget = category.ratio > 1;
                  const remaining = Math.max(category.budget - category.total, 0);
                  return (
                    <li key={category.category} className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold leading-5 text-foreground">{label}</p>
                          <p className={isOverBudget ? 'mt-0.5 text-xs font-medium text-destructive' : 'mt-0.5 text-xs text-muted-foreground'}>{isOverBudget ? `Acima do orçamento em ${formatCurrency(category.total - category.budget)}` : `${formatCurrency(remaining)} ainda disponível`}</p>
                        </div>
                        <p className="shrink-0 whitespace-nowrap text-right text-xs leading-5 tabular-nums text-muted-foreground">{formatCurrency(category.total)} / {formatCurrency(category.budget)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={isOverBudget ? 'h-full rounded-full bg-destructive transition-[width] duration-300' : 'h-full rounded-full bg-primary transition-[width] duration-300'} style={{ width: `${Math.min(category.ratio * 100, 100)}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
                <CircleCheck className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                <p className="font-medium text-foreground">Nenhum orçamento para acompanhar</p>
                <p className="mt-1 max-w-xs text-sm leading-5 text-muted-foreground">Defina limites por categoria em Planejar e eles aparecerão aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-border/80 shadow-card">
        <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
          <CardTitle className="text-lg font-semibold tracking-tight">Mudanças relevantes</CardTitle>
          <p className="text-sm leading-5 text-muted-foreground">Comparação por categoria com o período anterior equivalente.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {!compare ? (
            <p className="rounded-2xl bg-muted/35 px-4 py-4 text-sm leading-6 text-muted-foreground">Ative a comparação de período no filtro acima para identificar as categorias que mais mudaram.</p>
          ) : relevantChanges.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {relevantChanges.map((category) => {
                const isIncrease = (category.change ?? 0) > 0;
                const isStable = category.change === 0;
                const label = getCategoryLabel(category.category);
                const variation = formatCategoryVariation(category);
                return (
                  <div key={category.category} className="min-w-0 rounded-2xl bg-muted/35 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold leading-5 text-foreground">{label}</p>
                      {isIncrease ? <ArrowUpRight className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : <ArrowDownRight className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
                    </div>
                    <p className={isStable ? 'mt-3 text-lg font-semibold tabular-nums text-foreground' : isIncrease ? 'mt-3 text-lg font-semibold tabular-nums text-destructive' : 'mt-3 text-lg font-semibold tabular-nums text-success'}>{isStable ? 'Sem alteração' : variation}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{formatCurrency(category.previousTotal)} para {formatCurrency(category.total)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted/35 px-4 py-4 text-sm leading-6 text-muted-foreground">Ainda não há categorias com base comparável entre os dois períodos.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
