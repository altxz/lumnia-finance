import { Suspense, useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BankNotificationCapture, type DetectedBankTransaction } from '@/lib/bankNotificationCapture';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';

const AddExpenseModal = lazyNamedWithRetry(() => import('./AddExpenseModal'), m => m.AddExpenseModal);

export function BankTransactionCapture() {
  const [transaction, setTransaction] = useState<DetectedBankTransaction | null>(null);

  const checkPending = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const result = await BankNotificationCapture.getPendingTransaction();
      if (result.transaction) setTransaction(result.transaction);
    } catch (error) {
      console.warn('Não foi possível consultar a transação bancária pendente', error);
    }
  }, []);

  useEffect(() => {
    void checkPending();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !transaction) void checkPending();
    }, 1200);
    const onVisible = () => { if (document.visibilityState === 'visible') void checkPending(); };
    window.addEventListener('focus', checkPending);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkPending);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkPending, transaction]);

  if (!transaction) return null;
  return (
    <Suspense fallback={null}>
      <AddExpenseModal
        open
        initialData={transaction}
        onOpenChange={open => { if (!open) setTransaction(null); }}
        onExpenseAdded={() => setTransaction(null)}
      />
    </Suspense>
  );
}
