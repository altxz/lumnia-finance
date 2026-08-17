import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";

/**
 * Ferramenta `search` do contrato de conectores do ChatGPT.
 * Sem ela o cliente tenta abrir recursos e recebe "Resource not found".
 */
export default defineTool({
  name: "search",
  title: "Buscar transações",
  description:
    "Busca transações (despesas e receitas) do usuário autenticado por texto livre na descrição, categoria ou mês (YYYY-MM). Retorna uma lista de resultados com id, título e resumo para depois usar a ferramenta fetch.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .describe("Termo de busca: descrição, categoria ou mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const monthMatch = query.match(/(\d{4})-(\d{2})/);

    let q = sb
      .from("expenses")
      .select("id,date,description,value,type,final_category,is_paid,payment_method")
      .order("date", { ascending: false })
      .limit(50);

    if (monthMatch) {
      const [, ys, ms] = monthMatch;
      const y = Number(ys);
      const m = Number(ms);
      const start = `${ys}-${ms}-01`;
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      q = q.gte("date", start).lte("date", end);
    } else {
      const term = `%${query}%`;
      q = q.or(`description.ilike.${term},final_category.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const results = (data ?? []).map((r) => ({
      id: r.id as string,
      title: `${r.date} — ${r.description} (${r.type === "income" ? "receita" : "despesa"} R$ ${Number(r.value).toFixed(2)})`,
      text: `Categoria: ${r.final_category ?? "sem categoria"}. ${r.is_paid ? "Pago/recebido" : "Pendente"}. Forma: ${r.payment_method ?? "n/d"}.`,
      url: null as string | null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify({ results }) }],
      structuredContent: { results },
    };
  },
});
