import { supabase } from '@/lib/supabase';

const USER_TABLES = [
  'expenses',
  'categories',
  'ai_corrections',
  'user_settings',
  'automation_rules',
  'credit_cards',
  'wallets',
  'budgets',
  'projects',
  'notifications',
  'debts',
  'net_worth_history',
  'financial_scores',
  'push_subscriptions',
  'recurring_exceptions',
  'investments',
  'investment_movements',
] as const;

type ExportTable = (typeof USER_TABLES)[number];

async function fileToBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function exportAvatar(userId: string) {
  const { data: files, error } = await supabase.storage.from('avatars').list(userId);
  if (error || !files?.length) return [];

  const avatars = await Promise.all(files.filter((file) => file.name !== '.emptyFolderPlaceholder').map(async (file) => {
    const path = `${userId}/${file.name}`;
    const { data, error: downloadError } = await supabase.storage.from('avatars').download(path);
    if (downloadError || !data) return null;
    return {
      path,
      contentType: data.type || null,
      dataUrl: await fileToBase64(data),
    };
  }));

  return avatars.filter(Boolean);
}

export async function exportAllUserData(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const results = await Promise.all(USER_TABLES.map(async (table) => {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
    if (error) throw new Error(`Não foi possível exportar ${table}: ${error.message}`);
    return [table, data ?? []] as const;
  }));

  const avatars = await exportAvatar(user.id);
  const tables = Object.fromEntries(results) as Record<ExportTable, unknown[]>;
  const exportedAt = new Date().toISOString();
  const backup = {
    format: 'lumnia-backup',
    version: 1,
    exported_at: exportedAt,
    user: {
      id: user.id,
      email: user.email ?? null,
      metadata: user.user_metadata ?? {},
    },
    tables,
    storage: { avatars },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lumnia-backup-completo-${exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);

  return {
    fileName: anchor.download,
    tables: USER_TABLES.length,
    records: Object.values(tables).reduce((total, rows) => total + rows.length, 0),
    avatars: avatars.length,
  };
}
