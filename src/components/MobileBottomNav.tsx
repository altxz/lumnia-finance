import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Home, PiggyBank, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof Home;
  activePaths: string[];
}

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const planningPath = '/categorias';
  const items: NavigationItem[] = [
    { label: 'Resumo', path: '/', icon: Home, activePaths: ['/'] },
    { label: 'Atividade', path: '/historico', icon: ArrowLeftRight, activePaths: ['/historico'] },
    { label: 'Planejar', path: planningPath, icon: PiggyBank, activePaths: ['/orcamento', '/categorias', '/projetos'] },
  ];

  const isActive = (item: NavigationItem) => item.activePaths.some(path => (
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  ));

  const renderItem = (item: NavigationItem) => (
    <button
      key={item.label}
      type="button"
      onClick={() => navigate(item.path)}
      className={cn('mobile-nav-item', isActive(item) && 'is-active')}
      aria-current={isActive(item) ? 'page' : undefined}
      aria-label={item.label}
    >
      <span className="mobile-nav-icon"><item.icon className="h-[20px] w-[20px]" strokeWidth={1.8} /></span>
      <span>{item.label}</span>
    </button>
  );

  return (
    <nav className="mobile-bottom-shell fixed inset-x-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] md:hidden" aria-label="Navegação principal">
      <div className="mobile-bottom-nav grid h-[70px] grid-cols-5 items-center rounded-[24px] px-1.5">
        {renderItem(items[0])}
        {renderItem(items[1])}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('lumnia:open-transaction'))}
          className="mobile-add-button"
          aria-label="Adicionar nova transação"
        >
          <Plus className="h-6 w-6" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('lumnia:toggle-ai'))}
          className="mobile-nav-item"
          aria-label="Abrir inteligência Lumnia"
        >
          <span className="mobile-nav-icon"><Sparkles className="h-[20px] w-[20px]" strokeWidth={1.8} /></span>
          <span>IA</span>
        </button>
        {renderItem(items[2])}
      </div>
    </nav>
  );
}
