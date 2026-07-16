import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "list_transactions",
  title: "Listar transações",
  description:
    "Lista despesas e receitas do usuário autenticado em um intervalo de datas (padrão: últimos 30 dias). Retorna id, data, descrição, valor, tipo, categoria, se está paga e forma de pagamento.",
  inputSchema: {
    start_date: z.string().optional().describe("Data inicial ISO (YYYY-MM-DD). Padrão: 30 dias atrás."),
    end_date: z.string().optional().describe("Data final ISO (YYYY-MM-DD). Padrão: hoje."),
    type: z.enum(["income", "expense", "transfer"]).optional().describe("Filtrar por tipo."),
    limit: z.number().int().min(1).max(500).optional().describe("Máximo de registros (padrão 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const today = new Date();
    const end = end_date ?? today.toISOString().slice(0, 10);
    const start =
      start_date ??
      new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("expenses")
      .select(
        "id,date,description,value,type,final_category,is_paid,payment_method,credit_card_id,wallet_id,invoice_month,is_recurring",
      )
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .limit(limit ?? 100);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { transactions: data ?? [], start_date: start, end_date: end },
    };
  },
});
