import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/constants';
import { computeStats, type Investment, type InvestmentMovement } from '@/lib/investmentMath';

interface WalletOption {
  id: string;
  name: string;
  asset_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'deposit' | 'withdrawal';
  investment: Investment;
  movements: InvestmentMovement[];
  wallets: WalletOption[];
  onSaved: () => void;
}

export function InvestmentMovementModal({ open, onOpenChange, mode, investment, movements, wallets, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const stats = computeStats(investment, movements);

  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [closeInvestment, setCloseInvestment] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setWalletId(investment.wallet_id || wallets.find(w => w.asset_type !== 'investment')?.id || '');
    if (mode === 'withdrawal') {
      setAmount(stats.currentValue.toFixed(2));
      setCloseInvestment(true);
    } else {
      setAmount('');
      setCloseInvestment(false);
    }
  }, [open, mode, investment.id, investment.wallet_id, stats.currentValue, wallets]);

  const handleSave = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!value || value <= 0) {
      toast({ title: 'Erro', description: 'Informe um valor válido.', variant: 'destructive' });
      return;
    }
    if (!walletId) {
      toast({ title: 'Erro', description: 'Selecione a carteira.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const isDeposit = mode === 'deposit';

      // Garante que existe a carteira que guarda o saldo investido (caixinha).
      let investmentWalletId = investment.investment_wallet_id;
      if (!investmentWalletId) {
        const { data: newWallet, error: wErr } = await supabase
          .from('wallets')
          .insert({
            user_id: user!.id,
            name: `Investimento: ${investment.name}`,
            asset_type: 'investment',
            currency: 'BRL',
            current_balance: 0,
            initial_balance: 0,
          })
          .select('id')
          .single();
        if (wErr) throw wErr;
        investmentWalletId = newWallet!.id;
        const { error: linkErr } = await supabase
          .from('investments')
          .update({ investment_wallet_id: investmentWalletId })
          .eq('id', investment.id);
        if (linkErr) throw linkErr;
      }

      const { data: exp, error: eErr } = await supabase
        .from('expenses')
        .insert({
          user_id: user!.id,
          date,
          description: isDeposit ? `Aporte em ${investment.name}` : `Resgate de ${investment.name}`,
          value,
          type: 'transfer',
          final_category: 'investimentos',
          wallet_id: isDeposit ? walletId : investmentWalletId,
          destination_wallet_id: isDeposit ? investmentWalletId : walletId,
          is_paid: true,
          installments: 1,
          is_recurring: false,
        })
        .select('id')
        .single();
      if (eErr) throw eErr;

      const { error: mErr } = await supabase.from('investment_movements').insert({
        user_id: user!.id,
        investment_id: investment.id,
        kind: mode,
        amount: value,
        date,
        expense_id: exp!.id,
      });
      if (mErr) {
        await supabase.from('expenses').delete().eq('id', exp!.id);
        throw mErr;
      }


      if (!isDeposit && closeInvestment) {
        const { error: uErr } = await supabase.from('investments').update({ status: 'redeemed' }).eq('id', investment.id);
        if (uErr) throw uErr;
      }

      toast({
        title: isDeposit ? 'Aporte registrado!' : 'Resgate registrado!',
        description: `${formatCurrency(value)} ${isDeposit ? 'aplicado' : 'devolvido para a carteira'}.`,
      });
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
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[85dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle>{mode === 'deposit' ? 'Novo aporte' : 'Resgatar investimento'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl bg-foreground/[0.04] border border-border p-4 space-y-1">
            <p className="text-sm font-semibold text-foreground">{investment.name}</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Aportado</span><span>{formatCurrency(stats.invested)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Rendimento até hoje</span><span>{formatCurrency(stats.earnings)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Valor atual</span><span>{formatCurrency(stats.currentValue)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{mode === 'deposit' ? 'Valor do aporte' : 'Valor devolvido para a carteira'}</Label>
            <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="rounded-xl h-11" />
            {mode === 'withdrawal' && (
              <p className="text-xs text-muted-foreground">Sugerido: aportado + rendimento. Você pode editar o valor.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{mode === 'deposit' ? 'Sai da carteira' : 'Entra na carteira'}</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {wallets.filter(w => w.asset_type !== 'investment').map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
          </div>

          {mode === 'withdrawal' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={closeInvestment} onChange={e => setCloseInvestment(e.target.checked)} className="h-4 w-4 rounded" />
              Encerrar o investimento (resgate total)
            </label>
          )}
        </div>

        <DialogFooter className="p-5 pt-3 border-t border-border pb-[max(1.25rem,env(safe-area-inset-bottom))] gap-2">
          <Button variant="outline" className="rounded-xl h-11 border-border bg-foreground/[0.04] text-foreground hover:bg-foreground/10 hover:text-foreground" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl h-11 font-semibold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
