import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Landmark, ShieldCheck, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { BankNotificationCapture } from '@/lib/bankNotificationCapture';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function NotificationsSection() {
  const [bankCaptureEnabled, setBankCaptureEnabled] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const isAndroidApp = Capacitor.getPlatform() === 'android';

  const refreshBankCapture = useCallback(async () => {
    if (!isAndroidApp) return;
    try {
      setBankCaptureEnabled((await BankNotificationCapture.isEnabled()).enabled);
    } catch {
      setBankCaptureEnabled(false);
    }
  }, [isAndroidApp]);

  useEffect(() => {
    void refreshBankCapture();
    window.addEventListener('focus', refreshBankCapture);
    return () => window.removeEventListener('focus', refreshBankCapture);
  }, [refreshBankCapture]);

  const enableBankCapture = async () => {
    setDisclosureOpen(false);
    try {
      await BankNotificationCapture.requestNotificationPermission();
      await BankNotificationCapture.openSettings();
    } catch {
      toast.error('Não foi possível abrir as configurações de acesso às notificações.');
    }
  };

  return (
    <div className="space-y-6">
      {isAndroidApp && (
        <Card className="rounded-2xl border-ai/25">
          <CardHeader>
            <CardTitle className="text-lg flex flex-wrap items-center gap-2">
              <Landmark className="h-5 w-5 text-ai" />
              Detecção de Transações Bancárias
              <Badge variant="outline" className="text-[10px] ml-1">Android</Badge>
            </CardTitle>
            <CardDescription>Identifica valores em notificações de bancos e pede sua confirmação antes de registrar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <p className="text-xs text-muted-foreground">
                O processamento ocorre no aparelho. O Lumnia ignora notificações sem valor e não cria transações automaticamente.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm font-medium">Acesso às notificações bancárias</Label>
                <p className="text-xs text-muted-foreground">{bankCaptureEnabled ? 'Ativado no Android' : 'Desativado no Android'}</p>
              </div>
              <Button className="shrink-0" variant={bankCaptureEnabled ? 'outline' : 'default'} onClick={() => bankCaptureEnabled ? BankNotificationCapture.openSettings() : setDisclosureOpen(true)}>
                {bankCaptureEnabled ? 'Gerenciar' : 'Ativar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAndroidApp && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Sem notificações disponíveis nesta versão</p>
            <p className="max-w-sm text-xs text-muted-foreground">A detecção de transações bancárias funciona apenas no aplicativo Android.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={disclosureOpen} onOpenChange={setDisclosureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permitir leitura de notificações bancárias?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">O Android permitirá que o Lumnia veja o texto das notificações. O aplicativo filtrará bancos compatíveis e procurará valor, tipo e descrição da transação.</span>
              <span className="block">Os dados são processados localmente e só entram na sua conta depois que você tocar em “Registrar” e confirmar o formulário.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={enableBankCapture}>Continuar para o Android</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
