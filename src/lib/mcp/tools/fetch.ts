import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";

/**
 * Ferramenta `fetch` do contrato de conectores do ChatGPT: abre um registro
 * retornado pela ferramenta `search`.
 */
export default defineTool({
  name: "fetch",
  title: "Abrir transação",
  description:
    "Retorna todos os detalhes de uma transação do usuário autenticado a partir do id devolvido pela ferramenta search.",
  inputSchema: {
    id: z.string().trim().min(1).describe("ID da transação (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("expenses")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: `Transação ${id} não encontrada para este usuário.` }],
        isError: true,
      };
    }

    const document = {
      id: data.id as string,
      title: `${data.date} — ${data.description}`,
      text: JSON.stringify(data),
      url: null as string | null,
      metadata: {
        type: data.type as string,
        value: Number(data.value),
        category: (data.final_category ?? null) as string | null,
        is_paid: Boolean(data.is_paid),
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(document) }],
      structuredContent: document,
    };
  },
});
