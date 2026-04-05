import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, CreditCard, Receipt, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; route: string };
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Suas carteiras',
    description: 'Adicione suas contas bancárias e carteiras para acompanhar seus saldos em tempo real.',
    action: { label: 'Ir para Carteiras', route: '/wallet' },
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'Cartões de crédito',
    description: 'Cadastre seus cartões de crédito para controlar faturas, limites e vencimentos automaticamente.',
    action: { label: 'Cadastrar cartão', route: '/wallet' },
  },
  {
    icon: <Receipt className="h-6 w-6" />,
    title: 'Registrar transações',
    description: 'Adicione suas despesas e receitas manualmente ou importe extratos bancários (CSV/OFX).',
    action: { label: 'Ver transações', route: '/historico' },
  },
];

export function GuidedTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      // Show tour if no settings record exists OR if onboarding not completed
      if (!data || !data.onboarding_completed) {
        setShow(true);
      }
    };
    checkOnboarding();
  }, [user]);

  const completeTour = async () => {
    setShow(false);
    if (!user) return;
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: 'user_id' });
  };

  const handleSkip = () => completeTour();

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handleAction = (route: string) => {
    completeTour();
    navigate(route);
  };

  if (!show) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header with skip */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {step.icon}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {currentStep + 1} de {TOUR_STEPS.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tour
          </Button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

          {step.action && (
            <button
              onClick={() => handleAction(step.action!.route)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mt-2"
            >
              <ChevronRight className="h-4 w-4" />
              {step.action.label}
            </button>
          )}
        </div>

        {/* Footer with dots and next */}
        <div className="flex items-center justify-between px-5 pb-5 pt-2">
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentStep
                    ? 'w-6 bg-primary'
                    : i < currentStep
                      ? 'w-1.5 bg-primary/40'
                      : 'w-1.5 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            size="sm"
            className="rounded-xl px-5"
          >
            {isLast ? 'Começar' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
