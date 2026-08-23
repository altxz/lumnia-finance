import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';
import { UpdateBanner } from './UpdateBanner';
import { BankTransactionCapture } from './BankTransactionCapture';

const FloatingActionButton = lazyNamedWithRetry(() => import('./FloatingActionButton'), m => m.FloatingActionButton);
const GeniusChatbot = lazyNamedWithRetry(() => import('./GeniusChatbot'), m => m.GeniusChatbot);

export function AuthenticatedExtras() {
  const { user } = useAuth();
  useRealtimeSync();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <FloatingActionButton />
      <GeniusChatbot />
      <UpdateBanner />
      <BankTransactionCapture />
    </Suspense>
  );
}

