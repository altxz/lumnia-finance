import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, RotateCcw, GripHorizontal, LayoutDashboard, Check, Maximize2 } from 'lucide-react';
import { ResponsiveGridLayout as RGLBase } from 'react-grid-layout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGrid = RGLBase as any;
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SummaryCards } from '@/components/SummaryCards';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { DashboardHeader } from '@/components/DashboardHeader';
import { InstallPwaPrompt } from '@/components/InstallPwaPrompt';
import { AnomalyInsights } from '@/components/analytics/AnomalyInsights';
import { AppSidebar } from '@/components/AppSidebar';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { getCategoryInfo } from '@/lib/constants';
import { Navigate } from 'react-router-dom';
import { CashFlowChart } from '@/components/CashFlowChart';
import { HealthScore } from '@/components/HealthScore';
import { CalendarView } from '@/components/CalendarView';
import { IncomeVsExpenseChart } from '@/components/analytics/IncomeVsExpenseChart';
import { TopCategoriesPie } from '@/components/analytics/TopCategoriesPie';
import { CreditUsageChart } from '@/components/analytics/CreditUsageChart';
import { EndOfMonthForecast } from '@/components/analytics/EndOfMonthForecast';
import { DailySpendingChart } from '@/components/analytics/DailySpendingChart';
import { FixedVsVariableChart } from '@/components/analytics/FixedVsVariableChart';
import { SubcategoryTreemap } from '@/components/analytics/SubcategoryTreemap';
import { SavingsRateGauge } from '@/components/analytics/SavingsRateGauge';
import { WeekComparisonChart } from '@/components/analytics/WeekComparisonChart';
import { IncomeSourcesPie } from '@/components/analytics/IncomeSourcesPie';
import { WaterfallChart } from '@/components/analytics/WaterfallChart';
import { SpendingHeatmap } from '@/components/analytics/SpendingHeatmap';
import { BurndownChart } from '@/components/analytics/BurndownChart';
import { NetWorthChart } from '@/components/analytics/NetWorthChart';
import type { Expense } from '@/components/ExpenseTable';

const STORAGE_KEY = 'dashboard-grid-layouts';

