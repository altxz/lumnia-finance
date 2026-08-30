import { useEffect, useState } from 'react';
import { ResponsiveModal, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '@/components/ui/responsive-modal';
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
  }, [open, wallet?.id, currentBalance]);

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
    <ResponsiveModal open={open} onOpenChange={onOpenChange} className="max-h-[calc(100vh-2rem)] w-[calc(100%-1rem)] max-w-md rounded-3xl sm:w-full">
        <ResponsiveModalHeader className="p-6 pb-3">
          <ResponsiveModalTitle className="break-words">Ajustar saldo{wallet ? `: ${wallet.name}` : ''}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-pretty">
            Registre somente a diferença entre o saldo calculado e o saldo conferido no banco.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
            <p className="text-xs text-muted-foreground">Saldo atual calculado</p>
            <p className="break-words text-xl font-semibold text-foreground">{formatCurrency(currentBalance)}</p>
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
              <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
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

        <ResponsiveModalFooter className="flex-col-reverse gap-2 border-t p-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row">
          <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="w-full rounded-xl whitespace-normal sm:min-w-32 sm:w-auto" onClick={handleSave} disabled={saving || diff === 0}>
            {saving ? <><Loader2 className="animate-spin" /> Salvando...</> : 'Ajustar saldo'}
          </Button>
        </ResponsiveModalFooter>
    </ResponsiveModal>
  );
}
