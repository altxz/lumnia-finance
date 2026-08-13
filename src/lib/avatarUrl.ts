import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

/**
 * O bucket de avatares é privado. Guardamos apenas o caminho do ficheiro
 * (ex.: "<user_id>/avatar.png") em user_settings.avatar_url e geramos
 * URLs assinadas de curta duração para exibição.
 */
export function extractAvatarPath(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.split('?')[0];
  const marker = `/${BUCKET}/`;
  const idx = clean.indexOf(marker);
  if (idx >= 0) return clean.slice(idx + marker.length);
  if (clean.startsWith('http')) return null;
  return clean;
}

export async function getAvatarSignedUrl(value?: string | null): Promise<string | null> {
  const path = extractAvatarPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
