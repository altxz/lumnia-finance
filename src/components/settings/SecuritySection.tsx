import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, Key, Download, Trash2, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { exportFinancialWorkbook } from '@/lib/exportToExcel';


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
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Erro', description: 'A nova senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
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
    const { data: expenses } = await supabase.from('expenses').select('*').eq('user_id', user.id);
    const blob = new Blob([JSON.stringify({ expenses, exported_at: new Date().toISOString(), user_email: user.email }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'meus-dados-lumnia.json'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Dados exportados!', description: 'Arquivo JSON baixado com sucesso.' });
    setExporting(false);
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
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl h-11" placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">As senhas não conferem</p>
          )}
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword} className="rounded-xl">
            {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Alterando...</> : 'Alterar Senha'}
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
              <div className="space-y-1">
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
              <div className="space-y-1">
                <p className="text-sm font-semibold">Backup JSON (LGPD)</p>
                <p className="text-xs text-muted-foreground">Arquivo bruto com suas transações, para portabilidade de dados.</p>
              </div>
            </div>
            <Button onClick={handleExportData} disabled={exporting} variant="outline" className="gap-2 rounded-xl w-full sm:w-auto">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Exportando...' : 'Baixar Meus Dados'}
            </Button>
          </div>
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
              <Button variant="destructive" className="gap-2 rounded-xl"><Trash2 className="h-4 w-4" />Excluir Minha Conta</Button>
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
