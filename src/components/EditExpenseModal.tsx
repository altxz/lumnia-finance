import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X, Trash2 } from 'lucide-react';
import { CategoryPicker } from '@/components/CategoryPicker';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Expense } from '@/components/ExpenseTable';

interface EditExpenseModalProps {
  open: boolean;
  expense: Expense;
  onOpenChange: (open: boolean) => void;
  onExpenseUpdated: () => void;
}

const TYPE_STYLES = {
  expense: { bg: 'bg-destructive/10', border: 'border-destructive/20', accent: 'bg-destructive text-destructive-foreground hover:bg-destructive/90', valueBorder: 'border-destructive/30 focus-within:border-destructive' },
  income: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accent: 'bg-emerald-600 text-white hover:bg-emerald-700', valueBorder: 'border-emerald-500/30 focus-within:border-emerald-500' },
  transfer: { bg: 'bg-primary/10', border: 'border-primary/20', accent: 'bg-primary text-primary-foreground hover:bg-primary/90', valueBorder: 'border-primary/30 focus-within:border-primary' },
} as const;

export function EditExpenseModal({ open, expense, onOpenChange, onExpenseUpdated }: EditExpenseModalProps) {
  const [date, setDate] = useState(expense.date);
  const [description, setDescription] = useState(expense.description);
  const [value, setValue] = useState(String(expense.value));
  const [type] = useState<'income' | 'expense' | 'transfer'>(expense.type);
  const [finalCategory, setFinalCategory] = useState(expense.final_category);
  const [walletId, setWalletId] = useState(expense.wallet_id || '');
  const [isPaid, setIsPaid] = useState(expense.is_paid);
  const [notes, setNotes] = useState(expense.notes || '');
  const [tags, setTags] = useState<string[]>(expense.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; parent_id: string | null; icon: string; color: string }[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const style = TYPE_STYLES[type];

  useEffect(() => {
    if (!user || !open) return;
    Promise.all([
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('categories').select('id, name, parent_id, icon, color').eq('user_id', user.id).eq('active', true).order('sort_order'),
    ]).then(([walletsRes, catsRes]) => {
      setWallets(walletsRes.data || []);
      setDbCategories(catsRes.data || []);
    });
  }, [user, open]);

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!description.trim() || !value || !finalCategory) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('expenses').update({
      date, description: description.trim(), value: parseFloat(value),
      final_category: finalCategory, wallet_id: walletId || null,
      is_paid: isPaid, notes: notes.trim() || null,
      tags: tags.length > 0 ? tags : null,
    }).eq('id', expense.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transação atualizada!' });
      onExpenseUpdated();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transação excluída' });
      onExpenseUpdated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className={`p-4 pb-0 rounded-t-2xl transition-colors duration-200 ${style.bg}`}>
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {type === 'income' ? <ArrowUpCircle className="h-5 w-5 text-emerald-600" /> : type === 'transfer' ? <ArrowLeftRight className="h-5 w-5 text-primary" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
              Editar {type === 'income' ? 'Receita' : type === 'transfer' ? 'Transferência' : 'Despesa'}
            </DialogTitle>
          </DialogHeader>
          <div className={`mt-2 mb-3 rounded-xl border-2 bg-background/80 backdrop-blur-sm transition-colors ${style.valueBorder}`}>
            <div className="flex items-center px-4 py-3">
              <span className="text-lg font-bold text-muted-foreground mr-2">R$</span>
              <input type="number" step="0.01" min="0" value={value} onChange={e => setValue(e.target.value)}
                className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>
        </div>

        <div className="p-4 pt-2 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
          </div>

          {type !== 'transfer' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl h-11" />
              </div>

              {wallets.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta</Label>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
                <CategoryPicker
                  categories={dbCategories}
                  value={finalCategory}
                  onValueChange={setFinalCategory}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <span className="text-sm font-medium">{type === 'income' ? 'Recebido' : 'Pago'}</span>
                  <p className="text-xs text-muted-foreground">{type === 'income' ? 'Já recebeu este valor?' : 'Já efetuou o pagamento?'}</p>
                </div>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="more" className="border rounded-xl px-3">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">Mais Opções</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pb-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl min-h-[80px] resize-none" placeholder="Observações..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</Label>
                        <div className="flex gap-2">
                          <Input placeholder="Adicionar tag..." value={tagInput} onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                            className="rounded-xl h-9 text-sm" />
                          <Button type="button" variant="outline" size="sm" onClick={handleAddTag} className="rounded-xl h-9 px-3">+</Button>
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                {tag}
                                <button onClick={() => setTags(tags.filter(t => t !== tag))} className="ml-0.5 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 gap-2 flex-row justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-xl">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className={`rounded-xl font-semibold transition-colors ${style.accent}`}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
