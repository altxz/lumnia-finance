import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';

export function EmergencyFundCard() {
  const { user } = useAuth();
  const [totalBalance, setTotalBalance] = useState(0);
  const [avgExpense, setAvgExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Sum balances of checking/savings wallets
      const { data: wallets } = await supabase
        .from('wallets')
        .select('current_balance, asset_type')
        .eq('user_id', user.id)
        .in('asset_type', ['checking_account', 'savings']);

      const bal = (wallets || []).reduce((s, w: any) => s + (w.current_balance || 0), 0);
      setTotalBalance(bal);

      // Avg expenses of last 3 months
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const { data: expenses } = await supabase
        .from('expenses')
        .select('value, type, credit_card_id')
        .eq('user_id', user.id)
        .neq('type', 'income')
        .neq('type', 'transfer')
        .gte('date', threeMonthsAgo.toISOString().split('T')[0]);

      const total = (expenses || [])
        .filter((e: any) => !e.credit_card_id)
        .reduce((s, e: any) => s + e.value, 0);
      setAvgExpense(total / 3);
      setLoading(false);
    })();
  }, [user]);

  const months = useMemo(() => {
    if (avgExpense <= 0) return 99;
    return Math.round((totalBalance / avgExpense) * 10) / 10;
  }, [totalBalance, avgExpense]);

  const progressPct = Math.min(100, (months / 6) * 100);

  const color = months < 1 ? 'text-destructive' : months < 6 ? 'text-yellow-500' : 'text-emerald-500';
  const barColor = months < 1 ? '[&>div]:bg-destructive' : months < 6 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-emerald-500';

  if (loading) return null;

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Reserva de Emergência
          </CardTitle>
          <InfoPopover><p>Quantos meses você conseguiria se manter com seu saldo atual, sem nenhuma renda.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold tracking-tight ${color}`}>
            {months >= 99 ? '∞' : months.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground pb-1">meses de sobrevivência</span>
        </div>

        <Progress value={progressPct} className={`h-2.5 rounded-full ${barColor}`} />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Saldo: {formatCurrency(totalBalance)}</span>
          <span>Média mensal: {formatCurrency(avgExpense)}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {months < 1 && 'Atenção! Reserva muito baixa. Tente economizar mais.'}
          {months >= 1 && months < 6 && `Meta: 6 meses. Faltam ${(6 - months).toFixed(1)} meses.`}
          {months >= 6 && 'Parabéns! Reserva de emergência saudável.'}
        </p>
      </CardContent>
    </Card>
  );
}
