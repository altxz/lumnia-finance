import { useMemo, useState } from 'react';
import { Clock, Utensils, Car, Gamepad2, Heart, Home, GraduationCap, Tag, ArrowLeftRight, ChevronLeft, ChevronRight, Wallet, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import type { Expense } from '@/components/ExpenseTable';

const CATEGORY_ICONS: Record<string, { icon: typeof Utensils; bg: string; text: string }> = {
  alimentacao: { icon: Utensils, bg: 'bg-accent/30', text: 'text-accent-foreground' },
  transporte: { icon: Car, bg: 'bg-ai/15', text: 'text-ai' },
  lazer: { icon: Gamepad2, bg: 'bg-pink/30', text: 'text-pink-foreground' },
  saude: { icon: Heart, bg: 'bg-destructive/15', text: 'text-destructive' },
  moradia: { icon: Home, bg: 'bg-primary/15', text: 'text-primary' },
  educacao: { icon: GraduationCap, bg: 'bg-ai/15', text: 'text-ai' },
  outros: { icon: Tag, bg: 'bg-muted', text: 'text-muted-foreground' },
  transferencia: { icon: ArrowLeftRight, bg: 'bg-primary/15', text: 'text-primary' },
};

interface TransactionFeedProps {
  expenses: Expense[];
  loading: boolean;
  onDeleted: () => void;
  filters: { category: string };
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  wallets?: { id: string; name: string }[];
  startingMonthBalance?: number;
}

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = new Date(date);
  d.setHours(12, 0, 0, 0);

  if (d.getTime() === today.getTime()) return 'Hoje';
  if (d.getTime() === yesterday.getTime()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });
}

export function TransactionFeed({ expenses, loading, onDeleted, page, totalPages, onPageChange, wallets = [], startingMonthBalance = 0 }: TransactionFeedProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deletingExpense) return;
    setDeleting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', deletingExpense.id);
    setDeleting(false);
    setDeletingExpense(null);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transação excluída' });
      onDeleted();
    }
  };
  const grouped = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach(exp => {
      const key = exp.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    let runningBalance = startingMonthBalance;
    const result: { dateKey: string; items: Expense[]; endOfDayBalance: number }[] = [];

    for (const [dateKey, items] of sorted) {
      for (const exp of items) {
        if (exp.type === 'transfer') continue;
        if (!exp.is_paid) continue;
        if (exp.type === 'income') runningBalance += exp.value;
        else if (!exp.credit_card_id) runningBalance -= exp.value;
      }
      result.push({ dateKey, items, endOfDayBalance: runningBalance });
    }

    return result.reverse();
  }, [expenses, startingMonthBalance]);

  const walletMap = useMemo(() => {
    const m: Record<string, string> = {};
    wallets.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [wallets]);

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Carregando...</p>
      ) : expenses.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ dateKey, items, endOfDayBalance }) => (
            <div key={dateKey}>
              {/* Day header — Mobills style */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/60 rounded-t-xl border border-b-0 border-border">
                <h3 className="text-sm font-bold text-foreground capitalize">
                  {formatGroupDate(dateKey)}
                </h3>
                <div className={`flex items-center gap-1.5 text-sm font-bold ${endOfDayBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{endOfDayBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(endOfDayBalance))}</span>
                </div>
              </div>

              {/* Transactions list */}
              <div className="rounded-b-xl border border-t-0 bg-card overflow-hidden divide-y divide-border">
                {items.map(exp => {
                  const catData = CATEGORY_ICONS[exp.final_category] || CATEGORY_ICONS.outros;
                  const Icon = catData.icon;
                  const isIncome = exp.type === 'income';
                  const isTransfer = exp.type === 'transfer';
                  const isPending = !exp.is_paid;
                  const walletName = exp.wallet_id ? walletMap[exp.wallet_id] : null;

                  return (
                    <button
                      key={exp.id}
                      onClick={() => setEditingExpense(exp)}
                      className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      {/* Category icon */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${catData.bg}`}>
                        {isTransfer ? (
                          <ArrowLeftRight className="h-4.5 w-4.5" />
                        ) : (
                          <Icon className={`h-4.5 w-4.5 ${catData.text}`} />
                        )}
                      </div>

                      {/* Description + wallet */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={exp.description}>{exp.description}</p>
                        {walletName && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate" title={walletName}>{walletName}</span>
                          </div>
                        )}
                      </div>

                      {/* Value */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isPending && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={`text-sm font-bold ${
                          isPending
                            ? 'text-muted-foreground'
                            : isIncome
                              ? 'text-emerald-600'
                              : isTransfer
                                ? 'text-foreground'
                                : 'text-destructive'
                        }`}>
                          {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(exp.value)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="rounded-xl">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {editingExpense && (
        <EditExpenseModal
          open={!!editingExpense}
          expense={editingExpense}
          onOpenChange={(open) => { if (!open) setEditingExpense(null); }}
          onExpenseUpdated={() => { setEditingExpense(null); onDeleted(); }}
        />
      )}
    </div>
  );
}
