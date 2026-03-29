import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

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
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit');
  const [creditCardId, setCreditCardId] = useState('');
  const [creditCards, setCreditCards] = useState<{ id: string; name: string; closing_day: number; due_day: number; closing_strategy: string; closing_days_before_due: number }[]>([]);
  const [installments, setInstallments] = useState('1');
  const [installmentValueType, setInstallmentValueType] = useState<'total' | 'per_installment'>('total');

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      supabase.from('wallets').select('id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1),
      supabase.from('credit_cards').select('id, name, closing_day, due_day, closing_strategy, closing_days_before_due').eq('user_id', user.id).order('name'),
    ]).then(([walletsRes, cardsRes]) => {
      setDefaultWalletId(walletsRes.data?.[0]?.id || null);
      setCreditCards(cardsRes.data || []);
    });
  }, [open, user]);

  const isCredit = type === 'expense' && paymentMethod === 'credit';
  const numInstallments = isCredit ? (parseInt(installments) || 1) : 1;

  const selectedCard = useMemo(() => creditCards.find(c => c.id === creditCardId), [creditCards, creditCardId]);

  function calcInvoiceMonth(card: typeof creditCards[0], expenseDate: string): string {
    const d = new Date(expenseDate + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    let closingDay = card.closing_strategy === 'relative'
      ? (card.due_day - card.closing_days_before_due <= 0 ? card.due_day - card.closing_days_before_due + 30 : card.due_day - card.closing_days_before_due)
      : card.closing_day;
    if (day < closingDay) {
      return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
    const next = new Date(year, month + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }

  const reset = () => {
    setValue('');
    setCategory('alimentacao');
    setType('expense');
    setPaymentMethod('debit');
    setCreditCardId('');
    setInstallments('1');
    setInstallmentValueType('total');
  };

  const handleSave = async () => {
    if (!user) return;
    const numValue = parseFloat(value.replace(',', '.'));
    if (!numValue || numValue <= 0) {
      toast({ title: 'Valor inválido', description: 'Insira um valor positivo.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    if (isCredit && numInstallments > 1 && selectedCard) {
      const groupId = crypto.randomUUID();
      const perInstallment = installmentValueType === 'total'
        ? Math.round((numValue / numInstallments) * 100) / 100
        : numValue;
      const baseInvoice = calcInvoiceMonth(selectedCard, today);
      const [baseY, baseM] = baseInvoice.split('-').map(Number);

      const rows = Array.from({ length: numInstallments }, (_, i) => {
        const m = new Date(baseY, baseM - 1 + i, 1);
        const im = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
        return {
          user_id: user.id,
          description: `Despesa rápida (${i + 1}/${numInstallments})`,
          value: perInstallment,
          type: 'expense' as const,
          final_category: category,
          date: today,
          is_paid: false,
          payment_method: 'credit',
          credit_card_id: creditCardId,
          installments: numInstallments,
          installment_group_id: groupId,
          installment_info: `${i + 1}/${numInstallments}`,
          invoice_month: im,
        };
      });

      const { error } = await supabase.from('expenses').insert(rows);
      setSaving(false);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Parcelas criadas!', description: `${numInstallments} parcelas salvas.` });
        reset();
        onOpenChange(false);
        onCreated?.();
      }
    } else {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        description: type === 'income' ? 'Receita rápida' : 'Despesa rápida',
        value: numValue,
        type,
        final_category: type === 'income' ? 'salary' : category,
        date: today,
        is_paid: isCredit ? false : true,
        wallet_id: isCredit ? null : defaultWalletId,
        payment_method: isCredit ? 'credit' : 'debit',
        credit_card_id: isCredit ? creditCardId : null,
        invoice_month: isCredit && selectedCard ? calcInvoiceMonth(selectedCard, today) : null,
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
            <>
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

              {/* Payment method */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                <button type="button" onClick={() => { setPaymentMethod('debit'); setCreditCardId(''); setInstallments('1'); }}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${paymentMethod === 'debit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  💳 Débito
                </button>
                <button type="button" onClick={() => setPaymentMethod('credit')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${paymentMethod === 'credit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  <CreditCard className="h-3.5 w-3.5 inline mr-1" />Crédito
                </button>
              </div>

              {/* Credit card fields */}
              {paymentMethod === 'credit' && creditCards.length > 0 && (
                <>
                  <Select value={creditCardId} onValueChange={setCreditCardId}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>
                      {creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {creditCardId && (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Parcelas</label>
                        <Input type="number" min="1" max="72" value={installments} onChange={e => setInstallments(e.target.value)} className="rounded-xl h-11" />
                      </div>
                    </div>
                  )}
                  {creditCardId && parseInt(installments) > 1 && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                        <button type="button" onClick={() => setInstallmentValueType('total')}
                          className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${installmentValueType === 'total' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                          Valor Total
                        </button>
                        <button type="button" onClick={() => setInstallmentValueType('per_installment')}
                          className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${installmentValueType === 'per_installment' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                          Valor da Parcela
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">
                        {installmentValueType === 'total'
                          ? `${installments}x de R$ ${value ? (parseFloat(value.replace(',', '.')) / parseInt(installments)).toFixed(2) : '0,00'}`
                          : `Total: R$ ${value ? (parseFloat(value.replace(',', '.')) * parseInt(installments)).toFixed(2) : '0,00'}`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
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
