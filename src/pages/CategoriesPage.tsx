import { useState, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusCircle, Pencil, BarChart3, Trash2, Tag, Loader2, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { MonthSelector } from '@/components/MonthSelector';
import { hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';
import { formatCurrency } from '@/lib/constants';
import { useSelectedDate } from '@/contexts/DateContext';
import { useToast } from '@/hooks/use-toast';
import { icons } from 'lucide-react';

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

  const buildCategories = useCallback(async (): Promise<Category[]> => {
    const { data: allCats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .order('sort_order');

    // Fetch ALL expenses with the fields needed for proper deduplication of recurring templates
    const select = 'id, type, value, final_category, category_ai, date, is_recurring, is_paid, description, wallet_id, credit_card_id, payment_method, project_id';
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select(select)
      .eq('user_id', user!.id);


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
        valueMap[key] = (valueMap[key] || 0) + Number(e.value || 0);
      }
      if (e.date >= startStr && e.date < endStr) {
        monthCountMap[key] = (monthCountMap[key] || 0) + 1;
        if (e.type === 'expense') {
          monthValueMap[key] = (monthValueMap[key] || 0) + Number(e.value || 0);
          monthExpenseValueMap[key] = (monthExpenseValueMap[key] || 0) + Number(e.value || 0);
          monthExpenseCountMap[key] = (monthExpenseCountMap[key] || 0) + 1;
        } else if (e.type === 'income') {
          monthIncomeValueMap[key] = (monthIncomeValueMap[key] || 0) + Number(e.value || 0);
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

  const { data: categories = [], isLoading: loading, refetch } = useQuery({
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

  const openAddSubModal = (parentId: string) => {
    setEditingCategory(null);
    setForm({ name: '', icon: 'tag', color: '#612CFA', keywords: '', parent_id: parentId });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, keywords: (cat.keywords || []).join(', '), parent_id: cat.parent_id || '' });
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Categoria excluída' }); fetchCategories(); }
  };

  // Stats
  const totalCats = categories.length;
  const parentCount = categories.filter(c => !c.parent_id).length;
  const subCount = categories.filter(c => c.parent_id).length;
  const monthSpend = categories.reduce((s, c) => s + (c.month_expense_value || 0), 0);
  const monthIncome = categories.reduce((s, c) => s + (c.month_income_value || 0), 0);
  const monthSpendCount = categories.reduce((s, c) => s + (c.month_expense_count || 0), 0);
  const monthIncomeCount = categories.reduce((s, c) => s + (c.month_income_count || 0), 0);
  const expenseTopRanking = [...categories]
    .filter(c => (c.month_expense_value || 0) > 0)
    .sort((a, b) => (b.month_expense_value || 0) - (a.month_expense_value || 0))
    .slice(0, 5);
  const incomeTopRanking = [...categories]
    .filter(c => (c.month_income_value || 0) > 0)
    .sort((a, b) => (b.month_income_value || 0) - (a.month_income_value || 0))
    .slice(0, 5);
  const topCategory = expenseTopRanking[0];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categorias</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 capitalize">Visão geral · {label}</p>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <MonthSelector />
                <Button onClick={openCreateModal} className="gap-2 rounded-xl h-10 sm:h-11 px-3 sm:px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-sm">
                  <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Nova Categoria</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-0 shadow-float gradient-primary text-primary-foreground">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-primary-foreground/20 flex items-center justify-center shrink-0"><Tag className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium opacity-80">Categorias</p>
                    <p className="text-base sm:text-xl font-bold">{totalCats}</p>
                    <p className="text-[10px] opacity-70 truncate">{parentCount} principais · {subCount} subs</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-card">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><TrendingDown className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Despesas no mês</p>
                    <p className="text-base sm:text-xl font-bold truncate">{formatCurrency(monthSpend)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{monthSpendCount} lançamentos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-card">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><TrendingUp className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Receitas no mês</p>
                    <p className="text-base sm:text-xl font-bold truncate">{formatCurrency(monthIncome)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{monthIncomeCount} lançamentos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-card">
                <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><ArrowUpRight className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Top categoria</p>
                    <p className="text-sm sm:text-base font-bold truncate">{topCategory?.name || '—'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{topCategory ? formatCurrency(topCategory.month_expense_value || 0) : 'Sem gastos'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Rankings: Despesas e Receitas separados */}
            <div className="grid gap-4 lg:grid-cols-2">
              {expenseTopRanking.length > 0 && (
                <Card className="rounded-2xl border-0 shadow-card">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                        <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
                        <span className="truncate">Top despesas</span>
                      </h2>
                      <Badge variant="outline" className="rounded-lg text-[10px] shrink-0">Top {expenseTopRanking.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {expenseTopRanking.map((c, idx) => {
                        const pct = monthSpend > 0 ? ((c.month_expense_value || 0) / monthSpend) * 100 : 0;
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => navigate(`/categorias/${c.id}`)}
                            className="w-full flex items-center gap-2 sm:gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                          >
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold">
                              {idx + 1}
                            </div>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.color + '20' }}>
                              <LucideIcon name={c.icon} className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                                <span className="font-medium truncate">{c.name}</span>
                                <span className="text-muted-foreground shrink-0 tabular-nums">{formatCurrency(c.month_expense_value || 0)} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: c.color }} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {incomeTopRanking.length > 0 && (
                <Card className="rounded-2xl border-0 shadow-card">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                        <TrendingUp className="h-4 w-4 text-success shrink-0" />
                        <span className="truncate">Top receitas</span>
                      </h2>
                      <Badge variant="outline" className="rounded-lg text-[10px] shrink-0">Top {incomeTopRanking.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {incomeTopRanking.map((c, idx) => {
                        const pct = monthIncome > 0 ? ((c.month_income_value || 0) / monthIncome) * 100 : 0;
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => navigate(`/categorias/${c.id}`)}
                            className="w-full flex items-center gap-2 sm:gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                          >
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold bg-success/15 text-success">
                              {idx + 1}
                            </div>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.color + '20' }}>
                              <LucideIcon name={c.icon} className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                                <span className="font-medium truncate">{c.name}</span>
                                <span className="text-muted-foreground shrink-0 tabular-nums">{formatCurrency(c.month_income_value || 0)} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Categories Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-6">
                {/* Parent categories */}
                {categories.filter(c => !c.sort_order || !categories.some(p => p.id !== c.id && categories.some(ch => ch.id === c.id))).length === 0 && (
                  <p className="text-muted-foreground text-center py-8">Nenhuma categoria encontrada.</p>
                )}
                {(() => {
                  const parents = categories.filter(c => {
                    // Find items where no other category has this as child (parent_id match)
                    // Since we don't have parent_id in our Category interface yet, use the DB data directly
                    return !(c as any).parent_id;
                  });
                  const children = categories.filter(c => !!(c as any).parent_id);

                  return parents.map(parent => {
                    const subs = children.filter(c => (c as any).parent_id === parent.id);
                    return (
                      <div key={parent.id} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/categorias/${parent.id}`)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl -mx-1 px-1 py-1 hover:bg-secondary/50 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: parent.color + '20' }}>
                              <LucideIcon name={parent.icon} className="h-4 w-4" />
                            </div>
                            <h2 className="text-lg font-bold truncate">{parent.name}</h2>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: parent.color }} />
                            <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{parent.month_count || 0} no mês</span>
                            {(parent.month_value || 0) > 0 && (
                              <Badge variant="secondary" className="rounded-lg text-[10px] shrink-0">{formatCurrency(parent.month_value || 0)}</Badge>
                            )}
                          </button>
                          <div className="flex gap-1 ml-auto">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-primary" onClick={() => openAddSubModal(parent.id)}><PlusCircle className="h-3.5 w-3.5" /></Button>
                              </TooltipTrigger>
                              <TooltipContent>Adicionar subcategoria</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => openEditModal(parent)}><Pencil className="h-3.5 w-3.5" /></Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                                  <AlertDialogDescription>Todas as subcategorias também serão removidas.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(parent.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {subs.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pl-4 border-l-2" style={{ borderColor: parent.color + '40' }}>
                            {subs.map(cat => (
                              <Card key={cat.id} className="rounded-2xl border shadow-soft hover:shadow-card transition-shadow">
                                <CardContent className="p-4 space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/categorias/${cat.id}`)}
                                    className="flex items-center gap-3 w-full text-left rounded-xl -m-1 p-1 hover:bg-secondary/50 transition-colors"
                                  >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                                      <LucideIcon name={cat.icon} className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="font-semibold text-sm truncate">{cat.name}</h3>
                                      <p className="text-xs text-muted-foreground">
                                        {(cat.month_value || 0) > 0
                                          ? <span className="font-medium">{formatCurrency(cat.month_value || 0)}</span>
                                          : <span>0 no mês</span>}
                                        <span> · {cat.month_count || 0} lanç.</span>
                                      </p>
                                    </div>
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  </button>
                                  {cat.keywords && cat.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {cat.keywords.slice(0, 3).map(k => (
                                        <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">{k}</Badge>
                                      ))}
                                      {cat.keywords.length > 3 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{cat.keywords.length - 3}</Badge>}
                                    </div>
                                  )}
                                  <div className="flex gap-1 pt-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={() => openEditModal(cat)}><Pencil className="h-3 w-3" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar</TooltipContent>
                                    </Tooltip>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir subcategoria?</AlertDialogTitle>
                                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
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
