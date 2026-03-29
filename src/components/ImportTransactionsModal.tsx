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
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();

  // Detecta padrão Nubank (date,title,amount)
  const isNubank = headerLine.includes('date') && headerLine.includes('title') && headerLine.includes('amount');

  const delimiter = headerLine.includes(';') ? ';' : ',';

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Divide respeitando aspas (descrições com vírgulas)
    const row = delimiter === ';'
      ? lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''))
      : lines[i].match(/(?:"[^"]*"|[^,]+)+/g)?.map(c => c.trim().replace(/^"|"$/g, ''));

    if (!row || row.length < 3) continue;

    const rawDate = row[0].trim();
    const rawDesc = row[1].trim();
    const rawValue = row[2].trim();

    // Parse valor: aceita "1.234,56" (BR) e "1234.56" (US/Nubank)
    let numericValue: number;
    if (rawValue.includes(',') && rawValue.lastIndexOf(',') > rawValue.lastIndexOf('.')) {
      numericValue = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));
    } else {
      numericValue = parseFloat(rawValue.replace(/,/g, ''));
    }
    if (isNaN(numericValue)) continue;

    let type: 'income' | 'expense';
    let finalValue: number;

    if (isNubank) {
      // Fatura de cartão: positivo = despesa, negativo = estorno/pagamento
      if (numericValue > 0) {
        type = 'expense';
        finalValue = numericValue;
      } else {
        type = 'income';
        finalValue = Math.abs(numericValue);
      }
    } else {
      // Extrato bancário: positivo = entrada, negativo = saída
      if (numericValue < 0) {
        type = 'expense';
        finalValue = Math.abs(numericValue);
      } else {
        type = 'income';
        finalValue = numericValue;
      }
    }

    // Parse data: aceita YYYY-MM-DD e DD/MM/YYYY
    let isoDate: string;
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
      isoDate = rawDate.replace(/\//g, '-');
    } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(rawDate)) {
      const parts = rawDate.split(/[/-]/);
      isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      continue;
    }

    const defaultCategory = type === 'income'
      ? (rawDesc.toLowerCase().includes('pagamento') ? 'salary' : 'salary')
      : 'outros';

    transactions.push({
      date: isoDate,
      description: rawDesc,
      value: finalValue,
      type,
      selected: true,
      category: defaultCategory,
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
  const [rules, setRules] = useState<AutomationRule[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      supabase.from('wallets').select('id, name').eq('user_id', user.id),
      supabase.from('automation_rules').select('condition_operator, condition_value, target_category').eq('user_id', user.id).eq('active', true),
    ]).then(([walletsRes, rulesRes]) => {
      setWallets(walletsRes.data || []);
      setRules(rulesRes.data || []);
    });
  }, [open, user]);

  const applyRules = (txns: ParsedTransaction[], activeRules: AutomationRule[]): ParsedTransaction[] => {
    if (activeRules.length === 0) return txns;
    return txns.map(t => {
      if (t.type === 'income') return t;
      const descLower = t.description.toLowerCase();
      for (const rule of activeRules) {
        const val = rule.condition_value.toLowerCase();
        const match =
          rule.condition_operator === 'contains' ? descLower.includes(val) :
          rule.condition_operator === 'starts_with' ? descLower.startsWith(val) :
          rule.condition_operator === 'equals' ? descLower === val : false;
        if (match) return { ...t, category: rule.target_category };
      }
      return t;
    });
  };

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
      setTransactions(applyRules(parsed, rules));
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

  const updateCategory = (index: number, category: string) => {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, category } : t));
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const rulesAppliedCount = transactions.filter(t => t.type === 'expense' && t.category !== 'outros').length;

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
      final_category: t.category,
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
                {rulesAppliedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-accent-foreground bg-accent/20 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3" />{rulesAppliedCount} categorizadas por regras
                  </span>
                )}
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
                    <TableHead>Categoria</TableHead>
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
                      <TableCell>
                        <Select value={t.category} onValueChange={(v) => updateCategory(i, v)}>
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {t.type === 'income' && <SelectItem value="salary">Salário</SelectItem>}
                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
