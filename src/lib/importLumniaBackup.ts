import type * as XLSXType from 'xlsx';
import { supabase } from '@/lib/supabase';

// xlsx (SheetJS) é pesado (~500 kB minificado) e só é necessário quando o
// usuário efetivamente importa um arquivo .xlsx — carregado sob demanda para
// não inflar o chunk de Configurações, que qualquer visita à página paga.
let xlsxRef: typeof XLSXType | null = null;
async function ensureXLSX() {
  if (!xlsxRef) xlsxRef = await import('xlsx');
  return xlsxRef;
}

type Row = Record<string, unknown>;
type SourceKind = 'complete-json' | 'legacy-json' | 'excel';

export interface BackupPreview {
  kind: SourceKind;
  label: string;
  transactions: number;
  categories: number;
  wallets: number;
  creditCards: number;
  budgets: number;
  projects: number;
  limitations: string[];
  payload: ParsedBackup;
}

interface ParsedBackup {
  kind: SourceKind;
  tables?: Record<string, Row[]>;
  sheets?: Record<string, Row[]>;
  avatars?: AvatarBackup[];
  expenses: Row[];
}

interface AvatarBackup {
  path?: string;
  contentType?: string | null;
  dataUrl?: string;
}

export interface ImportResult {
  imported: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
}

export interface ImportProgress {
  value: number;
  label: string;
}

interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
const asText = (value: unknown) => String(value ?? '').trim();
const asNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = asText(value).replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};
const asBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  const text = normalize(value);
  if (['sim', 'true', 'pago', 'recebido', 'ativo', 'yes'].includes(text)) return true;
  if (['não', 'nao', 'false', 'pendente', 'inativo', 'no'].includes(text)) return false;
  return fallback;
};
const asDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    // xlsxRef já está carregado neste ponto: só existe um valor numérico de
    // data vindo de uma planilha, e readLumniaBackup carrega o xlsx antes de
    // processar qualquer linha de um arquivo .xlsx.
    const parsed = xlsxRef?.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = asText(value);
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parts = text.split(/[/-]/);
  if (parts.length === 3 && parts[2]?.length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return '';
};
const asInvoiceMonth = (value: unknown) => {
  const text = asText(value);
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  const brazilianMonth = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (brazilianMonth) return `${brazilianMonth[2]}-${brazilianMonth[1].padStart(2, '0')}`;
  const date = asDate(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
};
const chunks = <T,>(items: T[], size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

function getSheet(sheets: Record<string, Row[]>, name: string) {
  return sheets[name] ?? [];
}

export async function readLumniaBackup(file: File): Promise<BackupPreview> {
  const fileName = file.name.toLocaleLowerCase('pt-BR');
  if (fileName.endsWith('.json')) {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    if (parsed.format === 'lumnia-backup' && parsed.tables && typeof parsed.tables === 'object') {
      const tables = parsed.tables as Record<string, Row[]>;
      const storage = parsed.storage as { avatars?: AvatarBackup[] } | undefined;
      const avatars = Array.isArray(storage?.avatars) ? storage.avatars : [];
      return {
        kind: 'complete-json', label: 'Backup completo do Lumnia',
        transactions: tables.expenses?.length ?? 0, categories: tables.categories?.length ?? 0,
        wallets: tables.wallets?.length ?? 0, creditCards: tables.credit_cards?.length ?? 0,
        budgets: tables.budgets?.length ?? 0, projects: tables.projects?.length ?? 0,
        limitations: [], payload: { kind: 'complete-json', tables, avatars, expenses: tables.expenses ?? [] },
      };
    }
    if (Array.isArray(parsed.expenses)) {
      return {
        kind: 'legacy-json', label: 'JSON legado de transações', transactions: parsed.expenses.length,
        categories: 0, wallets: 0, creditCards: 0, budgets: 0, projects: 0,
        limitations: ['Este JSON antigo contém somente transações. Contas, cartões, categorias e orçamentos não existem no arquivo e não podem ser restaurados por ele.'],
        payload: { kind: 'legacy-json', expenses: parsed.expenses as Row[] },
      };
    }
    throw new Error('Este JSON não é um backup reconhecido do Lumnia.');
  }

  if (!fileName.endsWith('.xlsx')) throw new Error('Use um arquivo JSON ou a planilha Excel exportada pelo Lumnia.');
  const XLSX = await ensureXLSX();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets = Object.fromEntries(workbook.SheetNames.map(name => [name, XLSX.utils.sheet_to_json<Row>(workbook.Sheets[name], { defval: null, raw: true })]));
  const transactions = getSheet(sheets, 'Transações');
  if (!transactions.length) throw new Error('A planilha não contém a aba Transações do Lumnia.');
  return {
    kind: 'excel', label: 'Planilha completa do Lumnia', transactions: transactions.length,
    categories: getSheet(sheets, 'Categorias').length, wallets: getSheet(sheets, 'Carteiras').length,
    creditCards: getSheet(sheets, 'Cadastro de Cartões').length, budgets: getSheet(sheets, 'Orçamentos').length,
    projects: getSheet(sheets, 'Projetos').length,
    limitations: ['A planilha Excel antiga não inclui os campos necessários para reconstruir dívidas e investimentos com segurança. Esses itens não serão inventados nem restaurados de forma incompleta.'],
    payload: { kind: 'excel', sheets, expenses: transactions },
  };
}

async function insertInBatches(table: string, rows: Row[], result: ImportResult) {
  if (!rows.length) return;
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table as never).insert(batch as never);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  result.imported[table] = (result.imported[table] ?? 0) + rows.length;
}

async function upsertInBatches(table: string, rows: Row[], result: ImportResult) {
  if (!rows.length) return;
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table as never).upsert(batch as never, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  result.imported[table] = (result.imported[table] ?? 0) + rows.length;
}

async function restoreAvatars(userId: string, avatars: AvatarBackup[], result: ImportResult) {
  const restoredPaths = new Map<string, string>();
  for (const avatar of avatars) {
    if (!avatar.path || !avatar.dataUrl?.startsWith('data:')) continue;
    const originalName = avatar.path.split('/').pop() || 'avatar.jpeg';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = `${userId}/${safeName}`;
    const response = await fetch(avatar.dataUrl);
    const file = await response.blob();
    const { error } = await supabase.storage.from('avatars').upload(targetPath, file, {
      upsert: true,
      contentType: avatar.contentType || file.type || 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) throw new Error(`avatar: ${error.message}`);
    restoredPaths.set(avatar.path, targetPath);
    result.imported.avatars = (result.imported.avatars ?? 0) + 1;
  }
  return restoredPaths;
}

async function importCompleteBackup(userId: string, tables: Record<string, Row[]>, avatars: AvatarBackup[], result: ImportResult, options?: ImportOptions) {
  const entityTables = ['categories', 'wallets', 'credit_cards', 'projects', 'debts', 'investments'];
  const dependentTables = ['expenses', 'budgets', 'automation_rules', 'ai_corrections', 'notifications', 'net_worth_history', 'financial_scores', 'recurring_exceptions', 'investment_movements'];
  const allTables = [...entityTables, ...dependentTables];
  for (const [index, table] of entityTables.entries()) {
    options?.onProgress?.({ value: 8 + Math.round((index / allTables.length) * 82), label: `Restaurando ${table.replace(/_/g, ' ')}...` });
    const rows = (tables[table] ?? []).map(row => ({ ...row, user_id: userId }));
    await upsertInBatches(table, rows, result);
  }
  for (const [index, table] of dependentTables.entries()) {
    options?.onProgress?.({ value: 8 + Math.round(((entityTables.length + index) / allTables.length) * 82), label: `Restaurando ${table.replace(/_/g, ' ')}...` });
    const rows = (tables[table] ?? []).map(row => ({ ...row, user_id: userId }));
    await upsertInBatches(table, rows, result);
  }
  options?.onProgress?.({ value: 92, label: 'Restaurando foto de perfil...' });
  const restoredAvatarPaths = await restoreAvatars(userId, avatars, result);
  const settings = tables.user_settings?.[0];
  if (settings) {
    const originalAvatar = asText(settings.avatar_url);
    const avatarUrl = restoredAvatarPaths.get(originalAvatar) ?? (originalAvatar || null);
    const { error } = await supabase.from('user_settings').upsert({ ...settings, user_id: userId, avatar_url: avatarUrl }, { onConflict: 'user_id' });
    if (error) throw new Error(`user_settings: ${error.message}`);
    result.imported.user_settings = 1;
  }
  if ((tables.push_subscriptions?.length ?? 0) > 0) result.warnings.push('Assinaturas de notificação não foram restauradas por segurança. O aplicativo solicitará uma nova permissão quando necessário.');
}

async function importExcelOrLegacy(userId: string, backup: ParsedBackup, result: ImportResult, options?: ImportOptions) {
  options?.onProgress?.({ value: 5, label: 'Conferindo os dados existentes...' });
  const sheets = backup.sheets ?? {};
  const [existingCategories, existingWallets, existingCards, existingProjects] = await Promise.all([
    supabase.from('categories').select('id,name').eq('user_id', userId),
    supabase.from('wallets').select('id,name').eq('user_id', userId),
    supabase.from('credit_cards').select('id,name').eq('user_id', userId),
    supabase.from('projects').select('id,name').eq('user_id', userId),
  ]);
  for (const query of [existingCategories, existingWallets, existingCards, existingProjects]) if (query.error) throw new Error(query.error.message);
  const categoryMap = new Map((existingCategories.data ?? []).map(row => [normalize(row.name), row.id]));
  const walletMap = new Map((existingWallets.data ?? []).map(row => [normalize(row.name), row.id]));
  const cardMap = new Map((existingCards.data ?? []).map(row => [normalize(row.name), row.id]));
  const projectMap = new Map((existingProjects.data ?? []).map(row => [normalize(row.name), row.id]));

  if (backup.kind === 'excel') {
    options?.onProgress?.({ value: 16, label: 'Restaurando categorias...' });
    const categoryRows = getSheet(sheets, 'Categorias');
    const pendingCategories = categoryRows.filter(row => !categoryMap.has(normalize(row.Nome))).map(row => ({
      id: crypto.randomUUID(), user_id: userId, name: asText(row.Nome), icon: asText(row.Ícone) || 'tag', color: asText(row.Cor) || '#6366f1',
      keywords: asText(row['Palavras-chave']).split(',').map(item => item.trim()).filter(Boolean), active: asBoolean(row.Ativa, true), sort_order: asNumber(row.Ordem),
    })).filter(row => row.name);
    await insertInBatches('categories', pendingCategories, result);
    pendingCategories.forEach(row => categoryMap.set(normalize(row.name), row.id));
    for (const row of categoryRows) {
      const childId = categoryMap.get(normalize(row.Nome));
      const parentId = categoryMap.get(normalize(row['Categoria pai']));
      if (!childId || !parentId || childId === parentId) continue;
      const { error } = await supabase.from('categories').update({ parent_id: parentId }).eq('id', childId).eq('user_id', userId);
      if (error) throw new Error(`hierarquia de categorias: ${error.message}`);
    }

    options?.onProgress?.({ value: 30, label: 'Restaurando contas...' });
    const pendingWallets = getSheet(sheets, 'Carteiras').filter(row => !walletMap.has(normalize(row.Nome))).map(row => ({
      id: crypto.randomUUID(), user_id: userId, name: asText(row.Nome), asset_type: ({ conta: 'checking_account', 'conta corrente': 'checking_account', poupanca: 'savings', investimento: 'investment', cripto: 'crypto' } as Record<string, string>)[normalize(row.Tipo)] ?? 'checking_account',
      initial_balance: asNumber(row['Saldo inicial']), current_balance: asNumber(row['Saldo atual']), currency: asText(row.Moeda) || 'BRL', crypto_symbol: asText(row['Cripto (símbolo)']) || null, crypto_amount: asNumber(row['Cripto (qtd.)']) || null, crypto_price: asNumber(row['Cripto (preço)']) || null,
    })).filter(row => row.name);
    await insertInBatches('wallets', pendingWallets, result);
    pendingWallets.forEach(row => walletMap.set(normalize(row.name), row.id));

    options?.onProgress?.({ value: 40, label: 'Restaurando cartões...' });
    const pendingCards = getSheet(sheets, 'Cadastro de Cartões').filter(row => !cardMap.has(normalize(row.Nome))).map(row => ({ id: crypto.randomUUID(), user_id: userId, name: asText(row.Nome), limit_amount: asNumber(row.Limite), closing_day: asNumber(row['Dia de fechamento']) || 1, due_day: asNumber(row['Dia de vencimento']) || 10, closing_strategy: asText(row['Estratégia de fechamento']) || 'fixed', closing_days_before_due: asNumber(row['Dias antes do vencimento']) || 7 })).filter(row => row.name);
    await insertInBatches('credit_cards', pendingCards, result);
    pendingCards.forEach(row => cardMap.set(normalize(row.name), row.id));

    options?.onProgress?.({ value: 48, label: 'Restaurando projetos...' });
    const pendingProjects = getSheet(sheets, 'Projetos').filter(row => !projectMap.has(normalize(row.Nome))).map(row => ({ id: crypto.randomUUID(), user_id: userId, name: asText(row.Nome), budget: asNumber(row.Orçamento), color: asText(row.Cor) || '#6366f1' })).filter(row => row.name);
    await insertInBatches('projects', pendingProjects, result);
    pendingProjects.forEach(row => projectMap.set(normalize(row.name), row.id));
  }

  const excelById = new Map(getSheet(sheets, 'Transações').map(row => [asText(row.ID), row]));
  const expenses = backup.expenses.map((row, index) => {
    const excel = backup.kind === 'excel' ? row : excelById.get(asText(row.id));
    const typeValue = normalize(backup.kind === 'excel' ? row.Tipo : row.type);
    const type = typeValue.includes('receita') || typeValue === 'income' ? 'income' : typeValue.includes('transfer') ? 'transfer' : 'expense';
    const category = asText(backup.kind === 'excel' ? row.Categoria : row.final_category) || 'Outros';
    const walletName = asText(excel?.Carteira);
    const destinationWalletName = asText(excel?.['Carteira destino']);
    const cardName = asText(excel?.Cartão);
    const projectName = asText(excel?.Projeto);
    return {
      id: asText(backup.kind === 'excel' ? row.ID : row.id) || crypto.randomUUID(), user_id: userId,
      date: asDate(backup.kind === 'excel' ? row.Data : row.date), description: asText(backup.kind === 'excel' ? row.Descrição : row.description) || `Transação importada ${index + 1}`,
      value: Math.abs(asNumber(backup.kind === 'excel' ? row.Valor : row.value)), type, final_category: category,
      category_ai: asText(backup.kind === 'excel' ? row['Categoria sugerida (IA)'] : row.category_ai) || null,
      wallet_id: walletMap.get(normalize(walletName)) ?? null, destination_wallet_id: walletMap.get(normalize(destinationWalletName)) ?? null, credit_card_id: cardMap.get(normalize(cardName)) ?? null,
      payment_method: asText(backup.kind === 'excel' ? row['Forma de pagamento'] : row.payment_method) || null,
      invoice_month: asInvoiceMonth(backup.kind === 'excel' ? row['Mês da fatura'] : row.invoice_month),
      is_paid: backup.kind === 'excel' ? asBoolean(row.Status, true) : asBoolean(row.is_paid, true), is_recurring: backup.kind === 'excel' ? asBoolean(row.Recorrente) : asBoolean(row.is_recurring),
      frequency: normalize(backup.kind === 'excel' ? row.Frequência : row.frequency).startsWith('anual') ? 'annual' : normalize(backup.kind === 'excel' ? row.Frequência : row.frequency).startsWith('mensal') || normalize(backup.kind === 'excel' ? row.Frequência : row.frequency) === 'monthly' ? 'monthly' : null,
      installments: Math.max(1, Math.round(asNumber(backup.kind === 'excel' ? row.Parcelas : row.installments)) || 1), installment_info: asText(backup.kind === 'excel' ? row['Info parcela'] : row.installment_info) || null,
      installment_group_id: asText(backup.kind === 'excel' ? row['Grupo parcelamento'] : row.installment_group_id) || null, project_id: projectMap.get(normalize(projectName)) ?? null,
      notes: asText(backup.kind === 'excel' ? row.Observações : row.notes) || null,
      tags: (backup.kind === 'excel' ? asText(row.Tags).split(',') : Array.isArray(row.tags) ? row.tags : []).map(String).map(tag => tag.trim()).filter(Boolean),
    };
  }).filter(row => row.date && row.description);

  const expenseBatches = chunks(expenses);
  for (const [index, batch] of expenseBatches.entries()) {
    options?.onProgress?.({ value: 55 + Math.round((index / Math.max(expenseBatches.length, 1)) * 33), label: `Importando transações ${Math.min(index * 100 + 1, expenses.length)}–${Math.min((index + 1) * 100, expenses.length)} de ${expenses.length}...` });
    const { error } = await supabase.from('expenses').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`transações: ${error.message}`);
  }
  result.imported.expenses = expenses.length;
  result.skipped.expenses = backup.expenses.length - expenses.length;

  if (backup.kind === 'excel') {
    options?.onProgress?.({ value: 91, label: 'Restaurando orçamentos...' });
    const existingBudgets = await supabase.from('budgets').select('month_year,category,allocated_amount').eq('user_id', userId);
    if (existingBudgets.error) throw new Error(existingBudgets.error.message);
    const budgetKeys = new Set((existingBudgets.data ?? []).map(row => `${row.month_year}|${normalize(row.category)}|${row.allocated_amount}`));
    const budgets = getSheet(sheets, 'Orçamentos').map(row => {
      const category = asText(row.Categoria); const month = asDate(row.Mês);
      return { user_id: userId, category, category_id: categoryMap.get(normalize(category)) ?? null, month_year: month, allocated_amount: asNumber(row['Valor planejado']), is_recurring: asBoolean(row.Recorrente) };
    }).filter(row => row.category && row.month_year && !budgetKeys.has(`${row.month_year}|${normalize(row.category)}|${row.allocated_amount}`));
    await insertInBatches('budgets', budgets, result);
    result.skipped.budgets = getSheet(sheets, 'Orçamentos').length - budgets.length;
  }

  if (backup.kind === 'legacy-json') result.warnings.push('As transações foram importadas, porém este JSON antigo não continha as contas e cartões de origem. Esses vínculos foram deixados em branco.');
}

export async function importLumniaBackup(userId: string, preview: BackupPreview, options?: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: {}, skipped: {}, warnings: [...preview.limitations] };
  options?.onProgress?.({ value: 2, label: 'Preparando a importação...' });
  if (preview.kind === 'complete-json' && preview.payload.tables) await importCompleteBackup(userId, preview.payload.tables, preview.payload.avatars ?? [], result, options);
  else await importExcelOrLegacy(userId, preview.payload, result, options);
  options?.onProgress?.({ value: 100, label: 'Importação concluída.' });
  return result;
}
