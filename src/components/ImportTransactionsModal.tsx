import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIES } from '@/lib/constants';

interface ParsedTransaction {
  date: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
  selected: boolean;
  category: string;
}

interface AutomationRule {
  condition_operator: string;
  condition_value: string;
  target_category: string;
}

interface WalletOption {
  id: string;
  name: string;
}

interface ImportTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const separator = header.includes(';') ? ';' : ',';
  const headers = header.split(separator).map(h => h.trim().replace(/"/g, ''));

  const dateIdx = headers.findIndex(h => /data|date/.test(h));
  const descIdx = headers.findIndex(h => /descri|description|hist|memo/.test(h));
  const valueIdx = headers.findIndex(h => /valor|value|amount|quantia/.test(h));

  if (dateIdx === -1 || descIdx === -1 || valueIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(separator).map(c => c.trim().replace(/"/g, ''));
    const rawDate = cols[dateIdx];
    const description = cols[descIdx];
    const rawValue = cols[valueIdx];

    if (!rawDate || !description || !rawValue) continue;

    // Parse value: handle "1.234,56" (BR) and "1,234.56" (US)
    let numericValue: number;
    if (rawValue.includes(',') && rawValue.lastIndexOf(',') > rawValue.lastIndexOf('.')) {
      // BR format: 1.234,56
      numericValue = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));
    } else {
      numericValue = parseFloat(rawValue.replace(/,/g, ''));
    }

    if (isNaN(numericValue)) continue;

    // Parse date: handle dd/mm/yyyy, yyyy-mm-dd
    let isoDate: string;
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(rawDate)) {
      const parts = rawDate.split(/[\/\-]/);
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(rawDate)) {
      isoDate = rawDate.replace(/\//g, '-');
    } else {
      continue;
    }

    const isIncome = numericValue > 0;
    transactions.push({
      date: isoDate,
      description,
      value: Math.abs(numericValue),
      type: isIncome ? 'income' : 'expense',
      selected: true,
      category: isIncome ? 'salary' : 'outros',
    });
  }

  return transactions;
}

export function ImportTransactionsModal({ open, onOpenChange, onImported }: ImportTransactionsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [walletId, setWalletId] = useState('');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  useEffect(() => {
    if (!open || !user) return;
    supabase.from('wallets').select('id, name').eq('user_id', user.id).then(({ data }) => {
      setWallets(data || []);
    });
  }, [open, user]);

  const reset = () => {
    setTransactions([]);
    setFileName('');
    setWalletId('');
    setStep('upload');
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Formato inválido', description: 'Por favor, selecione um ficheiro .csv', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast({ title: 'CSV inválido', description: 'Não foi possível encontrar colunas de Data, Descrição e Valor.', variant: 'destructive' });
        return;
      }
      setTransactions(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const toggleAll = (checked: boolean) => {
    setTransactions(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  const toggleOne = (index: number) => {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const selectedCount = transactions.filter(t => t.selected).length;

  const handleImport = async () => {
    if (!user || !walletId) return;
    const selected = transactions.filter(t => t.selected);
    if (selected.length === 0) return;

    setImporting(true);
    const rows = selected.map(t => ({
      user_id: user.id,
      date: t.date,
      description: t.description,
      value: t.value,
      type: t.type,
      final_category: t.type === 'income' ? 'salary' : 'other',
      wallet_id: walletId,
    }));

    const { error } = await supabase.from('expenses').insert(rows);
    setImporting(false);

    if (error) {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Importação concluída', description: `${selected.length} transações importadas com sucesso.` });
      onImported();
      onOpenChange(false);
    }
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Transações
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground font-medium mb-1">Arraste o ficheiro CSV aqui</p>
            <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-3">Formato esperado: Data, Descrição, Valor</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium text-foreground">{fileName}</span>
                <span>— {transactions.length} transações encontradas</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Conta de destino:</Label>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {wallets.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Crie primeiro uma conta/carteira na página de Património.
              </div>
            )}

            <div className="border rounded-lg overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedCount === transactions.length}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t, i) => (
                    <TableRow key={i} className={!t.selected ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox checked={t.selected} onCheckedChange={() => toggleOne(i)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.type === 'income'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {t.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'preview' && (
            <Button variant="outline" onClick={reset}>
              Voltar
            </Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={importing || !walletId || selectedCount === 0}
              className="gap-2"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Importação ({selectedCount})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
