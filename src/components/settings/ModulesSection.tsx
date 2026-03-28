import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { PiggyBank, FolderKanban, Bitcoin, Loader2 } from 'lucide-react';

const MODULES = [
  {
    key: 'enable_budget_module' as const,
    title: 'Módulo de Orçamento',
    description: 'Ativar planeamento baseado em zero e metas de gastos mensais.',
    icon: PiggyBank,
    color: 'text-emerald-500',
  },
  {
    key: 'enable_projects_module' as const,
    title: 'Módulo de Projetos',
    description: 'Permite agrupar despesas em centros de custo temporários (viagens, eventos).',
    icon: FolderKanban,
    color: 'text-primary',
  },
  {
    key: 'enable_crypto_module' as const,
    title: 'Módulo de Criptomoedas',
    description: 'Ativa a visualização e cotação de ativos digitais na sua carteira.',
    icon: Bitcoin,
    color: 'text-amber-500',
  },
];

export function ModulesSection() {
  const { settings, loading, updateSetting } = useUserSettings();

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Módulos e Recursos</CardTitle>
        <p className="text-sm text-muted-foreground">Ative ou desative funcionalidades para personalizar a sua experiência.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {MODULES.map(mod => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.key}
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-secondary/30"
            >
              <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${mod.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-semibold cursor-pointer">{mod.title}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
              </div>
              <Switch
                checked={settings[mod.key]}
                onCheckedChange={(v) => updateSetting(mod.key, v)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
