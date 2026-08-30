import { useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { ResponsiveModal, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { readLumniaBackup, importLumniaBackup, type BackupPreview, type ImportProgress, type ImportResult } from '@/lib/importLumniaBackup';
import { clearPersistedCache, queryClient } from '@/lib/queryClient';

interface Props { userId: string; open: boolean; onOpenChange: (open: boolean) => void; }
interface BackupImportFilePickerPlugin {
  pickBackupFile(): Promise<{ name: string; mimeType?: string; data: string; size: number }>;
}
const BackupImportFilePicker = registerPlugin<BackupImportFilePickerPlugin>('BackupImportFilePicker');

export function ImportLumniaBackupDialog({ userId, open, onOpenChange }: Props) {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const reset = () => { setPreview(null); setFileName(''); setResult(null); setError(''); setProgress(null); };
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next); };
  const readSelectedFile = async (file: File) => {
    setLoading(true); setError(''); setResult(null); setProgress({ value: 12, label: 'Lendo e conferindo o arquivo...' });
    try {
      const nextPreview = await readLumniaBackup(file);
      setPreview(nextPreview); setFileName(file.name); setProgress(null);
    }
    catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : 'Não foi possível ler este arquivo.'); }
    finally { setLoading(false); }
  };
  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await readSelectedFile(file);
  };
  const chooseNativeFile = async () => {
    try {
      const selected = await BackupImportFilePicker.pickBackupFile();
      if (!selected?.data) throw new Error('O Android não conseguiu disponibilizar o conteúdo do arquivo selecionado. Tente novamente.');
      const binary = atob(selected.data.replace(/^data:[^;]+;base64,/, ''));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      await readSelectedFile(new File([bytes], selected.name, { type: selected.mimeType || 'application/octet-stream' }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (!/cancel|dismiss/i.test(message)) setError(message || 'Não foi possível selecionar este arquivo.');
    }
  };
  const runImport = async () => {
    if (!preview) return;
    setLoading(true); setError(''); setProgress({ value: 2, label: 'Preparando a importação...' });
    try {
      const next = await importLumniaBackup(userId, preview, { onProgress: setProgress });
      clearPersistedCache(); queryClient.clear(); await queryClient.invalidateQueries();
      setResult(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'A importação não foi concluída. Nenhuma pendência foi ocultada.'); }
    finally { setLoading(false); }
  };
  const totals = result ? Object.values(result.imported).reduce((sum, value) => sum + value, 0) : 0;

  return <ResponsiveModal open={open} onOpenChange={close} className="max-w-lg max-h-[90dvh] rounded-3xl" dismissible={false}>
      <ResponsiveModalHeader className="p-5 pb-3">
        <ResponsiveModalTitle>Importar dados do Lumnia</ResponsiveModalTitle>
        <ResponsiveModalDescription>Reconhece o backup JSON e a planilha Excel exportados pelo Lumnia.</ResponsiveModalDescription>
      </ResponsiveModalHeader>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2">
      {!preview && !result && <div className="space-y-3 rounded-2xl border border-dashed p-5 text-center">
        <FileSpreadsheet className="mx-auto h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Selecione <strong>meus-dados-lumnia.json</strong> ou a planilha <strong>lumnia-export.xlsx</strong>.</p>
        {Capacitor.isNativePlatform() ? <Button type="button" className="rounded-xl" onClick={chooseNativeFile} disabled={loading}><Upload className="mr-2 h-4 w-4" />Selecionar arquivo</Button> : <label className={`relative inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:bg-primary/90'}`}>
          <Upload className="mr-2 h-4 w-4" />Selecionar arquivo
          <input type="file" accept=".json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={chooseFile} disabled={loading} />
        </label>}
      </div>}
      {loading && progress && <div className="space-y-2 rounded-2xl border bg-muted/30 p-4" aria-live="polite">
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><p className="text-sm font-medium">{progress.label}</p></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress.value}%` }} /></div>
        <p className="text-right text-xs text-muted-foreground">{progress.value}%</p>
      </div>}
      {preview && !result && <div className="space-y-4">
        <div className="rounded-2xl border bg-muted/30 p-4"><p className="font-medium">{preview.label}</p><p className="mt-1 break-all text-xs text-muted-foreground">{fileName}</p></div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-3"><strong>{preview.transactions}</strong><span className="block text-muted-foreground">transações</span></div>
          <div className="rounded-xl bg-muted/50 p-3"><strong>{preview.categories}</strong><span className="block text-muted-foreground">categorias</span></div>
          <div className="rounded-xl bg-muted/50 p-3"><strong>{preview.wallets + preview.creditCards}</strong><span className="block text-muted-foreground">contas e cartões</span></div>
          <div className="rounded-xl bg-muted/50 p-3"><strong>{preview.budgets}</strong><span className="block text-muted-foreground">orçamentos</span></div>
          <div className="rounded-xl bg-muted/50 p-3"><strong>{preview.projects}</strong><span className="block text-muted-foreground">projetos</span></div>
        </div>
        {preview.limitations.map(item => <div key={item} className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />{item}</div>)}
        <p className="text-xs text-muted-foreground">A importação usa o usuário atual, preserva IDs de transação e não cria duplicatas ao importar o mesmo arquivo novamente.</p>
        <Button type="button" variant="ghost" className="rounded-xl" onClick={reset} disabled={loading}>Escolher outro arquivo</Button>
      </div>}
      {result && <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><div className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><div><p className="font-semibold">Importação concluída</p><p className="text-sm text-muted-foreground">{totals} registros gravados no novo banco.</p></div></div>{Object.entries(result.imported).map(([table, count]) => <p key={table} className="text-sm">{table.replace('_', ' ')}: <strong>{count}</strong></p>)}{result.warnings.map(warning => <p key={warning} className="text-xs text-muted-foreground">{warning}</p>)}</div>}
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </div>
      <ResponsiveModalFooter className="p-5 pt-3">{result ? <Button className="rounded-xl" onClick={() => close(false)}>Concluir</Button> : preview ? <Button className="rounded-xl" onClick={runImport} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : 'Importar agora'}</Button> : null}</ResponsiveModalFooter>
  </ResponsiveModal>;
}
