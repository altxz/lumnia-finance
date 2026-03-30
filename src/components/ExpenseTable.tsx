import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, ChevronLeft, ChevronRight, Sparkles, CheckCircle } from 'lucide-react';
import { CATEGORIES, getCategoryInfo, formatCurrency, formatDate } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface Expense {
  id: string;
  date: string;
  description: string;
  value: number;
  category_ai: string | null;
  final_category: string;
  created_at: string;
  type: 'income' | 'expense' | 'transfer';
  is_recurring: boolean;
  frequency: string | null;
  credit_card_id: string | null;
  installments: number;
  wallet_id: string | null;
  destination_wallet_id: string | null;
  is_paid: boolean;
  notes: string | null;
  tags: string[] | null;
  installment_group_id: string | null;
  installment_info: string | null;
  invoice_month: string | null;
  project_id: string | null;
  debt_id: string | null;
  payment_method: string | null;
}

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  onDeleted: () => void;
  filters: { category: string };
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ExpenseTable({ expenses, loading, onDeleted, filters, onFilterChange, page, totalPages, onPageChange }: ExpenseTableProps) {
  const { toast } = useToast();
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (exp: Expense) => {
    setDeletingExpense(exp);
    setDeleteMode(exp.is_recurring ? null : 'single');
  };

  const handleDelete = async (mode: 'single' | 'all') => {
    if (!deletingExpense) return;
    setDeleting(true);
    try {
      if (mode === 'all') {
        const { error } = await supabase.from('expenses').delete()
          .eq('description', deletingExpense.description)
          .eq('type', deletingExpense.type)
          .eq('value', deletingExpense.value)
          .eq('is_recurring', true);
        if (error) throw error;
        toast({ title: 'Todas as recorrências excluídas' });
      } else {
        const { error } = await supabase.from('expenses').delete().eq('id', deletingExpense.id);
        if (error) throw error;
        toast({ title: 'Despesa excluída' });
      }
      onDeleted();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeletingExpense(null);
      setDeleteMode(null);
    }
  };

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

      {/* Mobile card view */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : expenses.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</p>
        ) : expenses.map(exp => {
          const catInfo = getCategoryInfo(exp.final_category);
          return (
            <Card key={exp.id} className="rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{exp.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(exp.date)}</span>
                      <Badge variant={catInfo.variant} className="text-[10px] px-1.5 py-0">{catInfo.label}</Badge>
                      <Badge variant={exp.type === 'income' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {exp.type === 'income' ? 'Receita' : exp.type === 'transfer' ? 'Transf.' : 'Despesa'}
                      </Badge>
                      {exp.is_recurring && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{exp.frequency === 'annual' ? 'Anual' : 'Mensal'}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-sm font-bold ${exp.type === 'income' ? 'text-green-600' : ''}`}>
                      {exp.type === 'income' ? '+' : ''}{formatCurrency(exp.value)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => handleDeleteClick(exp)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block rounded-2xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Descrição</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="text-right font-semibold">Valor</TableHead>
              <TableHead className="font-semibold">Categoria</TableHead>
              <TableHead className="font-semibold">Status IA</TableHead>
              <TableHead className="text-right font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando despesas...</TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</TableCell>
              </TableRow>
            ) : (
              expenses.map(exp => {
                const catInfo = getCategoryInfo(exp.final_category);
                return (
                  <TableRow key={exp.id}>
                    <TableCell className="font-medium">{formatDate(exp.date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {exp.description}
                      {exp.is_recurring && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{exp.frequency === 'annual' ? 'Anual' : 'Mensal'}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.type === 'income' ? 'default' : 'secondary'} className="text-xs">
                        {exp.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${exp.type === 'income' ? 'text-green-600' : ''}`}>{exp.type === 'income' ? '+' : ''}{formatCurrency(exp.value)}</TableCell>
                    <TableCell><Badge variant={catInfo.variant}>{catInfo.label}</Badge></TableCell>
                    <TableCell>
                      {exp.category_ai ? (
                        <Badge variant="ai" className="gap-1"><Sparkles className="h-3 w-3" />IA</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl" onClick={() => handleDeleteClick(exp)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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

      <AlertDialog open={!!deletingExpense} onOpenChange={(open) => { if (!open) { setDeletingExpense(null); setDeleteMode(null); } }}>
        <AlertDialogContent className="rounded-2xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingExpense?.is_recurring && deleteMode === null
                ? 'Esta é uma transação recorrente. Deseja excluir apenas este lançamento ou todos os lançamentos recorrentes?'
                : 'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={deletingExpense?.is_recurring && deleteMode === null ? 'flex-col sm:flex-row gap-2' : ''}>
            <AlertDialogCancel className="rounded-xl" onClick={() => { setDeletingExpense(null); setDeleteMode(null); }}>Cancelar</AlertDialogCancel>
            {deletingExpense?.is_recurring && deleteMode === null ? (
              <>
                <Button variant="outline" className="rounded-xl" disabled={deleting} onClick={() => handleDelete('single')}>
                  Apenas esta
                </Button>
                <Button variant="destructive" className="rounded-xl" disabled={deleting} onClick={() => handleDelete('all')}>
                  {deleting ? 'Excluindo...' : 'Todas as recorrências'}
                </Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => handleDelete('single')} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
