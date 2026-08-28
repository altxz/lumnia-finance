import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Landmark, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { isInvoicePayment } from '@/lib/utils';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { buildWalletBalances } from '@/lib/walletBalances';
import { transactionAmount } from '@/lib/transactionAmount';
import type { CreditCard } from '@/lib/invoiceHelpers';

interface ExpenseRow {
  value: number;
  type: string;
  date: string;
  description: string | null;
  final_category: string | null;
  credit_card_id: string | null;
  wallet_id: string | null;
  destination_wallet_id: string | null;
  invoice_month: string | null;
  is_paid: boolean;
}

interface CashWalletRow {
  id: string;
  initial_balance: number;
  asset_type: string;
}

interface CoverageData {
  availableCash: number;
  averageExpense: number;
  monthLabel: string;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function completedMonthsRange() {
  const now = new Date();
  const firstCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 3, 1, 12);
  const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth(), 0, 12);
  const label = `${firstCompletedMonth.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} a ${lastCompletedMonth.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}`;
  return { start: dateKey(firstCompletedMonth), end: dateKey(lastCompletedMonth), label };
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12);
  return { start: dateKey(start), end: dateKey(end), today: dateKey(now) };
}

export function EmergencyFundCard() {
  const { user } = useAuth();
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCoverage = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const range = completedMonthsRange();
    const current = currentMonthRange();
    const [walletsResult, expensesResult, cardsResult, settingsResult] = await Promise.all([
      supabase
        .from('wallets')
        .select('id, initial_balance, asset_type')
        .eq('user_id', user.id)
        .in('asset_type', ['checking_account', 'savings', 'investment']),
      supabase
        .from('expenses')
        .select('value, type, date, description, final_category, credit_card_id, wallet_id, destination_wallet_id, invoice_month, is_paid')
        .eq('user_id', user.id)
        .lte('date', current.today),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('user_settings').select('default_wallet_id').eq('user_id', user.id).maybeSingle(),
    ]);

    if (walletsResult.error || expensesResult.error || cardsResult.error || settingsResult.error) {
      setData(null);
      setError(true);
      setLoading(false);
      return;
    }

    const wallets = (walletsResult.data ?? []) as CashWalletRow[];
    const expenses = (expensesResult.data ?? []) as ExpenseRow[];
    const walletBalances = buildWalletBalances({
      wallets,
      historicalExpenses: expenses.filter(expense => expense.date < current.start) as any[],
      monthExpenses: expenses.filter(expense => expense.date >= current.start && expense.date < current.end) as any[],
      invoiceExpenses: expenses as any[],
      creditCards: (cardsResult.data ?? []) as CreditCard[],
      defaultWalletId: settingsResult.data?.default_wallet_id ?? null,
      today: current.today,
      startDate: current.start,
      endDate: current.end,
      isCreditCardPayment: (expense: any) => isTrackedCreditCardPayment(expense, (cardsResult.data ?? []) as CreditCard[]),
    });
    const balancesByWallet = new Map(walletBalances.map(balance => [balance.walletId, balance.paidBalanceToday]));
    const availableCash = wallets
      .filter(wallet => wallet.asset_type === 'checking_account' || wallet.asset_type === 'savings')
      .reduce((sum, wallet) => sum + Math.max(balancesByWallet.get(wallet.id) ?? 0, 0), 0);

    const totalExpenses = expenses
      .filter(expense => expense.date >= range.start && expense.date <= range.end)
      .filter((expense) => expense.type !== 'income' && expense.type !== 'transfer')
      .filter((expense) => !isInvoicePayment(expense) && !isBalanceAdjustment(expense))
      .reduce((sum, expense) => sum + transactionAmount(expense.value), 0);

    setData({ availableCash, averageExpense: totalExpenses / 3, monthLabel: range.label });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadCoverage();
  }, [loadCoverage, refreshKey]);

  const monthsCovered = useMemo(
    () => data && data.averageExpense > 0 ? data.availableCash / data.averageExpense : null,
    [data],
  );
  const coverageProgress = monthsCovered === null ? 0 : Math.min((monthsCovered / 6) * 100, 100);
  const coverageTone = monthsCovered === null || monthsCovered < 1
    ? 'text-destructive'
    : monthsCovered < 3
      ? 'text-warning'
      : 'text-success';
  const coverageBar = monthsCovered === null || monthsCovered < 1
    ? '[&>div]:bg-destructive'
    : monthsCovered < 3
      ? '[&>div]:bg-warning'
      : '[&>div]:bg-success';

  return (
    <Card className="rounded-3xl border-border/80 shadow-card">
      <CardHeader className="gap-1 px-5 pb-3 pt-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg font-semibold tracking-tight">Cobertura de caixa</CardTitle>
        </div>
        <p className="text-sm leading-5 text-muted-foreground">Quanto o saldo disponível em conta e poupança cobre das suas despesas médias.</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        {loading ? (
          <div className="space-y-4" role="status" aria-label="Carregando cobertura de caixa">
            <div className="h-10 w-36 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-2 animate-pulse rounded-full bg-muted/60" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted/60" />
          </div>
        ) : error ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
            <AlertCircle className="mb-3 h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível calcular a cobertura</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setRefreshKey((key) => key + 1)}>Tentar novamente</Button>
          </div>
        ) : monthsCovered !== null && data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className={`text-4xl font-semibold tracking-tight tabular-nums ${coverageTone}`}>{monthsCovered.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses</p>
                <p className="mt-1 text-sm text-muted-foreground">de cobertura estimada</p>
              </div>
              <ShieldCheck className={`h-7 w-7 ${coverageTone}`} aria-hidden="true" />
            </div>
            <Progress value={coverageProgress} className={`h-2.5 rounded-full ${coverageBar}`} aria-label={`${coverageProgress.toFixed(0)}% da referência de seis meses`} />
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/35 p-3">
                <p className="text-xs text-muted-foreground">Saldo disponível</p>
                <p className="mt-1 whitespace-nowrap font-semibold tabular-nums text-foreground">{formatCurrency(data.availableCash)}</p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-3">
                <p className="text-xs text-muted-foreground">Média mensal</p>
                <p className="mt-1 whitespace-nowrap font-semibold tabular-nums text-foreground">{formatCurrency(data.averageExpense)}</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Saldo calculado a partir das movimentações pagas. Média baseada nas despesas de {data.monthLabel}, sem transferências ou pagamentos de fatura.</p>
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-muted/35 px-6 text-center">
            <ShieldCheck className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
            <p className="font-medium text-foreground">Ainda não há despesas suficientes para calcular a cobertura</p>
            <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Registre despesas em meses concluídos para acompanhar sua liquidez com precisão.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
