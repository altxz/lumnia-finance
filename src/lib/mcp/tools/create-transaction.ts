import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "create_transaction",
  title: "Criar transação",
  description:
    "Cria uma nova despesa ou receita para o usuário autenticado. Use tipo 'expense' para despesa e 'income' para receita.",
  inputSchema: {
    description: z.string().min(1).describe("Descrição curta da transação."),
    value: z.number().positive().describe("Valor absoluto (positivo) em BRL."),
    date: z.string().describe("Data ISO YYYY-MM-DD."),
    type: z.enum(["expense", "income"]).describe("Tipo da transação."),
    category: z.string().optional().describe("Nome/slug da categoria final."),
    is_paid: z.boolean().optional().describe("Se já foi pago/recebido. Padrão: true."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("create_transaction", async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("expenses")
      .insert({
        user_id: ctx.getUserId(),
        description: input.description,
        value: input.value,
        date: input.date,
        type: input.type,
        final_category: input.category ?? "outros",
        category_ai: input.category ?? "outros",
        is_paid: input.is_paid ?? true,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Criada: ${data.id}` }],
      structuredContent: { transaction: data },
    };
  }),
});
