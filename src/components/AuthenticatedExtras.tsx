import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const FloatingActionButton = lazy(() => import('./FloatingActionButton').then(m => ({ default: m.FloatingActionButton })));
const GeniusChatbot = lazy(() => import('./GeniusChatbot').then(m => ({ default: m.GeniusChatbot })));

export function AuthenticatedExtras() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <FloatingActionButton />
      <GeniusChatbot />
    </Suspense>
  );
}
