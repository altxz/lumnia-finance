import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
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
import { PlusCircle, Pencil, Eye, BarChart3, Trash2, Tag, Loader2 } from 'lucide-react';
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
  expense_count?: number;
  ai_accuracy?: number;
}

const PRESET_COLORS = [
  '#5447BC', '#4B6DFB', '#DA90FC', '#BEEE62',
  '#F97316', '#EF4444', '#14B8A6', '#F59E0B',
  '#EC4899', '#8B5CF6', '#06B6D4', '#84CC16',
];

const ICON_OPTIONS = [
  'utensils', 'car', 'gamepad-2', 'heart-pulse', 'house', 'graduation-cap',
  'tag', 'shopping-cart', 'plane', 'shirt', 'wifi', 'baby', 'dog', 'music',
  'dumbbell', 'scissors', 'wrench', 'gift', 'coffee', 'book',
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'tag', color: '#5447BC', keywords: '' });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch user custom categories
    const { data: customCats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order');

    // Fetch expense counts per category
    const { data: expenses } = await supabase
      .from('expenses')
      .select('final_category, category_ai')
      .eq('user_id', user.id);

    const countMap: Record<string, number> = {};
    const correctMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};

    (expenses || []).forEach(e => {
      countMap[e.final_category] = (countMap[e.final_category] || 0) + 1;
      if (e.category_ai) {
        totalMap[e.final_category] = (totalMap[e.final_category] || 0) + 1;
        if (e.category_ai === e.final_category) {
          correctMap[e.final_category] = (correctMap[e.final_category] || 0) + 1;
        }
      }
    });

    // Merge default + custom categories
    const defaults: Category[] = CATEGORIES.map((c, i) => ({
      id: `default-${c.value}`,
      name: c.label,
      icon: c.value === 'alimentacao' ? 'utensils' : c.value === 'transporte' ? 'car' : c.value === 'lazer' ? 'gamepad-2' : c.value === 'saude' ? 'heart-pulse' : c.value === 'moradia' ? 'house' : c.value === 'educacao' ? 'graduation-cap' : 'tag',
      color: c.value === 'alimentacao' ? '#F97316' : c.value === 'transporte' ? '#4B6DFB' : c.value === 'lazer' ? '#DA90FC' : c.value === 'saude' ? '#EF4444' : c.value === 'moradia' ? '#14B8A6' : c.value === 'educacao' ? '#F59E0B' : '#8B5CF6',
      keywords: [],
      active: true,
      sort_order: i,
      expense_count: countMap[c.value] || 0,
      ai_accuracy: totalMap[c.value] ? Math.round((correctMap[c.value] || 0) / totalMap[c.value] * 100) : undefined,
    }));

    const custom = (customCats || []).map(c => ({
      ...c,
      expense_count: countMap[c.name.toLowerCase()] || 0,
      ai_accuracy: undefined,
    }));

    setCategories([...defaults, ...custom]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm({ name: '', icon: 'tag', color: '#5447BC', keywords: '' });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    if (cat.id.startsWith('default-')) return;
    setEditingCategory(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color, keywords: (cat.keywords || []).join(', ') });
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
  const withAccuracy = categories.filter(c => c.ai_accuracy !== undefined);
  const avgAccuracy = withAccuracy.length ? Math.round(withAccuracy.reduce((s, c) => s + (c.ai_accuracy || 0), 0) / withAccuracy.length) : 0;
  const totalExpenses = categories.reduce((s, c) => s + (c.expense_count || 0), 0);
  const correctedCount = categories.reduce((s, c) => {
    if (c.ai_accuracy !== undefined && c.ai_accuracy < 100) return s + 1;
    return s;
  }, 0);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Gerenciar Categorias</h1>
                <p className="text-sm text-muted-foreground mt-1">Configure categorias e melhore a precisão da IA</p>
              </div>
              <Button onClick={openCreateModal} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" />
                Nova Categoria
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary-foreground/20 flex items-center justify-center"><Tag className="h-6 w-6" /></div>
                  <div><p className="text-sm font-medium opacity-80">Total de Categorias</p><p className="text-2xl font-bold">{totalCats}</p></div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-ai text-ai-foreground">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-ai-foreground/20 flex items-center justify-center"><BarChart3 className="h-6 w-6" /></div>
                  <div><p className="text-sm font-medium opacity-80">Precisão da IA</p><p className="text-2xl font-bold">{avgAccuracy}%</p></div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-pink-foreground/10 flex items-center justify-center"><Pencil className="h-6 w-6" /></div>
                  <div><p className="text-sm font-medium opacity-80">Correções Manuais</p><p className="text-2xl font-bold">{correctedCount}</p></div>
                </CardContent>
              </Card>
            </div>

            {/* Categories Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories.map(cat => (
                  <Card key={cat.id} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                          <LucideIcon name={cat.icon} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{cat.name}</h3>
                          <p className="text-xs text-muted-foreground">{cat.expense_count || 0} despesas</p>
                        </div>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      </div>

                      {cat.ai_accuracy !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-ai transition-all" style={{ width: `${cat.ai_accuracy}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{cat.ai_accuracy}%</span>
                        </div>
                      )}

                      {cat.keywords && cat.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cat.keywords.slice(0, 3).map(k => (
                            <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">{k}</Badge>
                          ))}
                          {cat.keywords.length > 3 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{cat.keywords.length - 3}</Badge>}
                        </div>
                      )}

                      <div className="flex gap-1 pt-1">
                        {!cat.id.startsWith('default-') && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => openEditModal(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
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
                                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><Eye className="h-3.5 w-3.5" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver despesas</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${form.icon === icon ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
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
