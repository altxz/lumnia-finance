import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, Key, Download, Trash2, Loader2, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { exportFinancialWorkbook } from '@/lib/exportToExcel';
import { exportAllUserData } from '@/lib/exportAllUserData';
import { BUILD_ID, clearPersistedCache } from '@/lib/queryClient';
import { forceAppUpdate } from '@/lib/registerServiceWorker';
import { ImportLumniaBackupDialog } from '@/components/settings/ImportLumniaBackupDialog';



interface SecuritySectionProps {
  user: any;
  onDeleteAccount: () => void;
}

export function SecuritySection({ user, onDeleteAccount }: SecuritySectionProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleExportExcel = async () => {
    if (!user) return;
    setExportingExcel(true);
    try {
      const result = await exportFinancialWorkbook(user.id);
      toast({
        title: 'Planilha gerada!',
        description: `${result.transactions} transações em ${result.sheets} abas (incluindo ${result.cardTransactions} do cartão).`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
    setExportingExcel(false);
  };


  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({ title: 'Erro', description: 'Informe a senha atual.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Erro', description: 'A nova senha deve ter pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: currentPassword,
    });
    if (reauthError) {
      toast({ title: 'Erro', description: 'Senha atual incorreta.', variant: 'destructive' });
      setChangingPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Senha alterada com sucesso!' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const result = await exportAllUserData(user);
      toast({
        title: 'Backup completo exportado!',
        description: `${result.records} registros em ${result.tables} conjuntos de dados${result.avatars ? ` e ${result.avatars} avatar(es)` : ''}.`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Key className="h-5 w-5 text-primary" />Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="rounded-xl h-11" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl h-11" placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">As senhas não conferem</p>
          )}
          <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full rounded-xl sm:w-auto">
            {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Alterando...</> : 'Alterar Senha'}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Importar Dados</CardTitle>
          <CardDescription>Restaure um backup JSON ou uma planilha Excel exportados pelo Lumnia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">A planilha restaura transações e os cadastros incluídos nela. O JSON antigo restaura as transações que ele contém. O app valida o arquivo antes de gravar qualquer dado.</p>
          <Button onClick={() => setImportOpen(true)} variant="outline" className="gap-2 rounded-xl w-full sm:w-auto">
            <Upload className="h-4 w-4" />Importar backup
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Download className="h-5 w-5 text-ai" />Exportar Dados</CardTitle>
          <CardDescription>Baixe suas informações financeiras completas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">Planilha Excel (.xlsx)</p>
                <p className="text-xs text-muted-foreground">
                  Extração completa com abas de Transações (dia a dia, categoria, débito, crédito, status),
                  Cartões de Crédito (data da compra e da fatura), Faturas, Resumo Mensal, Por Categoria,
                  Carteiras, Cadastro de Cartões, Categorias, Orçamentos, Dívidas e Projetos.
                </p>
              </div>
            </div>
            <Button onClick={handleExportExcel} disabled={exportingExcel} className="gap-2 rounded-xl w-full sm:w-auto">
              {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {exportingExcel ? 'Gerando planilha...' : 'Exportar para Excel'}
            </Button>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">Backup completo JSON</p>
                <p className="text-xs text-muted-foreground">Cópia importável de transações, contas, cartões, categorias, orçamentos, projetos, dívidas, automações, notificações, investimentos e avatar.</p>
              </div>
            </div>
            <Button onClick={handleExportData} disabled={exporting} variant="outline" className="gap-2 rounded-xl w-full sm:w-auto">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Exportando...' : 'Baixar backup completo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {user?.id && <ImportLumniaBackupDialog userId={user.id} open={importOpen} onOpenChange={setImportOpen} />}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Versão do app</CardTitle>
          <CardDescription>Se o app parecer preso numa versão antiga, force a atualização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Versão instalada: <span className="font-mono">{BUILD_ID}</span>
          </p>
          <Button
            onClick={() => { clearPersistedCache(); void forceAppUpdate(); }}
            variant="outline"
            className="gap-2 rounded-xl w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />Forçar atualização
          </Button>
          <p className="text-xs text-muted-foreground">
            Limpa o cache local do aplicativo e recarrega com a versão mais recente. Seus dados no servidor não são afetados.
          </p>
        </CardContent>
      </Card>


      <Card className="rounded-2xl border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Zona de Perigo</CardTitle>
          <CardDescription>Ações irreversíveis na sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2 rounded-xl sm:w-auto"><Trash2 className="h-4 w-4" />Excluir Minha Conta</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>Esta ação é <strong>permanente e irreversível</strong>. Todos os seus dados serão apagados.</p>
                  <p className="text-sm">Digite <strong>EXCLUIR CONTA</strong> para confirmar:</p>
                  <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="rounded-xl mt-2" placeholder="EXCLUIR CONTA" />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl" onClick={() => setDeleteConfirmText('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteConfirmText !== 'EXCLUIR CONTA'}
                  onClick={onDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                >
                  Excluir Permanentemente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
