/**
 * Resolvedores de identificadores (nome OU id) para as ferramentas da IA
 * interna. Espelha src/lib/mcp/resolve.ts, mas filtra sempre por user_id
 * porque a edge function usa a chave de serviço.
 */

export class ResolveError extends Error {}

function norm(value: string) {
  return value.trim().toLowerCase();
}

async function resolveByName(
  sb: any,
  userId: string,
  table: string,
  label: string,
  name: string,
  select = "id,name",
): Promise<any> {
  const { data, error } = await sb.from(table).select(select).eq("user_id", userId);
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

async function resolveById(sb: any, userId: string, table: string, id: string, select: string, notFound: string) {
  const { data, error } = await sb.from(table).select(select).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw new ResolveError(error.message);
  if (!data) throw new ResolveError(notFound);
  return data;
}

export async function resolveWallet(sb: any, userId: string, opts: { id?: string; name?: string }) {
  if (opts.id)
    return resolveById(
      sb,
      userId,
      "wallets",
      opts.id,
      "id,name,asset_type,currency",
      "Carteira não encontrada para esta conta.",
    );
  if (opts.name) return resolveByName(sb, userId, "wallets", "carteira", opts.name, "id,name,asset_type,currency");
  return null;
}

export async function resolveCreditCard(sb: any, userId: string, opts: { id?: string; name?: string }) {
  if (opts.id)
    return resolveById(sb, userId, "credit_cards", opts.id, "*", "Cartão de crédito não encontrado para esta conta.");
  if (opts.name) return resolveByName(sb, userId, "credit_cards", "cartão", opts.name, "*");
  return null;
}

export async function resolveProject(sb: any, userId: string, opts: { id?: string; name?: string }) {
  if (opts.id) return resolveById(sb, userId, "projects", opts.id, "id,name", "Projeto não encontrado para esta conta.");
  if (opts.name) return resolveByName(sb, userId, "projects", "projeto", opts.name);
  return null;
}

export async function resolveCategory(sb: any, userId: string, opts: { id?: string; name?: string }) {
  if (opts.id)
    return resolveById(
      sb,
      userId,
      "categories",
      opts.id,
      "id,name,parent_id,active",
      "Categoria não encontrada para esta conta.",
    );
  if (opts.name) return resolveByName(sb, userId, "categories", "categoria", opts.name, "id,name,parent_id,active");
  return null;
}

export async function resolveInvestment(sb: any, userId: string, opts: { id?: string; name?: string }) {
  if (opts.id)
    return resolveById(sb, userId, "investments", opts.id, "*", "Investimento não encontrado para esta conta.");
  if (opts.name) return resolveByName(sb, userId, "investments", "investimento", opts.name, "*");
  return null;
}

export async function defaultWalletId(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("user_settings").select("default_wallet_id").eq("user_id", userId).maybeSingle();
  if (data?.default_wallet_id) return data.default_wallet_id;
  const { data: wallets } = await sb
    .from("wallets")
    .select("id,asset_type,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const first = ((wallets ?? []) as any[]).find((w) => w.asset_type !== "investment");
  return first?.id ?? null;
}
