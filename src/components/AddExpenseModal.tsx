import { useState, useEffect, useMemo } from 'react';
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

interface CreditCardOption {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  closing_strategy: string;
  closing_days_before_due: number;
}

interface WalletOption {
  id: string;
  name: string;
}

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
}

function calcInvoiceMonth(card: CreditCardOption, expenseDate: string): string {
  const d = new Date(expenseDate + 'T12:00:00');
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  let closingDay: number;
  if (card.closing_strategy === 'relative') {
    closingDay = card.due_day - card.closing_days_before_due;
    if (closingDay <= 0) closingDay += 30; // wrap around
  } else {
    closingDay = card.closing_day;
  }

  // If expense date is before closing day → invoice is current month
  // If expense date is on or after closing day → invoice is next month
  if (day < closingDay) {
    const m = month + 1; // 1-indexed
    return `${year}-${String(m).padStart(2, '0')}`;
  } else {
    const next = new Date(year, month + 1, 1);
    const m = next.getMonth() + 1;
    return `${next.getFullYear()}-${String(m).padStart(2, '0')}`;
  }
}

function formatInvoiceLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function generateInvoiceOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = -2; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth() + 1;
    options.push(`${d.getFullYear()}-${String(m).padStart(2, '0')}`);
  }
  return options;
}

export function AddExpenseModal({ open, onOpenChange, onExpenseAdded }: AddExpenseModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit');
  const [destinationWalletId, setDestinationWalletId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<string>('monthly');
  const [creditCardId, setCreditCardId] = useState<string>('');
  const [installments, setInstallments] = useState('1');
  const [walletId, setWalletId] = useState<string>('');
  const [invoiceMonth, setInvoiceMonth] = useState<string>('');
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([]);
  const [categoryAi, setCategoryAi] = useState('');
  const [finalCategory, setFinalCategory] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !open) return;
    Promise.all([
      supabase.from('credit_cards').select('id, name, closing_day, due_day, closing_strategy, closing_days_before_due').eq('user_id', user.id).order('name'),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
    ]).then(([cards, walletsRes]) => {
      setCreditCards((cards.data || []) as CreditCardOption[]);
      setWallets((walletsRes.data || []) as WalletOption[]);
    });
  }, [user, open]);

  // Auto-calculate invoice_month when card or date changes
  const selectedCard = useMemo(() => creditCards.find(c => c.id === creditCardId), [creditCards, creditCardId]);

  useEffect(() => {
    if (paymentMethod === 'credit' && selectedCard && date) {
      setInvoiceMonth(calcInvoiceMonth(selectedCard, date));
    }
  }, [paymentMethod, selectedCard, date]);

  const invoiceOptions = useMemo(() => generateInvoiceOptions(), []);

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
    const isTransfer = type === 'transfer';
    const isCredit = type === 'expense' && paymentMethod === 'credit';

    if (isTransfer) {
      if (!value || !walletId || !destinationWalletId) {
        toast({ title: 'Erro', description: 'Preencha conta de origem, destino e valor.', variant: 'destructive' });
        return;
      }
      if (walletId === destinationWalletId) {
        toast({ title: 'Erro', description: 'Conta de origem e destino devem ser diferentes.', variant: 'destructive' });
        return;
      }
    } else {
      if (!description.trim() || !value || !finalCategory) {
        toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
        return;
      }
      if (type === 'expense' && paymentMethod === 'debit' && !walletId) {
        toast({ title: 'Erro', description: 'Selecione uma conta.', variant: 'destructive' });
        return;
      }
      if (isCredit && !creditCardId) {
        toast({ title: 'Erro', description: 'Selecione um cartão de crédito.', variant: 'destructive' });
        return;
      }
      if (type === 'income' && !walletId) {
        toast({ title: 'Erro', description: 'Selecione uma conta.', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user?.id,
      date,
      description: isTransfer ? 'Transferência entre contas' : description.trim(),
      value: parseFloat(value),
      category_ai: isTransfer ? null : (categoryAi || null),
      final_category: isTransfer ? 'transferencia' : finalCategory,
      type,
      payment_method: isTransfer ? null : (type === 'expense' ? paymentMethod : 'debit'),
      is_recurring: isTransfer ? false : isRecurring,
      frequency: isRecurring && !isTransfer ? frequency : null,
      credit_card_id: isCredit ? creditCardId : null,
      installments: isCredit ? (parseInt(installments) || 1) : 1,
      wallet_id: (isTransfer || (type === 'expense' && paymentMethod === 'debit') || type === 'income') ? (walletId || null) : null,
      destination_wallet_id: isTransfer ? destinationWalletId : null,
      invoice_month: isCredit ? (invoiceMonth || null) : null,
    });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      const msg = isTransfer ? 'Transferência salva!' : (type === 'income' ? 'Receita salva!' : 'Despesa salva!');
      toast({ title: msg, description: 'Registro salvo com sucesso.' });
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
    setPaymentMethod('debit');
    setIsRecurring(false);
    setFrequency('monthly');
    setCreditCardId('');
    setInstallments('1');
    setWalletId('');
    setDestinationWalletId('');
    setCategoryAi('');
    setFinalCategory('');
    setInvoiceMonth('');
  };

  const aiCategoryInfo = categoryAi ? getCategoryInfo(categoryAi) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Transação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-secondary">
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
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'transfer'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>⇄</span> Transferência
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-date">Data</Label>
            <Input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
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

          {type === 'transfer' ? (
            <>
              <div className="space-y-2">
                <Label>Conta de Origem <span className="text-destructive">*</span></Label>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione a conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta de Destino <span className="text-destructive">*</span></Label>
                <Select value={destinationWalletId} onValueChange={setDestinationWalletId}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione a conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.filter(w => w.id !== walletId).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
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

              {/* Payment method toggle (expenses only) */}
              {type === 'expense' && (
                <div className="space-y-2">
                  <Label>Método de pagamento</Label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('debit'); setCreditCardId(''); setInvoiceMonth(''); }}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                        paymentMethod === 'debit'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      💳 Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('credit'); setWalletId(''); }}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                        paymentMethod === 'credit'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      💳 Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* Debit: show wallet select */}
              {(type === 'income' || (type === 'expense' && paymentMethod === 'debit')) && wallets.length > 0 && (
                <div className="space-y-2">
                  <Label>Conta / Carteira <span className="text-destructive">*</span></Label>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Credit: show card select + installments + invoice */}
              {type === 'expense' && paymentMethod === 'credit' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Cartão de Crédito <span className="text-destructive">*</span></Label>
                      <Select value={creditCardId} onValueChange={setCreditCardId}>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder="Selecione o cartão" />
                        </SelectTrigger>
                        <SelectContent>
                          {creditCards.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={installments}
                        onChange={e => setInstallments(e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  </div>

                  {/* Invoice month - auto-calculated but overridable */}
                  {creditCardId && (
                    <div className="space-y-2">
                      <Label>Fatura</Label>
                      <Select value={invoiceMonth} onValueChange={setInvoiceMonth}>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder="Mês da fatura" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoiceOptions.map(ym => (
                            <SelectItem key={ym} value={ym}>{formatInvoiceLabel(ym)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Calculado automaticamente. Pode alterar manualmente se necessário.</p>
                    </div>
                  )}
                </>
              )}

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
            </>
          )}
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
