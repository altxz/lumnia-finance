/**
 * Resolvedores de identificadores para as ferramentas MCP.
 * Todas as ferramentas de escrita aceitam nome OU id; aqui centralizamos a
 * busca pelo id real e as mensagens de erro/ambiguidade em português.
 */

export class ResolveError extends Error {}

function norm(value: string) {
  return value.trim().toLowerCase();
}

async function resolveByName(
  sb: any,
  table: string,
  label: string,
  name: string,
  select = "id,name",
): Promise<any> {
  const { data, error } = await sb.from(table).select(select);
  if (error) throw new ResolveError(error.message);
  const rows = (data ?? []) as any[];
  const target = norm(name);
  let matches = rows.filter((r) => norm(String(r.name)) === target);
  if (matches.length === 0) matches = rows.filter((r) => norm(String(r.name)).includes(target));
  if (matches.length === 0)
    throw new ResolveError(
      `Não encontrei ${label} chamada "${name}". Opções: ${rows.map((r) => r.name).join(", ") || "nenhuma"}.`,
    );
  if (matches.length > 1)
    throw new ResolveError(
      `Existe mais de ${label} com o nome "${name}". Informe o id: ${matches
        .map((m) => `${m.name} (${m.id})`)
        .join(", ")}.`,
    );
  return matches[0];
}

export async function resolveWallet(sb: any, opts: { id?: string; name?: string }) {
  if (opts.id) {
    const { data, error } = await sb
      .from("wallets")
      .select("id,name,asset_type,currency")
      .eq("id", opts.id)
      .maybeSingle();
    if (error) throw new ResolveError(error.message);
    if (!data) throw new ResolveError("Carteira não encontrada para esta conta.");
    return data;
  }
  if (opts.name) return resolveByName(sb, "wallets", "carteira", opts.name, "id,name,asset_type,currency");
  return null;
}

export async function resolveCreditCard(sb: any, opts: { id?: string; name?: string }) {
  if (opts.id) {
    const { data, error } = await sb.from("credit_cards").select("*").eq("id", opts.id).maybeSingle();
    if (error) throw new ResolveError(error.message);
    if (!data) throw new ResolveError("Cartão de crédito não encontrado para esta conta.");
    return data;
  }
  if (opts.name) return resolveByName(sb, "credit_cards", "cartão", opts.name, "*");
  return null;
}

export async function resolveProject(sb: any, opts: { id?: string; name?: string }) {
  if (opts.id) {
    const { data, error } = await sb.from("projects").select("id,name").eq("id", opts.id).maybeSingle();
    if (error) throw new ResolveError(error.message);
    if (!data) throw new ResolveError("Projeto não encontrado para esta conta.");
    return data;
  }
  if (opts.name) return resolveByName(sb, "projects", "projeto", opts.name);
  return null;
}

export async function resolveCategory(sb: any, opts: { id?: string; name?: string }) {
  if (opts.id) {
    const { data, error } = await sb
      .from("categories")
      .select("id,name,parent_id,active")
      .eq("id", opts.id)
      .maybeSingle();
    if (error) throw new ResolveError(error.message);
    if (!data) throw new ResolveError("Categoria não encontrada para esta conta.");
    return data;
  }
  if (opts.name) return resolveByName(sb, "categories", "categoria", opts.name, "id,name,parent_id,active");
  return null;
}

export async function defaultWalletId(sb: any): Promise<string | null> {
  const { data } = await sb.from("user_settings").select("default_wallet_id").maybeSingle();
  if (data?.default_wallet_id) return data.default_wallet_id;
  const { data: wallets } = await sb
    .from("wallets")
    .select("id,asset_type,created_at")
    .order("created_at", { ascending: true });
  const first = ((wallets ?? []) as any[]).find((w) => w.asset_type !== "investment");
  return first?.id ?? null;
}

export function ok(text: string, structured?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function fail(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}
