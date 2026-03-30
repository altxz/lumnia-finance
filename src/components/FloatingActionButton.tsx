import { useState, lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';

const AddExpenseModal = lazy(() => import('./AddExpenseModal').then(m => ({ default: m.AddExpenseModal })));

interface FloatingActionButtonProps {
  onCreated?: () => void;
}

export function FloatingActionButton({ onCreated }: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 md:hidden z-40 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Adicionar lançamento rápido"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <AddExpenseModal open={open} onOpenChange={setOpen} onExpenseAdded={() => onCreated?.()} />
        </Suspense>
      )}
    </>
  );
}
