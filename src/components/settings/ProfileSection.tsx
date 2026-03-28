import { useState, useRef } from 'react';
import { ImportTransactionsModal } from '@/components/ImportTransactionsModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, User, Calendar, BarChart3, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/constants';

interface ProfileSectionProps {
  settings: any;
  onChange: (key: string, value: any) => void;
  user: any;
  stats: { totalExpenses: number; mostActiveMonth: string; favoriteCategory: string };
}

export function ProfileSection({ settings, onChange, user, stats }: ProfileSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'Imagem deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Erro ao enviar', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    onChange('avatar_url', publicUrl + '?t=' + Date.now());
    toast({ title: 'Avatar atualizado!' });
    setUploading(false);
  };

  const initials = (settings.full_name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Foto de Perfil</CardTitle>
          <CardDescription>Clique no avatar para alterar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={settings.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-background" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="font-semibold">{settings.full_name || 'Sem nome'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Conta criada em {formatDate(user?.created_at || new Date().toISOString())}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={settings.full_name || ''} onChange={e => onChange('full_name', e.target.value)} className="rounded-xl h-11" placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="rounded-xl h-11 bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select value={settings.timezone} onValueChange={v => onChange('timezone', v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                  <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                  <SelectItem value="America/Belem">Belém (GMT-3)</SelectItem>
                  <SelectItem value="America/Fortaleza">Fortaleza (GMT-3)</SelectItem>
                  <SelectItem value="America/Noronha">Noronha (GMT-2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moeda Preferida</Label>
              <Select value={settings.currency} onValueChange={v => onChange('currency', v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ Real Brasileiro</SelectItem>
                  <SelectItem value="USD">$ Dólar Americano</SelectItem>
                  <SelectItem value="EUR">€ Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={settings.bio || ''} onChange={e => onChange('bio', e.target.value)} placeholder="Fale um pouco sobre você..." className="rounded-xl min-h-[80px]" maxLength={500} />
            <p className="text-xs text-muted-foreground text-right">{(settings.bio || '').length}/500</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Total Despesas</p><p className="font-bold text-lg">{stats.totalExpenses}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="w-10 h-10 rounded-xl bg-ai/10 flex items-center justify-center"><Calendar className="h-5 w-5 text-ai" /></div>
              <div><p className="text-xs text-muted-foreground">Mês Mais Ativo</p><p className="font-bold">{stats.mostActiveMonth || '—'}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center"><User className="h-5 w-5 text-accent-foreground" /></div>
              <div><p className="text-xs text-muted-foreground">Categoria Favorita</p><p className="font-bold">{stats.favoriteCategory || '—'}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportDataSection />
    </div>
  );
}

function ImportDataSection() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Importação de Dados</CardTitle>
        <CardDescription>Importe transações a partir de ficheiros CSV exportados do seu banco ou app financeiro.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2 rounded-xl h-11 font-semibold">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </CardContent>
      <ImportTransactionsModal open={importOpen} onOpenChange={setImportOpen} onImported={() => {}} />
    </Card>
  );
}
