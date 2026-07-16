import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "month_summary",
  title: "Resumo do mês",
  description:
    "Resume receitas, despesas e saldo do mês informado (YYYY-MM). Considera transações pagas e agrupa despesas por categoria.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(Date.UTC(y, m, 0));
    const end = endDate.toISOString().slice(0, 10);
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("expenses")
      .select("value,type,final_category,is_paid")
      .gte("date", start)
      .lte("date", end);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const r of data ?? []) {
      if (!r.is_paid) continue;
      if (r.type === "income") income += Number(r.value);
      else if (r.type === "expense") {
        expense += Number(r.value);
        byCategory[r.final_category ?? "outros"] =
          (byCategory[r.final_category ?? "outros"] ?? 0) + Number(r.value);
      }
    }
    const summary = { month, income, expense, balance: income - expense, byCategory };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
