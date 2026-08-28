import { ArrowLeftRight, PiggyBank, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Surface } from '@/components/ui/surface';

export function DashboardQuickActions() {
  const navigate = useNavigate();
  const actions = [
    {
      label: 'Adicionar',
      icon: Plus,
      onClick: () => window.dispatchEvent(new CustomEvent('lumnia:open-transaction')),
      primary: true,
    },
    { label: 'Atividade', icon: ArrowLeftRight, onClick: () => navigate('/historico') },
    { label: 'Planejar', icon: PiggyBank, onClick: () => navigate('/categorias') },
    {
      label: 'Perguntar',
      icon: Sparkles,
      onClick: () => window.dispatchEvent(new CustomEvent('lumnia:toggle-ai')),
    },
  ];

  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="sr-only">Ações rápidas</h2>
      <Surface variant="base" padding="sm" className="grid grid-cols-4 gap-1 sm:gap-3">
        {actions.map(({ label, icon: Icon, onClick, primary }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-lg px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={primary
              ? 'flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform group-active:scale-95'
              : 'flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground transition-transform group-active:scale-95'
            }>
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            {label}
          </button>
        ))}
      </Surface>
    </section>
  );
}
