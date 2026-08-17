import type { ToolContext } from "@lovable.dev/mcp-js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/** Transforma qualquer erro em texto legível (sem expor token/claims). */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean).map(String);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return "erro desconhecido";
    }
  }
  return String(error ?? "erro desconhecido");
}

function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Envolve o handler de uma ferramenta MCP para que NENHUMA falha de consulta
 * escape como exceção. Clientes como o ChatGPT desabilitam a integração quando
 * a chamada quebra o protocolo; devolvendo sempre um resultado `isError` com
 * texto explicativo, a ferramenta continua disponível.
 */
export function safeHandler<Input>(
  toolName: string,
  fn: (input: Input, ctx: ToolContext) => Promise<ToolResult> | ToolResult,
) {
  return async (input: Input, ctx: ToolContext): Promise<ToolResult> => {
    try {
      if (!ctx.isAuthenticated() || !ctx.getUserId()) {
        console.warn(`[mcp.tool.${toolName}] não autenticado`);
        return errorResult(
          "Não foi possível identificar sua conta nesta chamada. Reconecte o app Lumnia e tente novamente.",
        );
      }
      const result = await fn(input, ctx);
      if (!result || !Array.isArray(result.content) || result.content.length === 0) {
        return errorResult(`A ferramenta ${toolName} não retornou conteúdo utilizável.`);
      }
      return result;
    } catch (error) {
      const message = describeError(error);
      console.error(`[mcp.tool.${toolName}] falha`, message);
      return errorResult(`Falha ao executar ${toolName}: ${message}`);
    }
  };
}
