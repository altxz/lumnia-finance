import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Pencil, Trash2, Tag, Loader2, ChevronRight } from 'lucide-react';
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
  'wallet', 'banknote', 'landmark', 'key-round', 'building-2', 'zap',
  'droplets', 'fuel', 'bus', 'pill', 'brain', 'tv', 'wine', 'laptop',
];

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const IconComp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComp) return <Tag className={className} />;
  return <IconComp className={className} />;
}

export function CategoriesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: '',
    icon: 'tag',
    color: '#5447BC',
    keywords: '',
    type: 'parent' as 'parent' | 'sub',
    parent_id: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order');
    setCategories(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: '', icon: 'tag', color: '#5447BC', keywords: '', type: 'parent', parent_id: '' });
    setModalOpen(true);
  };

  const openAddSub = (parentId: string) => {
    setEditingCategory(null);
    setForm({ name: '', icon: 'tag', color: '#5447BC', keywords: '', type: 'sub', parent_id: parentId });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      keywords: (cat.keywords || []).join(', '),
      type: cat.parent_id ? 'sub' : 'parent',
      parent_id: cat.parent_id || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome da categoria.', variant: 'destructive' });
      return;
    }
    if (form.type === 'sub' && !form.parent_id) {
      toast({ title: 'Erro', description: 'Selecione a categoria pai.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
    const parentId = form.type === 'sub' ? form.parent_id : null;

    if (editingCategory) {
      const { error } = await supabase.from('categories').update({
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        keywords,
        parent_id: parentId,
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
        parent_id: parentId,
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

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Categorias ({categories.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pb-4">
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria encontrada.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {parents.map(parent => {
                const subs = getChildren(parent.id);
                return (
                  <AccordionItem key={parent.id} value={parent.id} className="border-b-0">
                    <div className="flex items-center gap-2 group">
                      <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: parent.color + '20' }}
                          >
                            <LucideIcon name={parent.icon} className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm">{parent.name}</span>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: parent.color }} />
                          {subs.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              {subs.length} sub
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-primary" onClick={(e) => { e.stopPropagation(); openAddSub(parent.id); }} title="Adicionar subcategoria">
                          <PlusCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); openEdit(parent); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir "{parent.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {subs.length > 0
                                  ? `Esta ação irá excluir a categoria e as suas ${subs.length} subcategoria(s). Não pode ser desfeita.`
                                  : 'Esta ação não pode ser desfeita.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(parent.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <AccordionContent className="pb-2">
                      {subs.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-11 py-2">Sem subcategorias</p>
                      ) : (
                        <div className="space-y-0.5 pl-6 border-l-2 ml-4" style={{ borderColor: parent.color + '30' }}>
                          {subs.map(sub => (
                            <div
                              key={sub.id}
                              className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-secondary/50 transition-colors group/sub"
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: sub.color + '20' }}
                              >
                                <LucideIcon name={sub.icon} className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm flex-1">{sub.name}</span>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                              {sub.keywords && sub.keywords.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                                  {sub.keywords.length} keywords
                                </Badge>
                              )}
                              <div className="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={() => openEdit(sub)}>
                                  <Pencil className="h-2.5 w-2.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir "{sub.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(sub.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Big Create Button */}
      <Button
        onClick={openCreate}
        className="w-full h-14 rounded-2xl gap-3 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
      >
        <PlusCircle className="h-6 w-6" />
        Criar Nova Categoria
      </Button>

      {/* Category Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <RadioGroup
                value={form.type}
                onValueChange={(v: 'parent' | 'sub') => setForm(f => ({ ...f, type: v, parent_id: v === 'parent' ? '' : f.parent_id }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="parent" id="type-parent" />
                  <Label htmlFor="type-parent" className="cursor-pointer font-normal">Categoria Principal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sub" id="type-sub" />
                  <Label htmlFor="type-sub" className="cursor-pointer font-normal">Subcategoria</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Parent selector (only for subcategories) */}
            {form.type === 'sub' && (
              <div className="space-y-2">
                <Label>Categoria Pai <span className="text-destructive">*</span></Label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {parents.filter(p => p.id !== editingCategory?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Alimentação"
                className="rounded-xl h-11"
              />
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-10 gap-1.5 max-h-32 overflow-y-auto">
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

            {/* Color */}
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

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Palavras-chave para IA</Label>
              <Textarea
                value={form.keywords}
                onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="restaurante, lanche, comida"
                className="rounded-xl min-h-[60px]"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/30">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: form.color + '20' }}>
                  <LucideIcon name={form.icon} className="h-4 w-4" />
                </div>
                {form.type === 'sub' && form.parent_id && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {parents.find(p => p.id === form.parent_id)?.name}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <span className="font-semibold text-sm">{form.name || 'Nome'}</span>
                <div className="w-2.5 h-2.5 rounded-full ml-auto" style={{ backgroundColor: form.color }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
            >
              {saving ? 'Salvando...' : editingCategory ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
