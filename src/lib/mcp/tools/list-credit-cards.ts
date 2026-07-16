import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "list_credit_cards",
  title: "Listar cartões de crédito",
  description: "Lista cartões de crédito do usuário com limite, dia de fechamento e vencimento.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("credit_cards")
      .select("id,name,limit_amount,closing_day,due_day,closing_strategy");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { credit_cards: data ?? [] },
    };
  },
});
