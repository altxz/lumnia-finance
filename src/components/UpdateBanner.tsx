import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';

/**
 * Aviso discreto de nova versão publicada, com ação de atualizar imediatamente.
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate, dismiss } = useAppVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed z-50 left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm animate-in fade-in slide-in-from-bottom-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <RefreshCw className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Nova versão disponível</p>
            <p className="text-xs text-muted-foreground">
              Atualize para carregar a versão mais recente do app.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={dismiss}>
            Agora não
          </Button>
          <Button size="sm" className="rounded-xl gap-2" onClick={applyUpdate}>
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar agora
          </Button>
        </div>
      </div>
    </div>
  );
}
