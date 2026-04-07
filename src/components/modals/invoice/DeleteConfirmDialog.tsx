import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Expense } from '@/components/ExpenseTable';

interface DeleteConfirmDialogProps {
  target: Expense | null;
  mode: 'single' | 'all' | null;
  onClose: () => void;
  onDelete: (expense: Expense, mode: 'single' | 'all') => void;
}

export function DeleteConfirmDialog({ target, mode, onClose, onDelete }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target?.installment_group_id && mode === null
              ? 'Excluir parcela'
              : 'Excluir transação?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target?.installment_group_id && mode === null
              ? `Esta é a parcela ${target.installment_info}. O que deseja excluir?`
              : 'Esta ação não pode ser desfeita.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={target?.installment_group_id && mode === null ? 'flex-col gap-2 sm:flex-col' : ''}>
          {target?.installment_group_id && mode === null ? (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => { if (target) onDelete(target, 'single'); }}>
                Apenas esta parcela
              </Button>
              <Button variant="destructive" className="rounded-xl" onClick={() => { if (target) onDelete(target, 'all'); }}>
                Todas as parcelas do grupo
              </Button>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            </>
          ) : (
            <>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (target) onDelete(target, 'single'); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
              >
                Excluir
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
