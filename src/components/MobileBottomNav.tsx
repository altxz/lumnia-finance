import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BarChart3, FolderKanban, Grid2X2, Home, PiggyBank, Plus, Settings, Sparkles, Tag, TrendingUp, Wallet, X } from 'lucide-react';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { cn } from '@/lib/utils';

const primaryItems = [
  { label: 'Início', path: '/', icon: Home },
  { label: 'Transações', path: '/historico', icon: ArrowLeftRight },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useUserSettings();
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const onAiState = (event: Event) => setAiOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener('lumnia:ai-state', onAiState);
    return () => window.removeEventListener('lumnia:ai-state', onAiState);
  }, []);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const navigateTo = (path: string) => { navigate(path); setMoreOpen(false); };
  const secondaryItems = [
    { label: 'Categorias', path: '/categorias', icon: Tag, visible: true },
    { label: 'Análises', path: '/analytics', icon: BarChart3, visible: true },
    { label: 'Orçamento', path: '/orcamento', icon: PiggyBank, visible: settings.enable_budget_module },
    { label: 'Projetos', path: '/projetos', icon: FolderKanban, visible: settings.enable_projects_module },
    { label: 'Carteira', path: '/wallet', icon: Wallet, visible: true },
    { label: 'Investimentos', path: '/investimentos', icon: TrendingUp, visible: true },
    { label: 'Configurações', path: '/configuracoes', icon: Settings, visible: true },
  ].filter(item => item.visible);
  const moreIsActive = secondaryItems.some(item => isActive(item.path));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[58] md:hidden" role="presentation">
          <button className="absolute inset-0 bg-background/35 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-label="Fechar mais opções" />
          <div className="mobile-more-panel absolute inset-x-3 bottom-[calc(7.45rem+env(safe-area-inset-bottom))] rounded-[28px] p-3 animate-in slide-in-from-bottom-3 fade-in duration-200">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div><p className="text-sm font-semibold text-foreground">Mais opções</p><p className="text-[11px] text-muted-foreground">Navegação do Lumnia</p></div>
              <button onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground" aria-label="Fechar menu"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondaryItems.map(item => (
                <button key={item.path} onClick={() => navigateTo(item.path)} className={cn('flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center transition-colors', isActive(item.path) ? 'bg-primary/16 text-primary ring-1 ring-primary/25' : 'bg-foreground/[0.045] text-muted-foreground hover:text-foreground')}>
                  <item.icon className="h-[19px] w-[19px]" strokeWidth={1.8} /><span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="mobile-bottom-shell fixed inset-x-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] md:hidden" aria-label="Navegação principal">
        <div className="mobile-bottom-nav grid h-[74px] grid-cols-5 items-center rounded-[27px] px-2">
          {primaryItems.map(item => (
            <button key={item.path} onClick={() => navigateTo(item.path)} className={cn('mobile-nav-item', isActive(item.path) && 'is-active')} aria-current={isActive(item.path) ? 'page' : undefined} aria-label={item.label}>
              <span className="mobile-nav-icon"><item.icon className="h-[20px] w-[20px]" strokeWidth={1.8} /></span><span>{item.label}</span>
            </button>
          ))}
          <button onClick={() => window.dispatchEvent(new CustomEvent('lumnia:open-transaction'))} className="mobile-add-button" aria-label="Adicionar nova transação"><Plus className="h-7 w-7" strokeWidth={2.4} /></button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lumnia:toggle-ai'))} className={cn('mobile-nav-item', aiOpen && 'is-active')} aria-label="Abrir inteligência artificial"><span className="mobile-nav-icon"><Sparkles className="h-[20px] w-[20px]" strokeWidth={1.8} /></span><span>IA</span></button>
          <button onClick={() => setMoreOpen(open => !open)} className={cn('mobile-nav-item', (moreOpen || moreIsActive) && 'is-active')} aria-expanded={moreOpen} aria-label="Mais opções"><span className="mobile-nav-icon"><Grid2X2 className="h-[20px] w-[20px]" strokeWidth={1.8} /></span><span>Mais</span></button>
        </div>
      </nav>
    </>
  );
}
