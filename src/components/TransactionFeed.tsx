import { useMemo, useState } from 'react';
import { Clock, Utensils, Car, Gamepad2, Heart, Home, GraduationCap, Tag, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CATEGORIES, formatCurrency } from '@/lib/constants';
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

export function TransactionFeed({ expenses, loading, onDeleted, filters, onFilterChange, page, totalPages, onPageChange, wallets = [] }: TransactionFeedProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach(exp => {
      const key = exp.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const walletMap = useMemo(() => {
    const m: Record<string, string> = {};
    wallets.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [wallets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Select value={filters.category} onValueChange={v => onFilterChange('category', v)}>
          <SelectTrigger className="w-[130px] sm:w-[160px] rounded-xl text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Carregando...</p>
      ) : expenses.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {formatGroupDate(dateKey)}
              </h3>
              <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border">
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
                          <ArrowLeftRight className={`h-4.5 w-4.5 ${catData.text}`} />
                        ) : (
                          <Icon className={`h-4.5 w-4.5 ${catData.text}`} />
                        )}
                      </div>

                      {/* Description + wallet */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{exp.description}</p>
                        {walletName && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{walletName}</span>
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
