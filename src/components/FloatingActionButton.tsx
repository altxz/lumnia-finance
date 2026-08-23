import { useState, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';

const AddExpenseModal = lazyNamedWithRetry(() => import('./AddExpenseModal'), m => m.AddExpenseModal);

interface FloatingActionButtonProps {
  onCreated?: () => void;
}

export function FloatingActionButton({ onCreated }: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 sm:right-6 z-40 h-11 w-11 md:h-14 md:w-14 rounded-full gradient-primary text-primary-foreground shadow-float hover:brightness-105 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Adicionar lançamento rápido"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <AddExpenseModal open={open} onOpenChange={setOpen} onExpenseAdded={() => onCreated?.()} />
        </Suspense>
      )}
    </>
  );
}
