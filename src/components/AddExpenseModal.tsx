import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Loader2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X } from 'lucide-react';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';

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
  const month = d.getMonth();
  const day = d.getDate();

  let closingDay: number;
  if (card.closing_strategy === 'relative') {
    closingDay = card.due_day - card.closing_days_before_due;
    if (closingDay <= 0) closingDay += 30;
  } else {
    closingDay = card.closing_day;
  }

  if (day < closingDay) {
    const m = month + 1;
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

const TYPE_STYLES = {
  expense: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    accent: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    valueBorder: 'border-destructive/30 focus-within:border-destructive',
    icon: ArrowDownCircle,
  },
  income: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    accent: 'bg-emerald-600 text-white hover:bg-emerald-700',
    valueBorder: 'border-emerald-500/30 focus-within:border-emerald-500',
    icon: ArrowUpCircle,
  },
  transfer: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    accent: 'bg-primary text-primary-foreground hover:bg-primary/90',
    valueBorder: 'border-primary/30 focus-within:border-primary',
    icon: ArrowLeftRight,
  },
} as const;

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
  const [projects, setProjects] = useState<{ id: string; name: string; color: string }[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; parent_id: string | null; icon: string; color: string }[]>([]);
  const [categoryAi, setCategoryAi] = useState('');
  const [finalCategory, setFinalCategory] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings: moduleSettings } = useUserSettings();

  const style = TYPE_STYLES[type];

  useEffect(() => {
    if (!user || !open) return;
    Promise.all([
      supabase.from('credit_cards').select('id, name, closing_day, due_day, closing_strategy, closing_days_before_due').eq('user_id', user.id).order('name'),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('projects').select('id, name, color').eq('user_id', user.id).order('name'),
      supabase.from('categories').select('id, name, parent_id, icon, color').eq('user_id', user.id).order('sort_order'),
    ]).then(([cards, walletsRes, projectsRes, catsRes]) => {
      setCreditCards((cards.data || []) as CreditCardOption[]);
      setWallets((walletsRes.data || []) as WalletOption[]);
      setProjects((projectsRes.data || []) as { id: string; name: string; color: string }[]);
      setDbCategories((catsRes.data || []) as any[]);
    });
  }, [user, open]);

  const selectedCard = useMemo(() => creditCards.find(c => c.id === creditCardId), [creditCards, creditCardId]);

  const groupedCategories = useMemo(() => {
    const parents = dbCategories.filter(c => !c.parent_id);
    const children = dbCategories.filter(c => !!c.parent_id);
    return parents.map(p => ({
      ...p,
      subs: children.filter(c => c.parent_id === p.id),
    }));
  }, [dbCategories]);

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

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
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
    const numInstallments = isCredit ? (parseInt(installments) || 1) : 1;

    if (isCredit && numInstallments > 1 && invoiceMonth) {
      // Generate one record per installment with shared group id
      const groupId = crypto.randomUUID();
      const totalValue = parseFloat(value);
      const perInstallment = Math.round((totalValue / numInstallments) * 100) / 100;
      const [baseY, baseM] = invoiceMonth.split('-').map(Number);

      const rows = Array.from({ length: numInstallments }, (_, i) => {
        const m = new Date(baseY, baseM - 1 + i, 1);
        const im = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
        return {
          user_id: user?.id,
          date,
          description: description.trim(),
          value: perInstallment,
          category_ai: categoryAi || null,
          final_category: finalCategory,
          type,
          payment_method: 'credit',
          is_recurring: false,
          frequency: null,
          credit_card_id: creditCardId,
          installments: numInstallments,
          wallet_id: null,
          destination_wallet_id: null,
          invoice_month: im,
          is_paid: false,
          notes: notes.trim() || null,
          tags: tags.length > 0 ? tags : null,
          installment_group_id: groupId,
          installment_info: `${i + 1}/${numInstallments}`,
          project_id: projectId || null,
        };
      });

      const { error } = await supabase.from('expenses').insert(rows);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Parcelas criadas!', description: `${numInstallments} parcelas salvas com sucesso.` });
        resetForm();
        onOpenChange(false);
        onExpenseAdded();
      }
    } else {
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
        installments: 1,
        wallet_id: (isTransfer || (type === 'expense' && paymentMethod === 'debit') || type === 'income') ? (walletId || null) : null,
        destination_wallet_id: isTransfer ? destinationWalletId : null,
        invoice_month: isCredit ? (invoiceMonth || null) : null,
        is_paid: isTransfer ? true : isPaid,
        notes: notes.trim() || null,
        tags: tags.length > 0 ? tags : null,
        installment_group_id: null,
        installment_info: null,
        project_id: projectId || null,
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
    setIsPaid(true);
    setNotes('');
    setTags([]);
    setTagInput('');
    setProjectId('');
  };

  const aiCategoryInfo = categoryAi ? getCategoryInfo(categoryAi) : null;
  const isTransfer = type === 'transfer';
  const isCredit = type === 'expense' && paymentMethod === 'credit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Type selector header */}
        <div className={`p-4 pb-0 rounded-t-2xl transition-colors duration-200 ${style.bg}`}>
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-bold">Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-background/60 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowDownCircle className="h-4 w-4" /> Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowUpCircle className="h-4 w-4" /> Receita
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                type === 'transfer'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowLeftRight className="h-4 w-4" /> Transf.
            </button>
          </div>

          {/* Value field - prominent */}
          <div className={`mt-4 mb-3 rounded-xl border-2 bg-background/80 backdrop-blur-sm transition-colors ${style.valueBorder}`}>
            <div className="flex items-center px-4 py-3">
              <span className="text-lg font-bold text-muted-foreground mr-2">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        {/* Form body */}
        <div className="p-4 pt-2 space-y-4">
          {/* Date row */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data</Label>
            <Input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
          </div>

          {isTransfer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta de Origem <span className="text-destructive">*</span></Label>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Origem" /></SelectTrigger>
                  <SelectContent>
                    {wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta de Destino <span className="text-destructive">*</span></Label>
                <Select value={destinationWalletId} onValueChange={setDestinationWalletId}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>
                    {wallets.filter(w => w.id !== walletId).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="expense-desc" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</Label>
                <Input
                  id="expense-desc"
                  placeholder="Ex: Almoço no restaurante do centro"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              {/* Payment method (expense only) */}
              {type === 'expense' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</Label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('debit'); setCreditCardId(''); setInvoiceMonth(''); }}
                      className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                        paymentMethod === 'debit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      💳 Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('credit'); setWalletId(''); }}
                      className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                        paymentMethod === 'credit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      💳 Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* Wallet select for debit/income */}
              {(type === 'income' || (type === 'expense' && paymentMethod === 'debit')) && wallets.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta <span className="text-destructive">*</span></Label>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Credit card fields */}
              {type === 'expense' && paymentMethod === 'credit' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cartão <span className="text-destructive">*</span></Label>
                      <Select value={creditCardId} onValueChange={setCreditCardId}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcelas</Label>
                      <Input type="number" min="1" max="48" value={installments} onChange={e => setInstallments(e.target.value)} className="rounded-xl h-11" />
                    </div>
                  </div>
                  {creditCardId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fatura</Label>
                      <Select value={invoiceMonth} onValueChange={setInvoiceMonth}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Mês da fatura" /></SelectTrigger>
                        <SelectContent>
                          {invoiceOptions.map(ym => <SelectItem key={ym} value={ym}>{formatInvoiceLabel(ym)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Category with AI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
                  <Button
                    variant="ai"
                    size="sm"
                    onClick={handleAiCategorize}
                    disabled={aiLoading || !description.trim()}
                    className="gap-1.5 rounded-xl h-7 text-xs"
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiLoading ? 'Analisando...' : 'IA'}
                  </Button>
                </div>
                {aiLoading && (
                  <div className="flex items-center gap-2 text-xs text-ai">
                    <div className="w-1.5 h-1.5 rounded-full bg-ai animate-pulse" />
                    Analisando despesa...
                  </div>
                )}
                {aiCategoryInfo && !aiLoading && (
                  <Badge variant={aiCategoryInfo.variant} className="mb-1">{aiCategoryInfo.label}</Badge>
                )}
                <Select value={finalCategory} onValueChange={setFinalCategory}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {groupedCategories.length > 0 ? (
                      groupedCategories.map(group => (
                        <SelectGroup key={group.id}>
                          <SelectLabel className="font-bold text-xs text-muted-foreground uppercase tracking-wider px-2 pt-2">
                            {group.name}
                          </SelectLabel>
                          {group.subs.length > 0 ? (
                            group.subs.map(sub => (
                              <SelectItem key={sub.id} value={sub.name.toLowerCase()}>
                                <span className="pl-2">{sub.name}</span>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value={group.name.toLowerCase()}>
                              {group.name}
                            </SelectItem>
                          )}
                        </SelectGroup>
                      ))
                    ) : (
                      CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Paid / Received toggle */}
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <span className="text-sm font-medium">{type === 'income' ? 'Recebido' : 'Pago'}</span>
                  <p className="text-xs text-muted-foreground">{type === 'income' ? 'Já recebeu este valor?' : 'Já efetuou o pagamento?'}</p>
                </div>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>

              {/* Recurring */}
              <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-muted-foreground accent-primary"
                />
                <div>
                  <span className="text-sm font-medium">Recorrente / Assinatura</span>
                  <p className="text-xs text-muted-foreground">Conta fixa mensal ou anual</p>
                </div>
              </label>
              {isRecurring && (
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* More options accordion */}
              <Accordion type="single" collapsible>
                <AccordionItem value="more" className="border rounded-xl px-3">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">Mais Opções</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pb-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</Label>
                        <Textarea
                          placeholder="Observações adicionais..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="rounded-xl min-h-[80px] resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Adicionar tag..."
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                            className="rounded-xl h-9 text-sm"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={handleAddTag} className="rounded-xl h-9 px-3">+</Button>
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                {tag}
                                <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {projects.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projeto</Label>
                          <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
                            <SelectTrigger className="rounded-xl h-9 text-sm">
                              <SelectValue placeholder="Nenhum projeto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                    {p.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 pt-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className={`rounded-xl font-semibold transition-colors ${style.accent}`}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
