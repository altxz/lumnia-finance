import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { readEnv, requireEnv } from "./env";

function supabasePublishableKey(): string {
  const direct = readEnv("SUPABASE_PUBLISHABLE_KEY")?.trim();
  if (direct) return direct;

  const keyset = readEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)].find(
          (value): value is string =>
            typeof value === "string" && value.trim().startsWith("sb_publishable_"),
        );
        if (key) return key.trim();
      }
    } catch {
      // Tenta a chave legada abaixo quando o dicionário estiver malformado.
    }
  }

  return requireEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
}

export function supabaseForUser(ctx: ToolContext) {
  const url = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const key = supabasePublishableKey();
  const token = ctx.getToken();
  if (!token) throw new Error("Token OAuth verificado não disponível para consultar os dados.");

  return createClient(url, key, {
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Normaliza erros de rede/configuração em mensagens úteis para o cliente MCP. */
export function toolError(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
    isError: true,
  };
}
