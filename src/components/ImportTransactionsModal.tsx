import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Zap, CreditCard, Wallet, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

interface ParsedTransaction {
  date: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
  selected: boolean;
  category: string;
  originType: 'wallet' | 'credit_card';
  destId: string;
  invoiceMonth?: string;
}

interface AutomationRule {
  condition_operator: string;
  condition_value: string;
  target_category: string;
}

interface WalletOption { id: string; name: string }

interface CreditCardOption {
  id: string;
  name: string;
  closing_day: number;
  closing_strategy: string;
  closing_days_before_due: number;
  due_day: number;
}

interface ImportTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

function parseOFX(text: string): Omit<ParsedTransaction, 'originType' | 'destId'>[] {
  const transactions: Omit<ParsedTransaction, 'originType' | 'destId'>[] = [];
  const txnBlocks = text.split(/<STMTTRN>/i).slice(1);

  for (const block of txnBlocks) {
    const amountMatch = block.match(/<TRNAMT>\s*([^\s<]+)/i);
    const dateMatch = block.match(/<DTPOSTED>\s*(\d{8})/i);
    const memoMatch = block.match(/<MEMO>\s*([^\r\n<]+)/i) || block.match(/<NAME>\s*([^\r\n<]+)/i);

    if (!amountMatch || !dateMatch) continue;

    const rawAmount = parseFloat(amountMatch[1].replace(',', '.'));
    if (isNaN(rawAmount)) continue;

    const rawDate = dateMatch[1];
    const isoDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const description = memoMatch ? memoMatch[1].trim() : 'Sem descrição';

    const type: 'income' | 'expense' = rawAmount < 0 ? 'expense' : 'income';
    const finalValue = Math.abs(rawAmount);
    const defaultCategory = type === 'income' ? 'salary' : 'outros';

    transactions.push({ date: isoDate, description, value: finalValue, type, selected: true, category: defaultCategory });
  }

  return transactions;
}

function parseCSV(text: string): Omit<ParsedTransaction, 'originType' | 'destId'>[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const isNubank = headerLine.includes('date') && headerLine.includes('title') && headerLine.includes('amount');
  const delimiter = headerLine.includes(';') ? ';' : ',';

  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  let dateIdx = headers.findIndex(h => h.includes('date') || h.includes('data'));
  let descIdx = headers.findIndex(h => h.includes('title') || h.includes('desc') || h.includes('histórico') || h.includes('historico') || h.includes('lançamento') || h.includes('lancamento') || h.includes('detalhe') || h.includes('memo') || h.includes('name'));
  let valIdx = headers.findIndex(h => h.includes('amount') || h.includes('valor') || h.includes('value'));
  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (valIdx === -1) valIdx = 2;

  const transactions: Omit<ParsedTransaction, 'originType' | 'destId'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = delimiter === ';'
      ? lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''))
      : lines[i].match(/(?:"[^"]*"|[^,]+)+/g)?.map(c => c.trim().replace(/^"|"$/g, ''));

    if (!row || row.length < 3) continue;

    const rawDate = row[dateIdx]?.trim() || '';
    const rawDesc = row[descIdx]?.trim() || '';
    const rawValue = row[valIdx]?.trim() || '';

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
      if (numericValue > 0) { type = 'expense'; finalValue = numericValue; }
      else { type = 'income'; finalValue = Math.abs(numericValue); }
    } else {
      if (numericValue < 0) { type = 'expense'; finalValue = Math.abs(numericValue); }
      else { type = 'income'; finalValue = numericValue; }
    }

    let isoDate: string;
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawDate)) {
      isoDate = rawDate.replace(/\//g, '-');
    } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(rawDate)) {
      const parts = rawDate.split(/[/-]/);
      isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      continue;
    }

    const defaultCategory = type === 'income' ? 'salary' : 'outros';

    transactions.push({ date: isoDate, description: rawDesc, value: finalValue, type, selected: true, category: defaultCategory });
  }

  return transactions;
}

