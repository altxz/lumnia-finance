import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Brain, Info } from 'lucide-react';

interface AiSectionProps {
  settings: any;
  onChange: (key: string, value: any) => void;
}

export function AiSection({ settings, onChange }: AiSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-ai" />Categorização Automática</CardTitle>
          <CardDescription>Configure como a IA processa suas despesas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">IA Automática</Label>
              <p className="text-xs text-muted-foreground">Categoriza despesas automaticamente ao adicionar</p>
            </div>
            <Switch checked={settings.ai_auto_categorize} onCheckedChange={v => onChange('ai_auto_categorize', v)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Confiança Mínima</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">A IA só aceitará sugestões com confiança acima deste valor. Abaixo, será pedida confirmação manual.</TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-bold text-primary">{settings.ai_min_confidence}%</span>
            </div>
            <Slider
              value={[settings.ai_min_confidence]}
              onValueChange={([v]) => onChange('ai_min_confidence', v)}
              min={0} max={100} step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Aceita tudo</span>
              <span>Muito rigoroso</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Aprender com Correções</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">Usa suas correções manuais para melhorar sugestões futuras.</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">Melhora a precisão baseada no seu histórico</p>
            </div>
            <Switch checked={settings.ai_learn_corrections} onCheckedChange={v => onChange('ai_learn_corrections', v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5 text-pink" />Modelo e Contexto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo de IA</Label>
            <Select value={settings.ai_model} onValueChange={v => onChange('ai_model', v)}>
              <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-flash">Gemini 2.5 Flash (Rápido)</SelectItem>
                <SelectItem value="gemini-pro">Gemini 2.5 Pro (Preciso)</SelectItem>
                <SelectItem value="gpt-4">GPT-4.1 (Avançado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Contexto Pessoal</Label>
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-[280px]">Informações sobre seu estilo de vida ajudam a IA a categorizar melhor. Ex: "Moro sozinho, trabalho remoto, tenho carro."</TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={settings.ai_personal_context || ''}
              onChange={e => onChange('ai_personal_context', e.target.value)}
              placeholder="Ex: Trabalho home office, tenho carro, moro sozinho, tenho 2 gatos..."
              className="rounded-xl min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{(settings.ai_personal_context || '').length}/1000</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