const defaultLayout = [
  // LINHA 1: Fluxo de Caixa (Largo, tela toda)
  { i: 'cashflow', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  // LINHA 2: Receitas vs Despesas | Despesas por Categoria
  { i: 'income_expense', x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'categories', x: 2, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
  // LINHA 3: Cascata (Largo)
  { i: 'trends', x: 0, y: 4, w: 4, h: 2, minW: 2, minH: 2 },
  // LINHA 4: Previsão | Evolução Patrimonial
  { i: 'forecast', x: 0, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'networth', x: 2, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
  // LINHA 5: Fixo vs Variável | Uso de Cartão
  { i: 'fixed_variable', x: 0, y: 8, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'credit', x: 2, y: 8, w: 2, h: 2, minW: 2, minH: 2 },
  // LINHA 6: Fontes de Renda | Taxa de Poupança
  { i: 'income_sources', x: 0, y: 10, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'savings', x: 2, y: 10, w: 2, h: 2, minW: 2, minH: 2 },
  // LINHA 7: Extras
  { i: 'daily_spending', x: 0, y: 12, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'burndown', x: 2, y: 12, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'heatmap', x: 0, y: 14, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'week_comparison', x: 2, y: 14, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'subcategory_tree', x: 0, y: 16, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'calendar', x: 2, y: 16, w: 2, h: 2, minW: 2, minH: 2 },
];

const defaultLayouts = {
  lg: defaultLayout,
  md: defaultLayout.map(l => ({ ...l, w: Math.min(l.w, 4), x: Math.min(l.x, 0) })),
  sm: defaultLayout.map((l, idx) => ({ ...l, x: 0, y: idx * 2, w: 2 })),
  xs: defaultLayout.map((l, idx) => ({ ...l, x: 0, y: idx * 2, w: 1 })),
};

function loadSavedLayouts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return defaultLayouts;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-2xl" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-[300px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-2xl" />
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [budgetTotals, setBudgetTotals] = useState({ totalBudget: 0, totalSpent: 0 });
  const [hasOverdueCards, setHasOverdueCards] = useState(false);
  const [totalRealBalance, setTotalRealBalance] = useState(0);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const fetchCounterRef = useRef(0);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [layouts, setLayouts] = useState(loadSavedLayouts);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(900);

  // Measure grid container width
  useEffect(() => {
    if (!gridContainerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setGridWidth(entry.contentRect.width);
    });
    obs.observe(gridContainerRef.current);
    return () => obs.disconnect();
  }, []);

  // Previous month date range
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevNextM = prevMonth === 11 ? 0 : prevMonth + 1;
  const prevNextY = prevMonth === 11 ? prevYear + 1 : prevYear;
  const prevEndDate = `${prevNextY}-${String(prevNextM + 1).padStart(2, '0')}-01`;

  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    const counter = ++fetchCounterRef.current;
    setDataLoading(true);

    try {
      const [
        { data: expData },
        { data: prevExpData },
        { data: catData },
        { data: walletsData },
        { data: allTxns },
        { data: budgetData },
        { data: budgetExpData },
        { data: cards },
      ] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', user.id)
          .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
        supabase.from('expenses').select('*').eq('user_id', user.id)
          .gte('date', prevStartDate).lt('date', prevEndDate),
        supabase.from('categories').select('id, name, parent_id, icon, color')
          .eq('user_id', user.id).order('sort_order'),
        supabase.from('wallets').select('initial_balance').eq('user_id', user.id),
        supabase.from('expenses').select('value, type, credit_card_id')
          .eq('user_id', user.id).eq('is_paid', true),
        supabase.from('budgets').select('category, allocated_amount')
          .eq('user_id', user.id).eq('month_year', startDate),
        supabase.from('expenses').select('final_category, value, type')
          .eq('user_id', user.id).gte('date', startDate).lt('date', endDate),
        supabase.from('credit_cards').select('due_day').eq('user_id', user.id),
      ]);

      if (counter !== fetchCounterRef.current) return;

      setExpenses(expData || []);
      setPrevExpenses(prevExpData || []);
      setDbCategories(catData || []);

      const walletsTotal = (walletsData || []).reduce((s: number, w: any) => s + (w.initial_balance || 0), 0);
      let realBalance = walletsTotal;
      (allTxns || []).forEach((t: any) => {
        if (t.type === 'transfer') return;
        if (t.type === 'income') realBalance += t.value;
        else if (!t.credit_card_id) realBalance -= t.value;
      });
      setTotalRealBalance(realBalance);

      const spent: Record<string, number> = {};
      (budgetExpData || []).forEach((e: any) => {
        if (e.type !== 'income') spent[e.final_category] = (spent[e.final_category] || 0) + e.value;
      });
      const warnings: string[] = [];
      (budgetData || []).forEach((b: any) => {
        if (b.allocated_amount > 0) {
          const pct = (spent[b.category] || 0) / b.allocated_amount * 100;
          if (pct >= 80) warnings.push(getCategoryInfo(b.category).label);
        }
      });
      setBudgetAlerts(warnings);
      setBudgetTotals({
        totalBudget: (budgetData || []).reduce((s: number, b: any) => s + (b.allocated_amount || 0), 0),
        totalSpent: Object.values(spent).reduce((s: number, v: number) => s + v, 0),
      });

      const today = new Date();
      setHasOverdueCards(cards ? cards.some((c: any) => c.due_day < today.getDate()) : false);
    } finally {
      if (counter === fetchCounterRef.current) setDataLoading(false);
    }
  }, [user, startDate, endDate, prevStartDate, prevEndDate]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const summary = useMemo(() => {
    const nonTransfers = expenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    const byCategory: Record<string, number> = {};
    cashExpenses.forEach(e => { byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value; });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
      balance: income - expenseTotal,
      totalIncome: income,
      totalExpense: expenseTotal,
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1], categoryKey: largest[0] } : null,
    };
  }, [expenses]);

  const prevSummary = useMemo(() => {
    const nonTransfers = prevExpenses.filter(e => e.type !== 'transfer');
    const income = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const cashExpenses = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id);
    const expenseTotal = cashExpenses.reduce((s, e) => s + e.value, 0);
    return { totalIncome: income, totalExpense: expenseTotal, balance: income - expenseTotal };
  }, [prevExpenses]);

  const handleLayoutChange = useCallback((_current: any, allLayouts: any) => {
    setLayouts(allLayouts);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts)); } catch { /* */ }
  }, []);

  const toggleWidgetSize = useCallback((widgetId: string) => {
    setLayouts(prev => {
      const updated: any = {};
      for (const bp of Object.keys(prev)) {
        updated[bp] = (prev as any)[bp].map((item: any) => {
          if (item.i !== widgetId) return item;
          // Quadrado (2) → Largo (4). Largo (4) → Quadrado (2)
          const newW = item.w === 2 ? 4 : 2;
          // Ao virar Largo, forçamos x para 0 para não vazar da tela
          const newX = newW === 4 ? 0 : item.x;
          return { ...item, w: newW, x: newX };
        });
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* */ }
      return updated;
    });
  }, []);

  const handleResetLayout = useCallback(() => {
    setLayouts(defaultLayouts);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Map of widget id → { title, component }
  const widgetMap = useMemo(() => ({
    'cashflow':          { title: 'Fluxo de Caixa',       comp: <CashFlowChart /> },
    'income_expense':    { title: 'Receitas vs Despesas',  comp: <IncomeVsExpenseChart /> },
    'categories':        { title: 'Categorias',            comp: <TopCategoriesPie expenses={expenses} categories={dbCategories} /> },
    'trends':            { title: 'Cascata',               comp: <WaterfallChart expenses={expenses} startingBalance={totalRealBalance - summary.totalIncome + summary.totalExpense} /> },
    'forecast':          { title: 'Previsão',              comp: <EndOfMonthForecast /> },
    'networth':          { title: 'Evolução Patrimonial',  comp: <NetWorthChart /> },
    'fixed_variable':    { title: 'Fixo vs Variável',      comp: <FixedVsVariableChart expenses={expenses} /> },
    'credit':            { title: 'Uso do Cartão',         comp: <CreditUsageChart /> },
    'income_sources':    { title: 'Fontes de Receita',     comp: <IncomeSourcesPie expenses={expenses} categories={dbCategories} /> },
    'savings':           { title: 'Taxa de Poupança',      comp: <SavingsRateGauge totalIncome={summary.totalIncome} totalExpense={summary.totalExpense} /> },
    'daily_spending':    { title: 'Gastos Diários',        comp: <DailySpendingChart expenses={expenses} /> },
    'burndown':          { title: 'Burndown',              comp: <BurndownChart expenses={expenses} totalBudget={budgetTotals.totalBudget} /> },
    'heatmap':           { title: 'Mapa de Calor',         comp: <SpendingHeatmap expenses={expenses} /> },
    'week_comparison':   { title: 'Comparação Semanal',    comp: <WeekComparisonChart expenses={expenses} /> },
    'subcategory_tree':  { title: 'Subcategorias',         comp: <SubcategoryTreemap expenses={expenses} categories={dbCategories} /> },
    'calendar':          { title: 'Calendário',            comp: <CalendarView /> },
  }), [expenses, dbCategories, summary, totalRealBalance, budgetTotals]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto">
            <InstallPwaPrompt />
            <MonthSelector />

            {dataLoading ? (
              <DashboardSkeleton />
            ) : (
              <>
                <AnomalyInsights />

                {budgetAlerts.length > 0 && (
                  <Alert variant="destructive" className="rounded-xl border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="font-medium text-sm">
                      Atenção: Você está quase ultrapassando seu orçamento em{' '}
                      <span className="font-bold">{budgetAlerts.join(' e ')}</span>!
                    </AlertDescription>
                  </Alert>
                )}

                <SummaryCards
                  balance={totalRealBalance}
                  totalIncome={summary.totalIncome}
                  totalExpense={summary.totalExpense}
                  largestCategory={summary.largestCategory}
                  prevBalance={prevSummary.balance}
                  prevIncome={prevSummary.totalIncome}
                  prevExpense={prevSummary.totalExpense}
                  healthScore={
                    <HealthScore
                      totalIncome={summary.totalIncome}
                      totalExpense={summary.totalExpense}
                      totalBudget={budgetTotals.totalBudget}
                      totalSpentInBudget={budgetTotals.totalSpent}
                      hasOverdueCards={hasOverdueCards}
                    />
                  }
                />



                {/* Layout Controls */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Painel de Análises</h2>
                  <div className="flex items-center gap-2">
                    {isEditingLayout && (
                      <Button variant="ghost" size="sm" onClick={handleResetLayout} className="gap-1.5 text-xs text-muted-foreground">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar
                      </Button>
                    )}
                    <Button
                      variant={isEditingLayout ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsEditingLayout(v => !v)}
                      className={`gap-1.5 text-xs transition-all ${isEditingLayout ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    >
                      {isEditingLayout ? <Check className="h-3.5 w-3.5" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
                      {isEditingLayout ? 'Guardar Layout' : 'Editar Painel'}
                    </Button>
                  </div>
                </div>

                <div ref={gridContainerRef}>
                  <ResponsiveGrid
                    className="layout"
                    layouts={layouts}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 }}
                    rowHeight={160}
                    width={gridWidth}
                    isDraggable={isEditingLayout}
                    isResizable={false}
                    draggableHandle=".drag-handle"
                    onLayoutChange={handleLayoutChange}
                    compactType="vertical"
                    margin={[12, 12]}
                    containerPadding={[0, 0]}
                    useCSSTransforms
                  >
                    {defaultLayout.map(item => {
                      const widget = widgetMap[item.i as keyof typeof widgetMap];
                      if (!widget) return null;
                      return (
                        <div key={item.i} className="w-full h-full relative">
                          {widget.comp}
                          {isEditingLayout && (
                            <div className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-2xl z-10 pointer-events-none">
                              <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-auto">
                                <button
                                  className="drag-handle p-1.5 rounded-lg bg-card/90 border border-border shadow-sm hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
                                  title="Mover"
                                >
                                  <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={() => toggleWidgetSize(item.i)}
                                  className="p-1.5 rounded-lg bg-card/90 border border-border shadow-sm hover:bg-accent transition-colors"
                                  title="Redimensionar"
                                >
                                  <Maximize2 className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </ResponsiveGrid>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <AddExpenseModal open={modalOpen} onOpenChange={setModalOpen} onExpenseAdded={fetchAllData} />
    </SidebarProvider>
  );
}
