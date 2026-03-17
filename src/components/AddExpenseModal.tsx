import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2 } from 'lucide-react';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
}

export function AddExpenseModal({ open, onOpenChange, onExpenseAdded }: AddExpenseModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<string>('monthly');
  const [categoryAi, setCategoryAi] = useState('');
  const [finalCategory, setFinalCategory] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAiCategorize = async () => {
    if (!description.trim()) {
      toast({ title: 'Erro', description: 'Preencha a descrição antes de categorizar.', variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    try {
      const response = await supabase.functions.invoke('categorize-expense', {
        body: { description: description.trim() },
      });
      if (response.error) throw response.error;
      const category = response.data?.category || 'outros';
      setCategoryAi(category);
      setFinalCategory(category);
    } catch (err) {
      console.error('AI categorization error:', err);
      setCategoryAi('outros');
      setFinalCategory('outros');
      toast({ title: 'Aviso', description: 'Não foi possível categorizar com IA. Categoria definida como "Outros".' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!description.trim() || !value || !finalCategory) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user?.id,
      date,
      description: description.trim(),
      value: parseFloat(value),
      category_ai: categoryAi || null,
      final_category: finalCategory,
      type,
      is_recurring: isRecurring,
      frequency: isRecurring ? frequency : null,
    });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: type === 'income' ? 'Receita salva!' : 'Despesa salva!', description: 'Registro salvo com sucesso.' });
      resetForm();
      onOpenChange(false);
      onExpenseAdded();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setValue('');
    setType('expense');
    setIsRecurring(false);
    setFrequency('monthly');
    setCategoryAi('');
    setFinalCategory('');
  };

  const aiCategoryInfo = categoryAi ? getCategoryInfo(categoryAi) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Transação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>↓</span> Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>↑</span> Receita
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-date">Data</Label>
            <Input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Descrição detalhada</Label>
            <Input
              id="expense-desc"
              placeholder="Ex: Almoço no restaurante do centro"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-value">Valor (R$)</Label>
            <Input
              id="expense-value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-muted-foreground accent-primary"
            />
            <div>
              <span className="text-sm font-medium">Transação recorrente / assinatura</span>
              <p className="text-xs text-muted-foreground">Conta fixa mensal ou anual</p>
            </div>
          </label>
          {isRecurring && (
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria sugerida pela IA</Label>
              <Button
                variant="ai"
                size="sm"
                onClick={handleAiCategorize}
                disabled={aiLoading || !description.trim()}
                className="gap-1.5 rounded-xl"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiLoading ? 'Processando...' : 'Categorizar com IA'}
              </Button>
            </div>
            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-ai">
                <div className="w-2 h-2 rounded-full bg-ai animate-pulse-slow" />
                Analisando despesa...
              </div>
            )}
            {aiCategoryInfo && !aiLoading && (
              <Badge variant={aiCategoryInfo.variant}>{aiCategoryInfo.label}</Badge>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="final-category">Categoria final</Label>
            <Select value={finalCategory} onValueChange={setFinalCategory}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}