import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, Smartphone } from 'lucide-react';

interface NotificationsSectionProps {
  settings: any;
  onChange: (key: string, value: any) => void;
}

export function NotificationsSection({ settings, onChange }: NotificationsSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Notificações por Email</CardTitle>
          <CardDescription>Gerencie os emails que você recebe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notify_email_weekly', label: 'Resumo Semanal', desc: 'Receba um resumo das suas despesas toda semana' },
            { key: 'notify_email_alerts', label: 'Alertas de Gastos', desc: 'Aviso quando ultrapassar limites de gastos' },
            { key: 'notify_email_news', label: 'Novas Funcionalidades', desc: '{ key: 'notify_email_news', label: 'Novas Funcionalidades', desc: 'Fique por dentro das novidades da Lumnia' },' },
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
