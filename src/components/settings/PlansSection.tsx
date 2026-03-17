import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Crown, Sparkles } from 'lucide-react';

interface PlansSectionProps {
  plan: string;
  expenseCount: number;
}

const PLAN_LIMIT = { free: 100, premium: 999999 };

const features = [
  { name: '100 despesas/mês', free: true, premium: true },
  { name: 'Despesas ilimitadas', free: false, premium: true },
  { name: 'Categorização por IA', free: true, premium: true },
  { name: 'Exportar CSV', free: true, premium: true },
  { name: 'Modelos avançados de IA', free: false, premium: true },
  { name: 'Regras de automação', free: '3 regras', premium: 'Ilimitadas' },
  { name: 'Contexto pessoal para IA', free: false, premium: true },
  { name: 'Relatórios avançados', free: false, premium: true },
  { name: 'Suporte prioritário', free: false, premium: true },
];

export function PlansSection({ plan, expenseCount }: PlansSectionProps) {
  const limit = plan === 'premium' ? PLAN_LIMIT.premium : PLAN_LIMIT.free;
  const usage = Math.min((expenseCount / 100) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className={`rounded-2xl border-2 ${plan === 'premium' ? 'border-accent bg-accent/5' : 'border-primary/20'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {plan === 'premium' ? <Crown className="h-5 w-5 text-accent-foreground" /> : <Sparkles className="h-5 w-5 text-primary" />}
                Plano {plan === 'premium' ? 'Premium' : 'Gratuito'}
              </CardTitle>
              <CardDescription>
                {plan === 'premium' ? 'Acesso completo a todas as funcionalidades' : 'Funcionalidades básicas com limite mensal'}
              </CardDescription>
            </div>
            <Badge variant={plan === 'premium' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {plan === 'premium' ? 'Ativo' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan !== 'premium' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uso mensal</span>
                  <span className="font-semibold">{expenseCount}/100 despesas</span>
                </div>
                <Progress value={usage} className="h-3 rounded-full" />
                {usage >= 80 && <p className="text-xs text-destructive font-medium">⚠️ Você está perto do limite mensal</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upgrade card */}
      {plan !== 'premium' && (
        <Card className="rounded-2xl bg-gradient-to-br from-primary to-ai text-primary-foreground overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8" />
              <div>
                <h3 className="text-xl font-bold">Upgrade para Premium</h3>
                <p className="text-sm opacity-80">Desbloqueie todo o potencial da IA</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">R$ 29</span>
              <span className="text-sm opacity-70">/mês</span>
            </div>
            <Button className="w-full rounded-xl h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base">
              <Crown className="h-5 w-5 mr-2" />
              Assinar Premium
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Features comparison */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Comparativo de Planos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span>Funcionalidade</span>
              <span className="text-center">Gratuito</span>
              <span className="text-center">Premium</span>
            </div>
            {features.map(f => (
              <div key={f.name} className="grid grid-cols-3 gap-2 text-sm items-center">
                <span>{f.name}</span>
                <div className="text-center">
                  {f.free === true ? <CheckCircle className="h-4 w-4 text-accent-foreground mx-auto" /> :
                   f.free === false ? <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" /> :
                   <span className="text-xs text-muted-foreground">{f.free}</span>}
                </div>
                <div className="text-center">
                  {f.premium === true ? <CheckCircle className="h-4 w-4 text-accent-foreground mx-auto" /> :
                   <span className="text-xs font-medium">{f.premium}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
