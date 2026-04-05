import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Smartphone, BellRing, BellOff } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

interface NotificationsSectionProps {
  settings: any;
  onChange: (key: string, value: any) => void;
}

export function NotificationsSection({ settings, onChange }: NotificationsSectionProps) {
  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success('Notificações push desativadas');
    } else {
      const ok = await subscribe();
      if (ok) {
        toast.success('Notificações push ativadas! Você receberá lembretes de contas a vencer.');
      } else if (permission === 'denied') {
        toast.error('Permissão negada. Habilite nas configurações do navegador.');
      } else {
        toast.error('Não foi possível ativar as notificações push.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Push Notifications Card */}
      <Card className="rounded-2xl border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Notificações Push
            <Badge variant="outline" className="text-[10px] ml-1">PWA</Badge>
          </CardTitle>
          <CardDescription>Receba lembretes de contas a vencer diretamente no seu celular</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Não disponível</p>
                <p className="text-xs text-muted-foreground">
                  Seu navegador não suporta notificações push. Instale o app na tela inicial para ativar.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Lembretes de Contas a Vencer</Label>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed
                    ? 'Ativado — você receberá alertas de faturas e contas pendentes'
                    : 'Desativado — ative para receber alertas no celular'}
                </p>
                {permission === 'denied' && (
                  <p className="text-xs text-destructive">
                    Permissão bloqueada. Habilite nas configurações do navegador.
                  </p>
                )}
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={handleTogglePush}
                disabled={permission === 'denied'}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Notificações por Email</CardTitle>
          <CardDescription>Gerencie os emails que você recebe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notify_email_weekly', label: 'Resumo Semanal', desc: 'Receba um resumo das suas despesas toda semana' },
            { key: 'notify_email_alerts', label: 'Alertas de Gastos', desc: 'Aviso quando ultrapassar limites de gastos' },
            { key: 'notify_email_news', label: 'Novas Funcionalidades', desc: 'Fique por dentro das novidades da Lumnia' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={settings[item.key]} onCheckedChange={v => onChange(item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Smartphone className="h-5 w-5 text-ai" />Notificações no App</CardTitle>
          <CardDescription>Alertas e sugestões dentro da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notify_app_suggestions', label: 'Sugestões da IA', desc: 'Dicas de otimização baseadas no seu perfil' },
            { key: 'notify_app_reminders', label: 'Lembretes de Cadastro', desc: 'Lembretes para registrar despesas' },
            { key: 'notify_app_achievements', label: 'Conquistas', desc: 'Notificações de metas e conquistas' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={settings[item.key]} onCheckedChange={v => onChange(item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
