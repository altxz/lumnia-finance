import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, getCategoryLabel } from '@/lib/constants';
import type { Expense } from '@/components/ExpenseTable';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface InvoiceTransactionListProps {
  transactions: Expense[];
  onEdit: (tx: Expense) => void;
  onDelete: (tx: Expense) => void;
}

export function InvoiceTransactionList({ transactions, onEdit, onDelete }: InvoiceTransactionListProps) {
  const byCategory = useMemo(() => {
    const groups: Record<string, { label: string; total: number; items: Expense[] }> = {};
    transactions.forEach(tx => {
      const cat = tx.final_category;
      if (!groups[cat]) {
        groups[cat] = { label: getCategoryLabel(cat), total: 0, items: [] };
      }
      groups[cat].total += tx.value;
      groups[cat].items.push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [transactions]);

  const chronological = useMemo(() => {
    return [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  if (chronological.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Nenhuma transação nesta fatura
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category summary */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Por categoria
        </h4>
        <div className="space-y-0.5">
          {byCategory.map(([cat, data]) => (
            <div
              key={cat}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Badge variant="secondary" className="text-xs shrink-0">{data.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {data.items.length} {data.items.length === 1 ? 'transação' : 'transações'}
                </span>
              </div>
              <span className="text-sm font-bold shrink-0">{formatCurrency(data.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All transactions */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Todas as transações
        </h4>
        <div className="space-y-0.5">
          {chronological.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-relaxed">{tx.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {tx.installment_info && ` · ${tx.installment_info}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-destructive whitespace-nowrap">
                  -{formatCurrency(tx.value)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground" aria-label={`Ações de ${tx.description}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="floating-glass w-52 rounded-2xl p-2">
                    <DropdownMenuItem className="gap-2 rounded-xl" onClick={() => onEdit(tx)}>
                      <Pencil className="h-4 w-4" />
                      Editar transação
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 rounded-xl text-destructive focus:text-destructive" onClick={() => onDelete(tx)}>
                      <Trash2 className="h-4 w-4" />
                      Excluir transação
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
