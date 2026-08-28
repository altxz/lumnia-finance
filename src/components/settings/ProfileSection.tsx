import { useState, useRef, useEffect } from 'react';
import { getAvatarSignedUrl } from '@/lib/avatarUrl';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { STATIC_STALE_TIME } from '@/lib/queryClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileSettings {
  full_name: string;
  avatar_url: string;
  default_wallet_id: string | null;
}

interface ProfileSectionProps {
  settings: ProfileSettings;
  onChange: <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => void;
  onAvatarSaved: (avatarUrl: string) => void;
  user: SupabaseUser;
}

const supportedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionFromFile = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return extension === 'jpg' ? 'jpeg' : extension;
  return ({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type] ?? 'jpeg';
};

export function ProfileSection({ settings, onChange, onAvatarSaved, user }: ProfileSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Carteiras para escolher a carteira padrão (transações sem carteira definida)
  const { data: walletOptions = [] } = useQuery({
    queryKey: ['wallet-options', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets')
        .select('id, name, asset_type').eq('user_id', user!.id).order('name');
      return (data || []).filter(w => w.asset_type !== 'crypto') as { id: string; name: string }[];
    },
    enabled: !!user,
    staleTime: STATIC_STALE_TIME,
  });

  useEffect(() => {
    let active = true;
    getAvatarSignedUrl(settings.avatar_url).then(url => {
      if (active) setPreviewUrl(url);
    });
    return () => { active = false; };
  }, [settings.avatar_url]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!supportedAvatarTypes.has(file.type)) {
      toast({ title: 'Formato não suportado', description: 'Use uma imagem JPG, PNG ou WebP.', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Escolha uma imagem de até 5 MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = extensionFromFile(file);
    const path = `${user.id}/avatar.${ext}`;

    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      });
      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase.from('user_settings').upsert({
        user_id: user.id,
        avatar_url: path,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (profileError) throw profileError;

      const signedUrl = await getAvatarSignedUrl(path);
      onAvatarSaved(path);
      setPreviewUrl(signedUrl ? `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : null);
      toast({ title: 'Foto de perfil atualizada' });
    } catch (cause) {
      toast({ title: 'Não foi possível atualizar a foto', description: cause instanceof Error ? cause.message : 'Tente outra imagem.', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={previewUrl || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-foreground/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center">
                <Camera className="h-6 w-6 text-background" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{settings.full_name || 'Sem nome'}</p>
              <p className="break-all text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Conta criada em {formatDate(user?.created_at || new Date().toISOString())}</p>
            </div>
          </div>
          {uploading && <p className="mt-3 text-sm text-muted-foreground">Atualizando foto...</p>}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Carteira Padrão</Label>
              <Select value={settings.default_wallet_id || ''} onValueChange={v => onChange('default_wallet_id', v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecionar carteira" /></SelectTrigger>
                <SelectContent>
                  {walletOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Transações sem carteira definida entram nesta conta.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
