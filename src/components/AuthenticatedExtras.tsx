import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const FloatingActionButton = lazy(() => import('./FloatingActionButton').then(m => ({ default: m.FloatingActionButton })));
const GeniusChatbot = lazy(() => import('./GeniusChatbot').then(m => ({ default: m.GeniusChatbot })));

export function AuthenticatedExtras() {
  const { user } = useAuth();
  useRealtimeSync();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <FloatingActionButton />
      <GeniusChatbot />
    </Suspense>
  );
}
