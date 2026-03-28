import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddExpenseModal } from './AddExpenseModal';

interface FloatingActionButtonProps {
  onCreated?: () => void;
}

export function FloatingActionButton({ onCreated }: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 md:hidden z-50 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Adicionar lançamento rápido"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
      <AddExpenseModal open={open} onOpenChange={setOpen} onExpenseAdded={() => onCreated?.()} />
    </>
  );
}
