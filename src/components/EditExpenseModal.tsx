import { useState, useEffect, useMemo } from 'react';
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

import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X, Trash2, Info, Repeat, Hash } from 'lucide-react';
import { QuickCalculator } from '@/components/QuickCalculator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

function formatInvoiceLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function generateInvoiceOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = -6; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth() + 1;
    options.push(`${d.getFullYear()}-${String(m).padStart(2, '0')}`);
  }
  return options;
}

/** Advance a YYYY-MM-DD date by N months */
function advanceDateByMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Advance a YYYY-MM invoice_month by N months */
function advanceInvoiceMonth(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  const [invoiceMonth, setInvoiceMonth] = useState(expense.invoice_month || '');
  const [saving, setSaving] = useState(false);
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; parent_id: string | null; icon: string; color: string }[]>([]);

  // Installment conversion state
  const [wantInstallment, setWantInstallment] = useState(false);
  const [installmentMode, setInstallmentMode] = useState<'fixed' | 'limited'>('limited');
  const [numInstallments, setNumInstallments] = useState(2);
  const [valueMode, setValueMode] = useState<'total' | 'per_installment'>('total');

  const { toast } = useToast();
  const { user } = useAuth();

  const style = TYPE_STYLES[type];
  const isCredit = !!expense.credit_card_id;
  const isExistingInstallment = !!expense.installment_group_id;
  const canConvertToInstallment = !isExistingInstallment && type !== 'transfer';
  const invoiceOptions = useMemo(() => generateInvoiceOptions(), []);

  useEffect(() => {
    if (!user || !open) return;
    setWantInstallment(false);
    setInstallmentMode('limited');
    setNumInstallments(2);
    setValueMode('total');
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
    if (wantInstallment && numInstallments < 2) {
      toast({ title: 'Erro', description: 'Mínimo de 2 parcelas.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      const parsedValue = parseFloat(value);
      const baseFields = {
        date, description: description.trim(),
        final_category: finalCategory, wallet_id: walletId || null,
        is_paid: isPaid, notes: notes.trim() || null,
        tags: tags.length > 0 ? tags : null,
        invoice_month: isCredit ? (invoiceMonth || null) : null,
      };

      if (wantInstallment && canConvertToInstallment && installmentMode === 'limited') {
        // Convert single expense to installment/repeat plan
        const installmentValue = valueMode === 'total'
          ? Math.round((parsedValue / numInstallments) * 100) / 100
          : parsedValue;

        const groupId = crypto.randomUUID();
        const baseInvoice = isCredit
          ? (invoiceMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
          : null;

        // Update existing expense as installment 1
        const { error: updateError } = await supabase.from('expenses').update({
          ...baseFields,
          value: installmentValue,
          installment_group_id: groupId,
          installment_info: `1/${numInstallments}`,
          is_recurring: false,
          ...(isCredit && baseInvoice ? { invoice_month: baseInvoice } : {}),
        }).eq('id', expense.id);

        if (updateError) throw updateError;

        // Generate remaining installments (2..N)
        const newInstallments = [];
        for (let i = 2; i <= numInstallments; i++) {
          const row: Record<string, unknown> = {
            user_id: user!.id,
            description: description.trim(),
            value: installmentValue,
            type: expense.type,
            final_category: finalCategory,
            category_ai: expense.category_ai,
            credit_card_id: expense.credit_card_id,
            wallet_id: walletId || null,
            is_paid: false,
            is_recurring: false,
            notes: notes.trim() || null,
            tags: tags.length > 0 ? tags : null,
            installments: numInstallments,
            installment_group_id: groupId,
            installment_info: `${i}/${numInstallments}`,
            payment_method: expense.payment_method,
          };

          if (isCredit && baseInvoice) {
            row.date = date;
            row.invoice_month = advanceInvoiceMonth(baseInvoice, i - 1);
          } else {
            row.date = advanceDateByMonths(date, i - 1);
            row.invoice_month = null;
          }

          newInstallments.push(row);
        }

        const { error: insertError } = await supabase.from('expenses').insert(newInstallments);
        if (insertError) throw insertError;

        toast({ title: 'Parcelamento criado!', description: `Transação dividida em ${numInstallments}x de R$ ${installmentValue.toFixed(2)}` });
      } else if (wantInstallment && canConvertToInstallment && installmentMode === 'fixed') {
        // Convert to fixed recurring
        const { error } = await supabase.from('expenses').update({
          ...baseFields,
          value: parsedValue,
          is_recurring: true,
          frequency: 'monthly',
        }).eq('id', expense.id);

        if (error) throw error;
        toast({ title: 'Recorrência ativada!', description: 'Esta transação será replicada automaticamente todo mês.' });
      } else {
        // Normal single update
        const { error } = await supabase.from('expenses').update({
          ...baseFields,
          value: parsedValue,
        }).eq('id', expense.id);

        if (error) throw error;
        toast({ title: 'Transação atualizada!' });
      }

      onExpenseUpdated();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
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
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 w-[calc(100vw-2rem)]">
        <div className={`px-4 pt-4 pb-0 rounded-t-2xl transition-colors duration-200 ${style.bg}`}>
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {type === 'income' ? <ArrowUpCircle className="h-5 w-5 text-emerald-600" /> : type === 'transfer' ? <ArrowLeftRight className="h-5 w-5 text-primary" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
              Editar {type === 'income' ? 'Receita' : type === 'transfer' ? 'Transferência' : 'Despesa'}
            </DialogTitle>
          </DialogHeader>
          <div className={`mt-2 mb-3 rounded-xl border-2 bg-background/80 backdrop-blur-sm transition-colors ${style.valueBorder}`}>
            <div className="flex items-center px-3 sm:px-4 py-3">
              <span className="text-base sm:text-lg font-bold text-muted-foreground mr-2">R$</span>
              <input type="number" step="0.01" min="0" value={value} onChange={e => setValue(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-bold outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              <QuickCalculator onSelect={(v) => setValue(String(v))} />
            </div>
          </div>
        </div>

        <div className="p-4 pt-2 space-y-4">
          {/* Existing installment alert */}
          {isExistingInstallment && expense.installment_info && (
            <Alert className="rounded-xl border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Esta despesa faz parte de um parcelamento (<span className="font-bold">{expense.installment_info}</span>). As alterações feitas aqui afetarão apenas esta parcela.
              </AlertDescription>
            </Alert>
          )}

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

              {isCredit && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fatura de Referência</Label>
                  <Select value={invoiceMonth} onValueChange={setInvoiceMonth}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Mês da fatura" /></SelectTrigger>
                    <SelectContent>
                      {invoiceOptions.map(ym => <SelectItem key={ym} value={ym}>{formatInvoiceLabel(ym)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Altere para mover esta despesa para outra fatura.</p>
                </div>
              )}

              {/* Installment / Recurring conversion section */}
              {canConvertToInstallment && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Repeat className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium">Recorrente / Repetir</span>
                        <p className="text-xs text-muted-foreground">Conta fixa ou parcelamento</p>
                      </div>
                    </div>
                    <Switch checked={wantInstallment} onCheckedChange={setWantInstallment} />
                  </div>

                  {wantInstallment && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                      {/* Mode selector: Fixed vs Repeat */}
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                        <button
                          type="button"
                          onClick={() => setInstallmentMode('fixed')}
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                            installmentMode === 'fixed' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Repeat className="h-3.5 w-3.5" />
                          Fixa
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallmentMode('limited')}
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                            installmentMode === 'limited' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Hash className="h-3.5 w-3.5" />
                          Repetir vezes
                        </button>
                      </div>

                      {installmentMode === 'fixed' ? (
                        <p className="text-[11px] text-muted-foreground">
                          Este lançamento será replicado automaticamente todo mês.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Número de Repetições</Label>
                            <Input
                              type="number"
                              min={2}
                              max={72}
                              value={numInstallments}
                              onChange={e => setNumInstallments(Math.max(2, Math.min(72, parseInt(e.target.value) || 2)))}
                              className="rounded-xl h-11"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de Valor</Label>
                            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary">
                              <button
                                type="button"
                                onClick={() => setValueMode('total')}
                                className={`rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                                  valueMode === 'total' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Valor Total
                              </button>
                              <button
                                type="button"
                                onClick={() => setValueMode('per_installment')}
                                className={`rounded-lg py-2 text-xs sm:text-sm font-semibold transition-all ${
                                  valueMode === 'per_installment' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Valor da Parcela
                              </button>
                            </div>
                          </div>

                          {value && parseFloat(value) > 0 && (
                            <div className="rounded-lg bg-background/80 border p-2.5 text-center">
                              <p className="text-xs text-muted-foreground">Resumo</p>
                              <p className="text-lg font-bold text-primary">
                                {numInstallments}x de R$ {valueMode === 'total'
                                  ? (parseFloat(value) / numInstallments).toFixed(2)
                                  : parseFloat(value).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Total: R$ {valueMode === 'total'
                                  ? parseFloat(value).toFixed(2)
                                  : (parseFloat(value) * numInstallments).toFixed(2)}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Isso criará {numInstallments} lançamentos de R$ {valueMode === 'total'
                                  ? (parseFloat(value) / numInstallments).toFixed(2)
                                  : parseFloat(value).toFixed(2)} nos próximos {numInstallments} meses.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
              {saving ? 'Salvando...' : wantInstallment ? (installmentMode === 'fixed' ? 'Ativar Recorrência' : `Parcelar em ${numInstallments}x`) : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
