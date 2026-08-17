import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format, addMonths } from 'date-fns';
import {
  INVESTMENT_TYPES,
  RATE_KINDS,
  effectiveAnnualRate,
  type Investment,
  type RateKind,
} from '@/lib/investmentMath';

interface WalletOption {
  id: string;
  name: string;
  asset_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  wallets: WalletOption[];
  investment?: Investment | null;
  onSaved: () => void;
}

const TERM_PRESETS = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: '36', label: '36 meses' },
  { value: 'custom', label: 'Data personalizada' },
  { value: 'none', label: 'Sem prazo (liquidez diária)' },
];

export function InvestmentFormModal({ open, onOpenChange, wallets, investment, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!investment;

  const today = format(new Date(), 'yyyy-MM-dd');
  const [name, setName] = useState('');
  const [type, setType] = useState('caixinha');
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [rateKind, setRateKind] = useState<RateKind>('cdi_percent');
  const [rateValue, setRateValue] = useState('100');
  const [indexValue, setIndexValue] = useState('14.90');
  const [startDate, setStartDate] = useState(today);
  const [term, setTerm] = useState('12');
  const [maturityDate, setMaturityDate] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    if (investment) {
      setName(investment.name);
      setType(investment.investment_type);
      setWalletId(investment.wallet_id || '');
      setAmount(String(investment.principal));
      setRateKind(investment.rate_kind);
      setRateValue(String(investment.rate_value));
      setIndexValue(String(investment.index_value));
      setStartDate(investment.start_date);
      setTerm(investment.maturity_date ? 'custom' : 'none');
      setMaturityDate(investment.maturity_date || '');
      setNotes(investment.notes || '');
    } else {
      setName('');
      setType('caixinha');
      setWalletId(wallets.find(w => w.asset_type !== 'investment')?.id || '');
      setAmount('');
      setRateKind('cdi_percent');
      setRateValue('100');
      setIndexValue('14.90');
      setStartDate(today);
      setTerm('12');
      setMaturityDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
      setNotes('');
    }
  }, [open, investment]);

  useEffect(() => {
    if (term === 'none') setMaturityDate('');
    else if (term !== 'custom') {
      const months = parseInt(term);
      const base = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
      setMaturityDate(format(addMonths(base, months), 'yyyy-MM-dd'));
    }
  }, [term, startDate]);

  const annualPreview = effectiveAnnualRate({
    rate_kind: rateKind,
    rate_value: parseFloat(rateValue) || 0,
    index_value: parseFloat(indexValue) || 0,
  }) * 100;

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome do investimento.', variant: 'destructive' });
      return;
    }
    const value = parseFloat(amount.replace(',', '.'));
    if (!isEdit && (!value || value <= 0)) {
      toast({ title: 'Erro', description: 'Informe o valor do aporte inicial.', variant: 'destructive' });
      return;
    }
    if (!isEdit && !walletId) {
      toast({ title: 'Erro', description: 'Selecione a carteira de origem do dinheiro.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        investment_type: type,
        wallet_id: walletId || null,
        rate_kind: rateKind,
        rate_value: parseFloat(rateValue.replace(',', '.')) || 0,
        index_value: parseFloat(indexValue.replace(',', '.')) || 0,
        start_date: startDate,
        maturity_date: maturityDate || null,
        notes: notes.trim() || null,
      };

      if (isEdit && investment) {
        const { error } = await supabase.from('investments').update(payload).eq('id', investment.id);
        if (error) throw error;
        toast({ title: 'Investimento atualizado!' });
      } else {
        // 1. Carteira que guarda o saldo investido
        const { data: invWallet, error: wErr } = await supabase
          .from('wallets')
          .insert({
            user_id: user!.id,
            name: `Investimento: ${name.trim()}`,
            asset_type: 'investment',
            currency: 'BRL',
            current_balance: 0,
            initial_balance: 0,
          })
          .select('id')
          .single();
        if (wErr) throw wErr;

        // 2. Investimento
        const { data: inv, error: iErr } = await supabase
          .from('investments')
          .insert({ ...payload, user_id: user!.id, principal: value, investment_wallet_id: invWallet!.id })
          .select('id')
          .single();
        if (iErr) {
          await supabase.from('wallets').delete().eq('id', invWallet!.id);
          throw iErr;
        }

        // 3. Transferência da carteira para o investimento
        const { data: exp, error: eErr } = await supabase
          .from('expenses')
          .insert({
            user_id: user!.id,
            date: startDate,
            description: `Aporte em ${name.trim()}`,
            value,
            type: 'transfer',
            final_category: 'investimentos',
            wallet_id: walletId,
            destination_wallet_id: invWallet!.id,
            is_paid: true,
            installments: 1,
            is_recurring: false,
            notes: `Aporte no investimento ${name.trim()}`,
          })
          .select('id')
          .single();
        if (eErr) {
          // Não deixa investimento órfão sem a transferência que tira o dinheiro da carteira.
          await supabase.from('investments').delete().eq('id', inv!.id);
          await supabase.from('wallets').delete().eq('id', invWallet!.id);
          throw eErr;
        }

        // 4. Movimentação
        const { error: mErr } = await supabase.from('investment_movements').insert({
          user_id: user!.id,
          investment_id: inv!.id,
          kind: 'deposit',
          amount: value,
          date: startDate,
          expense_id: exp!.id,
        });
        if (mErr) {
          await supabase.from('expenses').delete().eq('id', exp!.id);
          await supabase.from('investments').delete().eq('id', inv!.id);
          await supabase.from('wallets').delete().eq('id', invWallet!.id);
          throw mErr;
        }

        toast({ title: 'Investimento criado!', description: 'O valor foi transferido da sua carteira.' });
      }
      onOpenChange(false);
      onSaved();
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle>{isEdit ? 'Editar investimento' : 'Novo investimento'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Caixinha Nubank" className="rounded-xl h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isEdit ? 'Carteira de origem' : 'Sai da carteira'}</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {wallets.filter(w => w.asset_type !== 'investment').map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Valor do aporte inicial</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="rounded-xl h-11" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Rentabilidade</Label>
            <Select value={rateKind} onValueChange={v => setRateKind(v as RateKind)}>
              <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RATE_KINDS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{RATE_KINDS.find(r => r.value === rateKind)?.hint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {rateKind !== 'prefixado' && (
              <div className="space-y-2">
                <Label>{rateKind === 'cdi_percent' ? 'CDI anual (%)' : 'IPCA anual (%)'}</Label>
                <Input value={indexValue} onChange={e => setIndexValue(e.target.value)} inputMode="decimal" className="rounded-xl h-11" />
              </div>
            )}
            <div className="space-y-2">
              <Label>{rateKind === 'cdi_percent' ? '% do CDI' : 'Taxa (% a.a.)'}</Label>
              <Input value={rateValue} onChange={e => setRateValue(e.target.value)} inputMode="decimal" className="rounded-xl h-11" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Taxa efetiva estimada: <span className="font-semibold text-foreground">{annualPreview.toFixed(2)}% ao ano</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TERM_PRESETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {term !== 'none' && (
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={maturityDate} onChange={e => { setMaturityDate(e.target.value); setTerm('custom'); }} className="rounded-xl h-11" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="rounded-xl" placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter className="p-5 pt-3 border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] gap-2">
          <Button variant="outline" className="rounded-xl h-11" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl h-11 font-semibold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar investimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
