import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabaseClient";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const transactionSchema = z.object({
  id: z.string(),
  date: dateSchema,
  description: z.string(),
  value: z.number(),
  type: z.string(),
  final_category: z.string().nullable(),
  is_paid: z.boolean(),
  payment_method: z.string().nullable(),
  credit_card_id: z.string().nullable(),
  wallet_id: z.string().nullable(),
  invoice_month: z.string().nullable(),
  is_recurring: z.boolean(),
});

export default defineTool({
  name: "list_transactions",
  title: "Listar transações",
  description:
    "Lista despesas e receitas do usuário autenticado em um intervalo de datas (padrão: últimos 30 dias). Retorna id, data, descrição, valor, tipo, categoria, se está paga e forma de pagamento.",
  inputSchema: {
    start_date: dateSchema.optional().describe("Data inicial ISO (YYYY-MM-DD). Padrão: 30 dias atrás."),
    end_date: dateSchema.optional().describe("Data final ISO (YYYY-MM-DD). Padrão: hoje."),
    type: z.enum(["income", "expense", "transfer"]).optional().describe("Filtrar por tipo."),
    limit: z.number().int().min(1).max(500).optional().describe("Máximo de registros (padrão 100)."),
  },
  outputSchema: {
    transactions: z.array(transactionSchema),
    start_date: dateSchema,
    end_date: dateSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, type, limit }, ctx) => {
    const invocation = {
      tool: "list_transactions",
      arguments: { start_date, end_date, type, limit },
      authenticated: ctx.isAuthenticated(),
      user_identified: Boolean(ctx.getUserId()),
      token_identified: Boolean(ctx.getToken()),
      client_identified: Boolean(ctx.getClientId()),
    };
    console.info("[mcp.tool.request]", JSON.stringify(invocation));

    if (!ctx.isAuthenticated()) {
      console.warn("[mcp.tool.response]", JSON.stringify({ tool: invocation.tool, ok: false, reason: "not_authenticated" }));
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    try {
      const today = new Date();
      const end = end_date ?? today.toISOString().slice(0, 10);
      const start =
        start_date ??
        new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
      const userId = ctx.getUserId();
      if (!userId) {
        console.warn("[mcp.tool.response]", JSON.stringify({ tool: invocation.tool, ok: false, reason: "missing_user_id" }));
        return toolError("Falha de autenticação", "Usuário OAuth sem identificador");
      }

      const sb = supabaseForUser(ctx);
      let q = sb
        .from("expenses")
        .select(
          "id,date,description,value,type,final_category,is_paid,payment_method,credit_card_id,wallet_id,invoice_month,is_recurring",
        )
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .limit(limit ?? 100);
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) {
        console.error("[mcp.tool.response]", JSON.stringify({ tool: invocation.tool, ok: false, database_code: error.code, message: error.message }));
        return toolError("Falha ao consultar as transações", error);
      }

      const payload = { transactions: data ?? [], start_date: start, end_date: end };
      console.info("[mcp.tool.response]", JSON.stringify({ tool: invocation.tool, ok: true, count: payload.transactions.length, start_date: start, end_date: end }));
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (error) {
      console.error("[mcp.tool.exception]", error);
      return toolError("Erro de conexão ao consultar as transações", error);
    }
  },
});
