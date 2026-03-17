import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Zap } from 'lucide-react';
import { CATEGORIES, getCategoryInfo } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Rule {
  id: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  target_category: string;
  active: boolean;
  applied_count: number;
}

interface AutomationSectionProps {
  rules: Rule[];
  onRulesChange: () => void;
  userId: string;
}

export function AutomationSection({ rules, onRulesChange, userId }: AutomationSectionProps) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ condition_value: '', target_category: 'alimentacao', condition_operator: 'contains' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.condition_value.trim()) {
      toast({ title: 'Erro', description: 'Preencha o valor da condição.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('automation_rules').insert({
      user_id: userId,
      condition_field: 'description',
      condition_operator: form.condition_operator,
      condition_value: form.condition_value.trim(),
      target_category: form.target_category,
    });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Regra criada!' }); setModalOpen(false); setForm({ condition_value: '', target_category: 'alimentacao', condition_operator: 'contains' }); onRulesChange(); }
    setSaving(false);
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from('automation_rules').update({ active }).eq('id', id);
    onRulesChange();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('automation_rules').delete().eq('id', id);
    toast({ title: 'Regra excluída' });
    onRulesChange();
  };

  const operatorLabel = (op: string) => op === 'contains' ? 'contém' : op === 'starts_with' ? 'começa com' : 'é igual a';

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-accent-foreground" />Regras de Automação</CardTitle>
              <CardDescription>Crie regras para categorizar despesas automaticamente</CardDescription>
            </div>
            <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              <PlusCircle className="h-4 w-4" />
              Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhuma regra criada. Crie uma para automatizar categorizações.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const catInfo = getCategoryInfo(rule.target_category);
                return (
                  <div key={rule.id} className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/20">
                    <Switch checked={rule.active} onCheckedChange={v => toggleRule(rule.id, v)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Se descrição <span className="text-ai font-semibold">{operatorLabel(rule.condition_operator)}</span> "{rule.condition_value}"
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">→</span>
                        <Badge variant={catInfo.variant} className="text-xs">{catInfo.label}</Badge>
                        <span className="text-xs text-muted-foreground">• {rule.applied_count}x aplicada</span>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRule(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Nova Regra de Automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quando a descrição</Label>
              <Select value={form.condition_operator} onValueChange={v => setForm(f => ({ ...f, condition_operator: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                  <SelectItem value="equals">É igual a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={form.condition_value} onChange={e => setForm(f => ({ ...f, condition_value: e.target.value }))} placeholder="Ex: uber, ifood, mercado" className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Categorizar como</Label>
              <Select value={form.target_category} onValueChange={v => setForm(f => ({ ...f, target_category: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {saving ? 'Salvando...' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
