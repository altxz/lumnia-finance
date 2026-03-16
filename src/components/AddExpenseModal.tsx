import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
    });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Despesa salva!', description: 'Sua despesa foi registrada com sucesso.' });
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
    setCategoryAi('');
    setFinalCategory('');
  };

  const aiCategoryInfo = categoryAi ? getCategoryInfo(categoryAi) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova Despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="expense-date">Data</Label>
            <Input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Descrição detalhada</Label>
            <Input
              id="expense-desc"
              placeholder="Ex: Almoço no restaurante do centro"
              value={description}
              onChange={e => setDescription(e.target.value)}
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
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria sugerida pela IA</Label>
              <Button
                variant="ai"
                size="sm"
                onClick={handleAiCategorize}
                disabled={aiLoading || !description.trim()}
                className="gap-1.5"
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
              <SelectTrigger>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="success" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Despesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
