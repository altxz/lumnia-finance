import { useCallback, useEffect, useState } from 'react';

/**
 * Detecta conectividade real, não só `navigator.onLine` (que fica `true` em Wi-Fi
 * sem internet). Faz um ping leve ao health-check do Supabase para confirmar.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      setIsOnline(typeof navigator === 'undefined' || navigator.onLine);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(`${supabaseUrl}/auth/v1/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => { void checkConnectivity(); };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkConnectivity();
    };

    void checkConnectivity();
    const interval = window.setInterval(() => { void checkConnectivity(); }, 15000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkConnectivity]);

  return isOnline;
}
