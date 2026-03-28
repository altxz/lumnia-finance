import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function QuickAddModal({ open, onOpenChange, onCreated }: QuickAddModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('alimentacao');
  const [saving, setSaving] = useState(false);
  const [defaultWalletId, setDefaultWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    // Get most used wallet (by expense count) or first one
    supabase
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setDefaultWalletId(data?.[0]?.id || null);
      });
  }, [open, user]);

  const reset = () => {
    setValue('');
    setCategory('alimentacao');
    setType('expense');
  };

  const handleSave = async () => {
    if (!user) return;
    const numValue = parseFloat(value.replace(',', '.'));
    if (!numValue || numValue <= 0) {
      toast({ title: 'Valor inválido', description: 'Insira um valor positivo.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      description: type === 'income' ? 'Receita rápida' : 'Despesa rápida',
      value: numValue,
      type,
      final_category: type === 'income' ? 'salary' : category,
      date: format(new Date(), 'yyyy-MM-dd'),
      is_paid: true,
      wallet_id: defaultWalletId,
    });

    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lançamento criado!', description: `${type === 'income' ? 'Receita' : 'Despesa'} de R$ ${numValue.toFixed(2)} registrada.` });
      reset();
      onOpenChange(false);
      onCreated?.();
    }
  };

  const isExpense = type === 'expense';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="w-[95vw] max-w-sm overflow-hidden sm:w-full p-0 gap-0 rounded-2xl">
        {/* Type toggle */}
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
              isExpense
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <TrendingDown className="h-5 w-5" />
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
              !isExpense
                ? 'bg-emerald-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            Receita
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Value input */}
          <div className="text-center">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Valor</label>
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className={`text-2xl font-bold ${isExpense ? 'text-destructive' : 'text-emerald-600'}`}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                autoFocus
                className={`text-4xl font-bold bg-transparent border-none outline-none text-center w-40 placeholder:text-muted-foreground/30 ${
                  isExpense ? 'text-destructive' : 'text-emerald-600'
                }`}
              />
            </div>
          </div>

          {/* Category (only for expenses) */}
          {isExpense && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving || !value}
            className={`w-full h-12 rounded-xl text-base font-bold ${
              isExpense
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
