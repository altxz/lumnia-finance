import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, CATEGORIES, getCategoryInfo } from '@/lib/constants';
import { ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BudgetRow {
  id: string;
  category: string;
  allocated_amount: number;
}

export default function BudgetPage() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, monthKey, label: monthLabel } = useSelectedDate();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Record<string, BudgetRow>>({});
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const firstOfMonth = startDate;

    const [{ data: budgetData }, { data: expenseData }] = await Promise.all([
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', firstOfMonth),
      supabase.from('expenses').select('final_category, value, type').eq('user_id', user.id).gte('date', firstOfMonth).lt('date', endDate),
    ]);

    // Budgets map
    const bMap: Record<string, BudgetRow> = {};
    (budgetData || []).forEach((b: any) => { bMap[b.category] = b; });
    setBudgets(bMap);

    // Spent by category + income
    const spent: Record<string, number> = {};
    let income = 0;
    (expenseData || []).forEach((e: any) => {
      if (e.type === 'income') {
        income += e.value;
      } else {
        spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
      }
    });
    setSpentByCategory(spent);
    setTotalIncome(income);
    setLoading(false);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalAllocated = useMemo(() =>
    Object.values(budgets).reduce((s, b) => s + b.allocated_amount, 0),
  [budgets]);

  const remaining = totalIncome - totalAllocated;
  const totalSpent = useMemo(() => Object.values(spentByCategory).reduce((s, v) => s + v, 0), [spentByCategory]);

  const handleSaveBudget = useCallback(async (category: string, amount: number) => {
    if (!user) return;
    setSavingCat(category);

    const existing = budgets[category];
    if (existing) {
      const { error } = await supabase.from('budgets').update({ allocated_amount: amount }).eq('id', existing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else { setBudgets(prev => ({ ...prev, [category]: { ...existing, allocated_amount: amount } })); }
    } else {
      const { data, error } = await supabase.from('budgets').insert({
        user_id: user.id, category, month_year: monthKey, allocated_amount: amount,
      }).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
      else if (data) { setBudgets(prev => ({ ...prev, [category]: data as BudgetRow })); }
    }
    setSavingCat(null);
  }, [user, budgets, monthKey, toast]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            <MonthSelector />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orçamento Mensal</h1>
            </div>

            {/* Summary row */}
            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border-0 shadow-md bg-green-600 text-white">
                <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center"><ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium opacity-80">Receita</p>
                    <p className="text-base sm:text-xl font-bold">{formatCurrency(totalIncome)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"><PiggyBank className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium opacity-80">Distribuído</p>
                    <p className="text-base sm:text-xl font-bold">{formatCurrency(totalAllocated)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`rounded-2xl border-0 shadow-md ${remaining < 0 ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${remaining < 0 ? 'bg-destructive-foreground/20' : 'bg-accent-foreground/10'}`}>
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium opacity-80">Restante</p>
                    <p className="text-base sm:text-xl font-bold">{formatCurrency(remaining)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-destructive text-destructive-foreground">
                <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center"><ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium opacity-80">Total Gasto</p>
                    <p className="text-base sm:text-xl font-bold">{formatCurrency(totalSpent)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Global progress bar */}
            {totalIncome > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distribuição da receita</span>
                  <span className="font-medium">{Math.min(100, (totalAllocated / totalIncome * 100)).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (totalAllocated / totalIncome) * 100)} className="h-3" />
              </div>
            )}

            {/* Category budget rows */}
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando...</p>
            ) : (
              <div className="space-y-3">
                {CATEGORIES.map(cat => {
                  const budget = budgets[cat.value];
                  const allocated = budget?.allocated_amount || 0;
                  const spent = spentByCategory[cat.value] || 0;
                  const spentPct = allocated > 0 ? (spent / allocated) * 100 : (spent > 0 ? 100 : 0);
                  const clampedPct = Math.min(100, spentPct);
                  const isOver = spentPct >= 100 && allocated > 0;
                  const isWarning = spentPct >= 80 && spentPct < 100 && allocated > 0;
                  const catInfo = getCategoryInfo(cat.value);

                  const barColor = isOver
                    ? '[&>div]:bg-destructive'
                    : isWarning
                      ? '[&>div]:bg-orange-500'
                      : '';

                  return (
                    <Card key={cat.value} className="rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Category name */}
                          <div className="flex items-center gap-3 sm:w-40 shrink-0">
                            <Badge variant={catInfo.variant} className="text-xs">{catInfo.label}</Badge>
                          </div>

                          {/* Budget input */}
                          <div className="flex items-center gap-2 sm:w-48 shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Planeado:</span>
                            <Input
                              type="number"
                              step="50"
                              min="0"
                              placeholder="0"
                              value={allocated || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setBudgets(prev => ({
                                  ...prev,
                                  [cat.value]: { ...(prev[cat.value] || { id: '', category: cat.value, allocated_amount: 0 }), allocated_amount: val },
                                }));
                              }}
                              onBlur={e => {
                                const val = parseFloat(e.target.value) || 0;
                                handleSaveBudget(cat.value, val);
                              }}
                              className="rounded-xl h-9 w-28 text-sm"
                              disabled={savingCat === cat.value}
                            />
                          </div>

                          {/* Progress */}
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className={`flex items-center gap-1 ${isOver ? 'text-destructive font-semibold' : isWarning ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                                {isOver && <AlertTriangle className="h-3.5 w-3.5" />}
                                {formatCurrency(spent)} gasto
                              </span>
                              <span className="text-muted-foreground">
                                {allocated > 0 ? `${spentPct.toFixed(0)}%` : '—'}
                              </span>
                            </div>
                            <div className="relative">
                              <Progress
                                value={clampedPct}
                                className={`h-2.5 ${barColor}`}
                              />
                            </div>
                            {isOver && (
                              <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Ultrapassou em {formatCurrency(spent - allocated)}
                              </p>
                            )}
                            {isWarning && (
                              <p className="text-[11px] text-orange-600 font-medium">
                                Atenção: próximo do limite ({spentPct.toFixed(0)}%)
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
