import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';
import { UpdateBanner } from './UpdateBanner';
import { BankTransactionCapture } from './BankTransactionCapture';
import { MobileBottomNav } from './MobileBottomNav';

const FloatingActionButton = lazyNamedWithRetry(() => import('./FloatingActionButton'), m => m.FloatingActionButton);

export function AuthenticatedExtras() {
  const { user } = useAuth();
  useRealtimeSync();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <FloatingActionButton />
      <MobileBottomNav />
      <UpdateBanner />
      <BankTransactionCapture />
    </Suspense>
  );
}

