import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, PiggyBank, Receipt, Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const STEPS = [
  { icon: Sparkles, title: 'Bem-vindo à Lumnia!', subtitle: 'Vamos configurar a sua conta em 3 passos rápidos.' },
  { icon: Wallet, title: 'Crie sua primeira conta', subtitle: 'Onde você guarda seu dinheiro?' },
  { icon: PiggyBank, title: 'Defina um orçamento', subtitle: 'Quanto pretende gastar por mês?' },
  { icon: Receipt, title: 'Adicione sua primeira despesa', subtitle: 'Registre um gasto recente.' },
];

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Wallet
  const [walletName, setWalletName] = useState('Conta Principal');
  const [walletBalance, setWalletBalance] = useState('');
  const [walletType, setWalletType] = useState('checking_account');

  // Step 2: Budget
  const [budgetAmount, setBudgetAmount] = useState('');

  // Step 3: Expense
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Alimentação');

  const [createdWalletId, setCreatedWalletId] = useState<string | null>(null);

  const handleNext = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (step === 1) {
        // Create wallet
        const balance = parseFloat(walletBalance) || 0;
        const { data, error } = await supabase.from('wallets').insert({
          user_id: user.id,
          name: walletName || 'Conta Principal',
          asset_type: walletType,
          initial_balance: balance,
          current_balance: balance,
        }).select('id').single();
        if (error) throw error;
        setCreatedWalletId(data.id);
        toast({ title: '✅ Conta criada!', description: `${walletName} com saldo de R$ ${balance.toFixed(2)}` });
      } else if (step === 2) {
        // Create budget
        const amount = parseFloat(budgetAmount) || 0;
        if (amount > 0) {
          const now = new Date();
          const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          await supabase.from('budgets').insert({
            user_id: user.id,
            category: 'Geral',
            allocated_amount: amount,
            month_year: monthYear,
          });
          toast({ title: '✅ Orçamento definido!', description: `R$ ${amount.toFixed(2)} para este mês` });
        }
      } else if (step === 3) {
        // Create expense
        const value = parseFloat(expenseValue) || 0;
        if (value > 0 && expenseDesc) {
          await supabase.from('expenses').insert({
            user_id: user.id,
            description: expenseDesc,
            value,
            final_category: expenseCategory,
            type: 'expense',
            is_paid: true,
            wallet_id: createdWalletId,
          });
          toast({ title: '✅ Despesa registada!', description: `${expenseDesc}: R$ ${value.toFixed(2)}` });
        }

        // Mark onboarding as completed
        await supabase.from('user_settings').update({ onboarding_completed: true }).eq('user_id', user.id);
        onComplete();
        return;
      }

      setStep(s => s + 1);
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast({ title: 'Erro', description: err.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    await supabase.from('user_settings').update({ onboarding_completed: true }).eq('user_id', user.id);
    onComplete();
  };

  const StepIcon = STEPS[step].icon;
  const isLastStep = step === 3;
  const canProceed = step === 0
    || (step === 1 && walletName.trim())
    || (step === 2)
    || (step === 3 && expenseDesc.trim() && parseFloat(expenseValue) > 0);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 rounded-2xl overflow-hidden [&>button]:hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <StepIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{STEPS[step].title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
            </div>
          </div>

          {/* Step Content */}
          {step === 0 && (
            <div className="space-y-3">
              {[
                { icon: Wallet, text: 'Organize contas e carteiras' },
                { icon: PiggyBank, text: 'Controle orçamentos por categoria' },
                { icon: Receipt, text: 'Registre despesas e receitas' },
                { icon: Sparkles, text: 'Converse com a IA financeira' },
              ].map((item, i) => (
                <Card key={i} className="rounded-xl border-muted">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{item.text}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da conta</Label>
                <Input
                  value={walletName}
                  onChange={e => setWalletName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, Carteira"
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={walletType} onValueChange={setWalletType}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking_account">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="stocks">Investimentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo atual (R$)</Label>
                <Input
                  type="number"
                  value={walletBalance}
                  onChange={e => setWalletBalance(e.target.value)}
                  placeholder="0,00"
                  className="rounded-xl h-11"
                  step="0.01"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Limite mensal de gastos (R$)</Label>
                <Input
                  type="number"
                  value={budgetAmount}
                  onChange={e => setBudgetAmount(e.target.value)}
                  placeholder="Ex: 3000"
                  className="rounded-xl h-11"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  Pode ajustar por categoria depois em Orçamento.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Supermercado, Almoço, Uber"
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={expenseValue}
                  onChange={e => setExpenseValue(e.target.value)}
                  placeholder="0,00"
                  className="rounded-xl h-11"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="rounded-xl gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleSkip} className="rounded-xl text-muted-foreground">
                Pular setup
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed || loading}
              className="rounded-xl gap-1 bg-primary text-primary-foreground"
            >
              {loading ? 'Salvando...' : isLastStep ? (
                <><Check className="h-4 w-4" /> Concluir</>
              ) : (
                <>Continuar <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === step ? 'bg-primary w-6' : i < step ? 'bg-primary/40' : 'bg-muted-foreground/20'
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
