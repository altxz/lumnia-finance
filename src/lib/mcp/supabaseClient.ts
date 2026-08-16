import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { requireEnv } from "./env";

export function supabaseForUser(ctx: ToolContext) {
  const url = requireEnv(["SUPABASE_URL"]);
  const key = requireEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEYS",
  ]);
  const token = ctx.getToken();

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
