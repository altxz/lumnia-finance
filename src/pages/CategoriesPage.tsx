import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Tag, TrendingUp, TrendingDown, Search, TriangleAlert } from 'lucide-react';
import { MonthSelector } from '@/components/MonthSelector';
import { PageHeader } from '@/components/ui/page-header';
import { hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { useToast } from '@/hooks/use-toast';
import { icons } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { Progress } from '@/components/ui/progress';
import { useBudgetData } from '@/hooks/useBudgetData';
import { cn } from '@/lib/utils';
import { transactionAmount } from '@/lib/transactionAmount';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
  active: boolean;
  sort_order: number;
  parent_id?: string | null;
  expense_count?: number;
  ai_accuracy?: number;
  total_value?: number;
  month_count?: number;
  month_value?: number;
  month_expense_value?: number;
  month_income_value?: number;
  month_expense_count?: number;
  month_income_count?: number;
}

const PRESET_COLORS = [
  '#612CFA', '#A36EF9', '#51D3A6', '#AFEFD5',
  '#1B172A', '#7C4DFF', '#8654D8', '#38B98E',
  '#7ADDBA', '#CBB5FA', '#4B21C9', '#2D8F70',
];

const ICON_OPTIONS = [
  'utensils', 'coffee', 'wine', 'beef', 'apple', 'cookie', 'ice-cream-cone', 'pizza',
  'car', 'bus', 'fuel', 'plane', 'train-front', 'bike', 'ship',
  'house', 'building-2', 'key-round', 'sofa', 'lamp', 'shower-head',
  'heart-pulse', 'pill', 'dumbbell', 'brain', 'stethoscope', 'syringe',
  'graduation-cap', 'book', 'laptop', 'briefcase', 'notebook-pen',
  'gamepad-2', 'music', 'tv', 'film', 'ticket', 'palette', 'drama',
  'shopping-cart', 'shopping-bag', 'shirt', 'scissors', 'sparkles', 'gem',
  'baby', 'dog', 'cat', 'users',
  'wallet', 'banknote', 'coins', 'credit-card', 'piggy-bank', 'landmark', 'receipt', 'hand-coins',
  'percent', 'trending-up', 'trending-down', 'arrow-up-down', 'calculator', 'file-text', 'scale',
  'circle-dollar-sign', 'badge-dollar-sign', 'chart-line', 'chart-bar', 'chart-pie',
  'wifi', 'zap', 'droplets', 'phone', 'smartphone', 'monitor', 'cloud',
  'gift', 'wrench', 'shield', 'flag', 'star', 'tag', 'bookmark', 'globe',
];

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const IconComp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComp) return <Tag className={className} />;
  return <IconComp className={className} />;
}

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startDate, endDate, label } = useSelectedDate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'tag', color: '#612CFA', keywords: '', parent_id: '' });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const budgetData = useBudgetData();

  const buildCategories = useCallback(async (): Promise<Category[]> => {
    const { data: allCats, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .order('sort_order');

    // Fetch ALL expenses with the fields needed for proper deduplication of recurring templates
    const select = 'id, type, value, final_category, category_ai, date, is_recurring, is_paid, description, wallet_id, credit_card_id, payment_method, project_id';
    const { data: allExpenses, error: expensesError } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user!.id);

    const requestError = categoriesError || expensesError;
    if (requestError) throw requestError;


    // Apply the same deduplication used elsewhere so recurring TEMPLATES that have a real
    // materialized counterpart don't get counted twice (fixes "ghost" duplicates)
    const deduped = hideMaterializedRecurringTemplates((allExpenses || []) as never[]) as Array<{
      type: string; value: number; final_category: string; category_ai?: string | null; date: string;
    }>;

    const countMap: Record<string, number> = {};
    const valueMap: Record<string, number> = {};
    const monthCountMap: Record<string, number> = {};
    const monthValueMap: Record<string, number> = {};
    const monthExpenseValueMap: Record<string, number> = {};
    const monthIncomeValueMap: Record<string, number> = {};
    const monthExpenseCountMap: Record<string, number> = {};
    const monthIncomeCountMap: Record<string, number> = {};
    const correctMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};

    const startStr = startDate;
    const endStr = endDate;

    deduped.forEach(e => {
      const key = (e.final_category || '').toLowerCase();
      countMap[key] = (countMap[key] || 0) + 1;
      if (e.type === 'expense') {
        valueMap[key] = (valueMap[key] || 0) + transactionAmount(e.value);
      }
      if (e.date >= startStr && e.date < endStr) {
        monthCountMap[key] = (monthCountMap[key] || 0) + 1;
        if (e.type === 'expense') {
          monthValueMap[key] = (monthValueMap[key] || 0) + transactionAmount(e.value);
          monthExpenseValueMap[key] = (monthExpenseValueMap[key] || 0) + transactionAmount(e.value);
          monthExpenseCountMap[key] = (monthExpenseCountMap[key] || 0) + 1;
        } else if (e.type === 'income') {
          monthIncomeValueMap[key] = (monthIncomeValueMap[key] || 0) + transactionAmount(e.value);
          monthIncomeCountMap[key] = (monthIncomeCountMap[key] || 0) + 1;
        }
      }
      if (e.category_ai) {
        const ck = (e.final_category || '');
        totalMap[ck] = (totalMap[ck] || 0) + 1;
        if (e.category_ai === e.final_category) {
          correctMap[ck] = (correctMap[ck] || 0) + 1;
        }
      }
    });

    const mapped: Category[] = (allCats || []).map(c => {
      const k = c.name.toLowerCase();
      return {
        ...c,
        expense_count: countMap[k] || 0,
        total_value: valueMap[k] || 0,
        month_count: monthCountMap[k] || 0,
        month_value: monthValueMap[k] || 0,
        month_expense_value: monthExpenseValueMap[k] || 0,
        month_income_value: monthIncomeValueMap[k] || 0,
        month_expense_count: monthExpenseCountMap[k] || 0,
        month_income_count: monthIncomeCountMap[k] || 0,
        ai_accuracy: totalMap[c.name] ? Math.round((correctMap[c.name] || 0) / totalMap[c.name] * 100) : undefined,
      };
    });

    return mapped;
  }, [user, startDate, endDate]);

  const { data: categories = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['categories', 'page', user?.id, startDate, endDate],
    queryFn: buildCategories,
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
  });

  const fetchCategories = useCallback(() => { refetch(); }, [refetch]);


  const openCreateModal = () => {
    setEditingCategory(null);
    setForm({ name: '', icon: 'tag', color: '#612CFA', keywords: '', parent_id: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome da categoria.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);

    if (editingCategory) {
      const { error } = await supabase.from('categories').update({
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        keywords,
        parent_id: form.parent_id || null,
      }).eq('id', editingCategory.id);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else toast({ title: 'Categoria atualizada!' });
    } else {
      const { error } = await supabase.from('categories').insert({
        user_id: user!.id,
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        keywords,
        sort_order: categories.length,
        parent_id: form.parent_id || null,
      });
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else toast({ title: 'Categoria criada!' });
    }
    setSaving(false);
    setModalOpen(false);
    fetchCategories();
  };

  // Stats
  const totalCats = categories.length;
  const parentCategories = categories.filter(category => !category.parent_id);
  const childCategories = categories.filter(category => Boolean(category.parent_id));
  const parentCount = parentCategories.length;
  const subCount = childCategories.length;
  // Expenses are linked by category name. If the user has two category rows
  // with the same name, both rows receive the same totals from the database.
  // Use one representative per normalized name for summaries and rankings so
  // the interface never doubles the user's real values.
  const uniqueCategoriesForStats = Array.from(
    new Map(categories.map(category => [category.name.trim().toLocaleLowerCase('pt-BR'), category])).values(),
  );
  const monthSpend = uniqueCategoriesForStats.reduce((s, c) => s + (c.month_expense_value || 0), 0);
  const monthIncome = uniqueCategoriesForStats.reduce((s, c) => s + (c.month_income_value || 0), 0);
  const monthSpendCount = uniqueCategoriesForStats.reduce((s, c) => s + (c.month_expense_count || 0), 0);
  const monthIncomeCount = uniqueCategoriesForStats.reduce((s, c) => s + (c.month_income_count || 0), 0);
  const budgetByParentId = useMemo(
    () => new Map(budgetData.tree.map(node => [node.category.id, node])),
    [budgetData.tree],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleParentCategories = parentCategories.filter(parent => {
    if (!normalizedQuery) return true;
    return parent.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
      || childCategories.some(child => child.parent_id === parent.id && child.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  });

  if (authLoading) return <PageLoadingSkeleton title="Carregando categorias" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <PageHeader
              eyebrow="Organização"
              title="Categorias"
              description={<>Visão geral de receitas e despesas em <span className="first-letter:uppercase">{label}</span>.</>}
              actions={<>
                <MonthSelector showTodayButton={false} />
                <Button onClick={openCreateModal} className="gap-2 rounded-full h-10 sm:h-11 px-4 sm:px-5 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-sm">
                  <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Nova categoria</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </>}
            />

            {queryError && (
              <StatePanel
                tone="error"
                icon={<TriangleAlert className="h-5 w-5" />}
                title="Não foi possível carregar as categorias"
                description="Os dados podem estar desatualizados. Tente novamente quando a conexão estiver estável."
                actionLabel="Tentar novamente"
                onAction={() => refetch()}
                className="min-h-0 rounded-3xl py-6"
              />
            )}

            {/* Stats Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="surface-card rounded-2xl">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Tag className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Categorias</p>
                    <p className="text-base font-bold sm:text-xl">{loading ? '—' : totalCats}</p>
                    <p className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                      {loading ? 'Sincronizando' : <><span className="block">{parentCount} principais</span><span className="block">{subCount} subcategorias</span></>}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="surface-base rounded-2xl">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><TrendingDown className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Despesas no mês</p>
                    <p className="whitespace-nowrap text-[clamp(0.875rem,3.8vw,1.25rem)] font-bold tracking-tight tabular-nums">{loading ? '—' : formatCurrency(monthSpend)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{monthSpendCount} lançamentos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="surface-base rounded-2xl">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><TrendingUp className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Receitas no mês</p>
                    <p className="whitespace-nowrap text-[clamp(0.875rem,3.8vw,1.25rem)] font-bold tracking-tight tabular-nums">{loading ? '—' : formatCurrency(monthIncome)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{monthIncomeCount} lançamentos</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <section className="space-y-4" aria-labelledby="category-structure-title">
              <div>
                <h2 id="category-structure-title" className="type-title-2">Estrutura de categorias</h2>
                <p className="mt-1 text-sm text-muted-foreground">Organize categorias principais e subcategorias sem perder o histórico dos lançamentos.</p>
              </div>
              <div className="surface-base rounded-3xl p-3 sm:p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Buscar categoria ou subcategoria"
                    aria-label="Buscar categoria ou subcategoria"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

            {/* Categories Grid */}
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Sincronizando categorias">
                {[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-28 rounded-2xl" />)}
                <span className="sr-only">Sincronizando categorias</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {/* Parent categories */}
                {visibleParentCategories.length === 0 && (
                  <StatePanel
                    icon={<Search className="h-5 w-5" />}
                    title={categories.length === 0 ? 'Nenhuma categoria cadastrada' : 'Nenhuma categoria encontrada'}
                    description={categories.length === 0 ? 'Crie a primeira categoria para organizar seus lançamentos.' : 'Altere a busca para visualizar outros resultados.'}
                    actionLabel={normalizedQuery ? 'Limpar busca' : undefined}
                    onAction={normalizedQuery ? () => setQuery('') : undefined}
                  />
                )}
                {visibleParentCategories.map(parent => {
                  const node = budgetByParentId.get(parent.id);
                  const subcategories = childCategories.filter(category => category.parent_id === parent.id);
                  const allocated = node
                    ? Number(node.budget?.allocated_amount || 0) + Object.values(node.childBudgets).reduce((sum, budget) => sum + Number(budget?.allocated_amount || 0), 0)
                    : 0;
                  const spent = Number(node?.spent || parent.month_expense_value || 0);
                  const usage = allocated > 0 ? (spent / allocated) * 100 : 0;
                  const isOver = allocated > 0 && usage >= 100;
                  const isWarning = allocated > 0 && usage >= 80 && usage < 100;

                  return (
                    <Card key={parent.id} className={cn('h-full min-w-0 rounded-2xl', isOver && 'border-destructive/35')}>
                      <CardContent className="flex h-full flex-col gap-3 p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/categorias/${parent.id}`)}
                          className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: parent.color + '20' }}>
                              <LucideIcon name={parent.icon} className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h2 className="break-words text-sm font-semibold leading-tight">{parent.name}</h2>
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{subcategories.length} subcategoria{subcategories.length === 1 ? '' : 's'}</p>
                            </div>
                          </div>

                          <div className="mt-4 w-full space-y-2">
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <p className="shrink-0 text-muted-foreground">Gasto</p>
                              <p className={cn('whitespace-nowrap text-right font-semibold tabular-nums', isOver && 'text-destructive')}>{formatCurrency(spent)}</p>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <p className="shrink-0 text-muted-foreground">Orçamento</p>
                              <p className="whitespace-nowrap text-right font-semibold tabular-nums">{allocated > 0 ? formatCurrency(allocated) : 'Não definido'}</p>
                            </div>
                            <Progress value={Math.min(100, usage)} className={cn('h-2', isOver && '[&>div]:bg-destructive', isWarning && '[&>div]:bg-amber-500')} />
                            <p className={cn('text-[10px] text-muted-foreground', isOver && 'font-medium text-destructive')}>
                              {allocated > 0 ? `${usage.toFixed(0)}% utilizado` : 'Orçamento não definido'}
                            </p>
                          </div>
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            </section>
          </main>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoria Pai (opcional)</Label>
              <select
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhuma (Categoria Principal)</option>
                {categories.filter(c => !c.parent_id && c.id !== editingCategory?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nome da categoria</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Alimentação" className="rounded-xl h-11" />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-10 gap-1.5">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${form.icon === icon ? 'gradient-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
                  >
                    <LucideIcon name={icon} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-lg transition-all ${form.color === color ? 'ring-2 ring-ring ring-offset-2' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Palavras-chave para IA</Label>
              <Textarea
                value={form.keywords}
                onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="restaurante, lanche, comida, delivery"
                className="rounded-xl min-h-[60px]"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula. Ajuda a IA a categorizar melhor.</p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/30">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: form.color + '20' }}>
                  <LucideIcon name={form.icon} className="h-5 w-5" />
                </div>
                <span className="font-semibold">{form.name || 'Nome da categoria'}</span>
                <div className="w-3 h-3 rounded-full ml-auto" style={{ backgroundColor: form.color }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {saving ? 'Salvando...' : editingCategory ? 'Atualizar' : 'Criar Categoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
