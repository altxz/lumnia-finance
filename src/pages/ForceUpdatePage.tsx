import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearPersistedCache } from '@/lib/queryClient';
import { forceAppUpdate } from '@/lib/registerServiceWorker';

/**
 * Página de recuperação (/atualizar): limpa service workers, caches e o cache de
 * dados local, e recarrega o app ignorando o cache do browser.
 *
 * Serve para dispositivos que ficaram presos numa versão antiga e por isso não
 * têm o botão "Forçar atualização" dentro das Configurações.
 */
export default function ForceUpdatePage() {
  const [status, setStatus] = useState('A limpar a versão antiga...');

  useEffect(() => {
    const run = async () => {
      try {
        clearPersistedCache();
      } catch {
        // ignorar
      }
      setStatus('A carregar a versão mais recente...');
      await forceAppUpdate();
    };
    const t = setTimeout(() => void run(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <RefreshCw className="h-8 w-8 mx-auto text-primary animate-spin" />
        <h1 className="text-lg font-semibold">Atualizando o Lumnia</h1>
        <p className="text-sm text-muted-foreground">{status}</p>
        <Button
          variant="outline"
          className="rounded-xl w-full"
          onClick={() => {
            clearPersistedCache();
            void forceAppUpdate();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
