/**
 * Reads an environment variable in a runtime-agnostic way.
 * The MCP tools run inside the Supabase Edge Runtime (Deno), where
 * `Deno.env.get` is always available, while `process.env` may be missing
 * or partially populated depending on the compatibility layer.
 */
export function readEnv(name: string): string | undefined {
  const g = globalThis as unknown as {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };

  const fromDeno = g.Deno?.env?.get?.(name);
  if (fromDeno) return fromDeno;

  const fromProcess = g.process?.env?.[name];
  return fromProcess || undefined;
}

export function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  throw new Error(
    `Configuração ausente no servidor: nenhuma das variáveis ${names.join(", ")} está definida.`,
  );
}
