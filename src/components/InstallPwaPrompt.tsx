import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const getIsIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const getIsStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && (navigator as any).standalone);

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (getIsStandalone()) return;

    if (getIsIos()) {
      setShowIosBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed) return null;
  if (!deferredPrompt && !showIosBanner) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {showIosBanner ? (
            <Share className="h-4 w-4 text-primary" />
          ) : (
            <Download className="h-4 w-4 text-primary" />
          )}
        </div>
        <p className="text-sm font-medium leading-snug">
          {showIosBanner
            ? 'Para instalar: toque em Compartilhar (□↑) e selecione "Adicionar à Tela de Início"'
            : 'Instalar a Lumnia no seu dispositivo'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!showIosBanner && (
          <Button size="sm" onClick={handleInstall} className="rounded-lg h-8 text-xs font-semibold">
            Instalar
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
