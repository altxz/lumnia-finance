import { useCallback, useEffect, useRef, useState } from 'react';
import { BUILD_ID, clearPersistedCache } from '@/lib/queryClient';
import { forceAppUpdate, onServiceWorkerUpdateReady } from '@/lib/registerServiceWorker';

const CHECK_INTERVAL = 60_000;

/**
 * Deteta se existe uma versão publicada mais recente do que a que está a correr.
 *
 * Duas fontes:
 * - /version.json (gerado em cada build, sempre buscado à rede);
 * - o service worker, quando já tem uma versão nova em espera.
 */
export function useAppVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const dismissedRef = useRef(false);

  const check = useCallback(async () => {
    if (!import.meta.env.PROD || dismissedRef.current) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (data?.buildId && data.buildId !== BUILD_ID) {
        setUpdateAvailable(true);
      }
    } catch {
      // sem rede ou ficheiro ausente — ignorar em silêncio
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    void check();
    const interval = setInterval(() => void check(), CHECK_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', () => void check());

    const offSw = onServiceWorkerUpdateReady(() => {
      if (!dismissedRef.current) setUpdateAvailable(true);
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      offSw();
    };
  }, [check]);

  const applyUpdate = useCallback(() => {
    clearPersistedCache();
    void forceAppUpdate();
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate, dismiss };
}
