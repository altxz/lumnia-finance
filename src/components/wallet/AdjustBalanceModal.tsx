import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/constants';
import { QuickCalculator } from '@/components/QuickCalculator';
import { BALANCE_ADJUSTMENT_CATEGORY, buildBalanceAdjustmentDescription } from '@/lib/balanceAdjustments';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  wallet: { id: string; name: string } | null;
  /** Saldo atual calculado pelo app (mesmo motor da página de Transações). */
  currentBalance: number;
  onSaved: () => void;
}

export function AdjustBalanceModal({ open, onOpenChange, wallet, currentBalance, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [realBalance, setRealBalance] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setRealBalance(currentBalance.toFixed(2));
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
  }, [open, wallet?.id]);

  const parsed = parseFloat((realBalance || '').replace(',', '.'));
  const diff = Number.isFinite(parsed) ? Math.round((parsed - currentBalance) * 100) / 100 : 0;

  const handleSave = async () => {
    if (!user || !wallet) return;
    if (!Number.isFinite(parsed)) {
      toast({ title: 'Valor inválido', description: 'Informe o saldo real da conta.', variant: 'destructive' });
      return;
    }
    if (diff === 0) {
      toast({ title: 'Nada a ajustar', description: 'O saldo informado é igual ao saldo atual.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      date,
      description: buildBalanceAdjustmentDescription(wallet.name),
      value: Math.abs(diff),
      type: diff > 0 ? 'income' : 'expense',
      final_category: BALANCE_ADJUSTMENT_CATEGORY,
      wallet_id: wallet.id,
      is_paid: true,
      installments: 1,
      is_recurring: false,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao ajustar saldo', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Saldo ajustado',
      description: `${diff > 0 ? 'Entrada' : 'Saída'} de ${formatCurrency(Math.abs(diff))} em ${wallet.name}.`,
    });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[85dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle>Ajustar saldo{wallet ? ` — ${wallet.name}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
            <p className="text-xs text-white/55">Saldo atual calculado</p>
            <p className="text-xl font-bold text-white/95">{formatCurrency(currentBalance)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Saldo real</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={realBalance}
                onChange={e => setRealBalance(e.target.value)}
                className="rounded-xl h-11"
              />
              <QuickCalculator onSelect={v => setRealBalance(String(v))} />
            </div>
            {Number.isFinite(parsed) && (
              <p className="text-xs text-muted-foreground">
                {diff === 0
                  ? 'Nenhuma diferença a registrar.'
                  : diff > 0
                    ? `Será criada uma entrada de ajuste de ${formatCurrency(diff)}.`
                    : `Será criada uma saída de ajuste de ${formatCurrency(Math.abs(diff))}.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Data do ajuste</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
          </div>

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: conciliação com o extrato do banco"
              className="rounded-xl"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-3 border-t gap-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="min-w-32 rounded-xl" onClick={handleSave} disabled={saving || diff === 0}>
            {saving ? <><Loader2 className="animate-spin" /> Salvando...</> : 'Ajustar saldo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
