import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { safeHandler } from "../safeHandler";
import { supabaseForUser } from "../supabaseClient";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}-01`;
  return { start, end };
}

export default defineTool({
  name: "list_budgets",
  title: "Listar orçamentos",
  description:
    "Lista os orçamentos (metas por categoria) do mês informado, com o valor planejado, o valor já gasto e o saldo restante. Inclui orçamentos recorrentes herdados de meses anteriores quando o mês não tem meta própria.",
  inputSchema: {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("list_budgets", async (input, ctx) => {
    const sb = supabaseForUser(ctx);
    const { start, end } = monthBounds(input.month);

    const [{ data: current, error: e1 }, { data: recurring, error: e2 }, { data: expenses, error: e3 }, { data: categories, error: e4 }] =
      await Promise.all([
        sb.from("budgets").select("*").eq("month_year", start),
        sb
          .from("budgets")
          .select("*")
          .eq("is_recurring", true)
          .lt("month_year", start)
          .order("month_year", { ascending: false }),
        sb
          .from("expenses")
          .select("final_category,value,type,description")
          .gte("date", start)
          .lt("date", end),
        sb.from("categories").select("id,name,parent_id"),
      ]);

    const error = e1 || e2 || e3 || e4;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    // Herança de orçamentos recorrentes (mesma regra do app).
    const rows = [...(current ?? [])];
    const seen = new Set(rows.map((b: any) => b.category_id));
    for (const rb of (recurring ?? []) as any[]) {
      if (rb.category_id && !seen.has(rb.category_id)) {
        seen.add(rb.category_id);
        rows.push({ ...rb, month_year: start, inherited: true });
      }
    }

    const spentByName: Record<string, number> = {};
    for (const e of (expenses ?? []) as any[]) {
      if (e.type === "income" || e.type === "transfer") continue;
      if (typeof e.description === "string" && e.description.startsWith("Pagamento fatura")) continue;
      spentByName[e.final_category] = (spentByName[e.final_category] || 0) + Number(e.value || 0);
    }

    const cats = (categories ?? []) as any[];
    const childrenOf: Record<string, any[]> = {};
    for (const c of cats) if (c.parent_id) (childrenOf[c.parent_id] ||= []).push(c);

    const budgets = rows.map((b: any) => {
      const cat = cats.find(c => c.id === b.category_id);
      const name = cat?.name ?? b.category;
      let spent = spentByName[name] || 0;
      if (cat && !cat.parent_id) {
        for (const ch of childrenOf[cat.id] ?? []) spent += spentByName[ch.name] || 0;
      }
      const allocated = Number(b.allocated_amount || 0);
      return {
        id: b.id,
        category: name,
        category_id: b.category_id,
        month: input.month,
        allocated_amount: allocated,
        spent,
        remaining: allocated - spent,
        percent_used: allocated > 0 ? Math.round((spent / allocated) * 100) : null,
        is_recurring: !!b.is_recurring,
        inherited: !!b.inherited,
      };
    });

    const totals = budgets.reduce(
      (acc, b) => ({ allocated: acc.allocated + b.allocated_amount, spent: acc.spent + b.spent }),
      { allocated: 0, spent: 0 },
    );

    return {
      content: [{ type: "text", text: JSON.stringify({ month: input.month, totals, budgets }) }],
      structuredContent: { month: input.month, totals, budgets },
    };
  }),
});