function calcInvoiceMonth(purchaseDate: string, card: CreditCardOption): string {
  const [year, month, day] = purchaseDate.split('-').map(Number);
  let closingDay = card.closing_day;
  if (card.closing_strategy === 'relative') {
    closingDay = card.due_day - card.closing_days_before_due;
    if (closingDay <= 0) closingDay += 30;
  }
  if (day > closingDay) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function ImportTransactionsModal({ open, onOpenChange, onImported }: ImportTransactionsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([]);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; parent_id: string | null; icon: string; color: string }[]>([]);

  const [bulkOrigin, setBulkOrigin] = useState<'wallet' | 'credit_card'>('wallet');
  const [bulkDestId, setBulkDestId] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      supabase.from('wallets').select('id, name').eq('user_id', user.id),
      supabase.from('credit_cards').select('id, name, closing_day, closing_strategy, closing_days_before_due, due_day').eq('user_id', user.id),
      supabase.from('automation_rules').select('condition_operator, condition_value, target_category').eq('user_id', user.id).eq('active', true),
      supabase.from('categories').select('id, name, parent_id, icon, color').eq('user_id', user.id).eq('active', true).order('sort_order'),
    ]).then(([walletsRes, cardsRes, rulesRes, catsRes]) => {
      setWallets(walletsRes.data || []);
      setCreditCards(cardsRes.data || []);
      setRules(rulesRes.data || []);
      setDbCategories(catsRes.data || []);
    });
  }, [open, user]);

  const applyRules = (txns: Omit<ParsedTransaction, 'originType' | 'destId'>[], activeRules: AutomationRule[]) => {
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
    setStep('upload');
    setBulkOrigin('wallet');
    setBulkDestId('');
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const processFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isOFX = lowerName.endsWith('.ofx');
    const isCSV = lowerName.endsWith('.csv');

    if (!isCSV && !isOFX) {
      toast({ title: 'Formato inválido', description: 'Por favor, selecione um arquivo .csv ou .ofx', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let parsed = isOFX ? parseOFX(text) : parseCSV(text);
      if (parsed.length === 0) {
        toast({ title: 'Arquivo inválido', description: 'Não foi possível extrair transações. Verifique o formato do arquivo.', variant: 'destructive' });
        return;
      }
      parsed = applyRules(parsed, rules);

      const full: ParsedTransaction[] = parsed.map(t => ({
        ...t,
        originType: 'wallet' as const,
        destId: '',
      }));

      setTransactions(full);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [rules]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const toggleAll = (checked: boolean) => setTransactions(prev => prev.map(t => ({ ...t, selected: checked })));
  const toggleOne = (index: number) => setTransactions(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  const updateCategory = (index: number, category: string) => setTransactions(prev => prev.map((t, i) => i === index ? { ...t, category } : t));

  const updateOriginType = (index: number, origin: 'wallet' | 'credit_card') => {
    setTransactions(prev => prev.map((t, i) => {
      if (i !== index) return t;
      return { ...t, originType: origin, destId: '', invoiceMonth: undefined };
    }));
  };

  const updateDestId = (index: number, id: string) => {
    setTransactions(prev => prev.map((t, i) => {
      if (i !== index) return t;
      let invoiceMonth: string | undefined;
      if (t.originType === 'credit_card') {
        const card = creditCards.find(c => c.id === id);
        if (card) invoiceMonth = calcInvoiceMonth(t.date, card);
      }
      return { ...t, destId: id, invoiceMonth };
    }));
  };

  const applyToAll = () => {
    if (!bulkDestId) return;
    setTransactions(prev => prev.map(t => {
      let invoiceMonth: string | undefined;
      if (bulkOrigin === 'credit_card') {
        const card = creditCards.find(c => c.id === bulkDestId);
        if (card) invoiceMonth = calcInvoiceMonth(t.date, card);
      }
      return { ...t, originType: bulkOrigin, destId: bulkDestId, invoiceMonth };
    }));
    toast({ title: 'Aplicado a todas as linhas' });
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const rulesAppliedCount = transactions.filter(t => t.type === 'expense' && t.category !== 'outros').length;
  const allHaveDest = transactions.filter(t => t.selected).every(t => t.destId);

  const handleImport = async () => {
    if (!user) return;
    const selected = transactions.filter(t => t.selected);
    if (selected.length === 0) return;

    if (!selected.every(t => t.destId)) {
      toast({ title: 'Destino obrigatório', description: 'Selecione uma conta ou cartão para todas as transações.', variant: 'destructive' });
      return;
    }

    setImporting(true);

    const rows = selected.map(t => ({
      user_id: user.id,
      date: t.date,
      description: t.description,
      value: t.value,
      type: t.type,
      final_category: t.category,
      ...(t.originType === 'credit_card'
        ? { credit_card_id: t.destId, invoice_month: t.invoiceMonth || null }
        : { wallet_id: t.destId }
      ),
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

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const bulkDestOptions = bulkOrigin === 'wallet' ? wallets : creditCards;

  // ── Shared upload step ──
  const uploadContent = (
    <div className="space-y-4 p-1">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors min-h-[180px] flex flex-col items-center justify-center ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-foreground font-medium mb-1">Arraste o arquivo CSV ou OFX aqui</p>
        <p className="text-sm text-muted-foreground">ou toque para selecionar</p>
        <p className="text-xs text-muted-foreground mt-3">CSV (colunas detectadas automaticamente) ou OFX (padrão bancário)</p>
        <p className="text-xs text-muted-foreground mt-1">A conta/cartão de destino será escolhida na próxima etapa</p>
        <input ref={fileInputRef} type="file" accept=".csv,.ofx" onChange={handleFileChange} className="hidden" />
      </div>
    </div>
  );

  // ── Shared "Apply to all" bar ──
  const applyAllBar = (
    <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10 bg-background py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <span className="font-medium text-foreground truncate max-w-[120px] sm:max-w-none">{fileName}</span>
        <span>— {transactions.length} transações</span>
        {rulesAppliedCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-accent-foreground bg-accent/20 px-2 py-0.5 rounded-full">
            <Zap className="h-3 w-3" />{rulesAppliedCount} categorizadas
          </span>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl">
            <Copy className="h-3.5 w-3.5" />
            Aplicar a todos
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-3" align="end">
          <p className="text-xs font-semibold text-muted-foreground">Definir destino para todas as linhas</p>
          <Select value={bulkOrigin} onValueChange={(v) => { setBulkOrigin(v as any); setBulkDestId(''); }}>
            <SelectTrigger className="rounded-xl text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wallet">Débito em conta</SelectItem>
              <SelectItem value="credit_card">Cartão de crédito</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bulkDestId} onValueChange={setBulkDestId}>
            <SelectTrigger className="rounded-xl text-xs h-8">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {bulkDestOptions.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="w-full rounded-xl" disabled={!bulkDestId} onClick={applyToAll}>
            Aplicar
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );

  // ── Mobile card list ──
  const mobileCardList = (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 px-1 pb-4">
      <div className="flex items-center gap-2 py-1">
        <Checkbox checked={selectedCount === transactions.length} onCheckedChange={(c) => toggleAll(!!c)} />
        <span className="text-xs text-muted-foreground">Selecionar todas</span>
      </div>
      {transactions.map((t, i) => {
        const destOptions = t.originType === 'wallet' ? wallets : creditCards;
        const cardForRow = t.originType === 'credit_card' ? creditCards.find(c => c.id === t.destId) : null;

        return (
          <div
            key={i}
            className={`rounded-xl border bg-card p-3 space-y-2.5 ${!t.selected ? 'opacity-50' : ''}`}
          >
            {/* Top row: checkbox, date, type badge, value */}
            <div className="flex items-center gap-2">
              <Checkbox checked={t.selected} onCheckedChange={() => toggleOne(i)} />
              <span className="text-xs text-muted-foreground">{t.date}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                t.type === 'income'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {t.type === 'income' ? 'Receita' : 'Despesa'}
              </span>
              <span className={`ml-auto font-mono text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'income' ? '+' : '-'}{fmtCurrency(t.value)}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm font-medium truncate">{t.description}</p>

            {/* Category */}
            <CategoryPicker
              categories={dbCategories}
              value={t.category}
              onValueChange={(v) => updateCategory(i, v)}
              placeholder="Categoria"
            />

            {/* Origin + Destination */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={t.originType} onValueChange={(v) => updateOriginType(i, v as any)}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">
                    <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Débito</span>
                  </SelectItem>
                  <SelectItem value="credit_card">
                    <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Crédito</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div>
                <Select value={t.destId} onValueChange={(v) => updateDestId(i, v)}>
                  <SelectTrigger className={`rounded-xl text-xs h-9 ${!t.destId ? 'border-destructive/50' : ''}`}>
                    <SelectValue placeholder="Destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {destOptions.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cardForRow && t.invoiceMonth && (
                  <span className="text-[9px] text-muted-foreground block mt-0.5">Fatura: {t.invoiceMonth}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Desktop table ──
  const desktopTable = (
    <div className="border rounded-lg overflow-auto flex-1 min-h-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={selectedCount === transactions.length} onCheckedChange={(c) => toggleAll(!!c)} />
            </TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t, i) => {
            const destOptions = t.originType === 'wallet' ? wallets : creditCards;
            const cardForRow = t.originType === 'credit_card' ? creditCards.find(c => c.id === t.destId) : null;

            return (
              <TableRow key={i} className={!t.selected ? 'opacity-50' : ''}>
                <TableCell>
                  <Checkbox checked={t.selected} onCheckedChange={() => toggleOne(i)} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{t.date}</TableCell>
                <TableCell className="max-w-[160px] text-xs">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate cursor-default">{t.description}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px] whitespace-normal">
                      {t.description}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    t.type === 'income'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {t.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <CategoryPicker
                    categories={dbCategories}
                    value={t.category}
                    onValueChange={(v) => updateCategory(i, v)}
                    placeholder="Categoria"
                  />
                </TableCell>
                <TableCell>
                  <Select value={t.originType} onValueChange={(v) => updateOriginType(i, v as any)}>
                    <SelectTrigger className="rounded-lg text-[10px] h-7 w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wallet" className="text-xs">
                        <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Débito</span>
                      </SelectItem>
                      <SelectItem value="credit_card" className="text-xs">
                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Crédito</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={t.destId} onValueChange={(v) => updateDestId(i, v)}>
                    <SelectTrigger className={`rounded-lg text-[10px] h-7 w-[120px] ${!t.destId ? 'border-destructive/50' : ''}`}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {destOptions.map(o => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cardForRow && t.invoiceMonth && (
                    <span className="text-[9px] text-muted-foreground block mt-0.5">Fatura: {t.invoiceMonth}</span>
                  )}
                </TableCell>
                <TableCell className={`text-right font-mono text-xs ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmtCurrency(t.value)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // ── Footer buttons ──
  const footerButtons = (
    <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
      {step === 'preview' && (
        <Button variant="outline" onClick={reset} className="flex-1 sm:flex-none">Voltar</Button>
      )}
      {step === 'preview' && (
        <Button onClick={handleImport} disabled={importing || selectedCount === 0 || !allHaveDest} className="gap-2 flex-1 sm:flex-none">
          {importing && <Loader2 className="h-4 w-4 animate-spin" />}
          Importar ({selectedCount})
        </Button>
      )}
    </div>
  );

  // ── Shared inner content ──
  const innerContent = (
    <>
      {step === 'upload' && uploadContent}
      {step === 'preview' && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {applyAllBar}
          {isMobile ? mobileCardList : desktopTable}
        </div>
      )}
    </>
  );

  // ── MOBILE: Drawer ──
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Transações
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 min-h-0">
            {innerContent}
          </div>
          <DrawerFooter>
            {footerButtons}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // ── DESKTOP: Dialog ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Transações
          </DialogTitle>
        </DialogHeader>
        {innerContent}
        <DialogFooter className="gap-2 sm:gap-0">
          {footerButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
