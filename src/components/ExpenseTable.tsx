import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  type: 'income' | 'expense';
  is_recurring: boolean;
  frequency: string | null;
}

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  onDeleted: () => void;
  filters: { period: string; category: string };
  onFilterChange: (key: string, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ExpenseTable({ expenses, loading, onDeleted, filters, onFilterChange, page, totalPages, onPageChange }: ExpenseTableProps) {
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Despesa excluída' });
      onDeleted();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={filters.period} onValueChange={v => onFilterChange('period', v)}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Último mês</SelectItem>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={v => onFilterChange('category', v)}>
          <SelectTrigger className="w-[160px] rounded-xl">
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

      <div className="rounded-2xl border bg-card overflow-hidden">
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
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando despesas...
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada. Clique em "Nova Transação" para começar.
                </TableCell>
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
                    <TableCell>
                      <Badge variant={catInfo.variant}>{catInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {exp.category_ai ? (
                        <Badge variant="ai" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          IA
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A despesa será removida permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(exp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
          <p className="text-sm text-muted-foreground">
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
    </div>
  );
}
