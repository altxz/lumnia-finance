import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { safeHandler } from "../safeHandler";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "delete_budget",
  title: "Excluir orçamento",
  description:
    "Exclui a meta de orçamento de uma categoria em um mês. Informe budget_id (de list_budgets) ou month + category_id/category.",
  inputSchema: {
    budget_id: z.string().uuid().optional().describe("ID da meta retornado por list_budgets."),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Mês no formato YYYY-MM (usado com category_id/category)."),
    category_id: z.string().uuid().optional().describe("ID da categoria."),
    category: z.string().optional().describe("Nome da categoria."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  handler: safeHandler("delete_budget", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);

    let targetId = input.budget_id ?? null;

    if (!targetId) {
      if (!input.month || (!input.category_id && !input.category))
        return {
          content: [{ type: "text", text: "Informe budget_id ou month + category_id/category." }],
          isError: true,
        };

      let categoryId = input.category_id ?? null;
      if (!categoryId) {
        const { data: cats, error: catError } = await sb.from("categories").select("id,name");
        if (catError) return { content: [{ type: "text", text: catError.message }], isError: true };
        const target = String(input.category).trim().toLowerCase();
        const matches = (cats ?? []).filter((c: any) => String(c.name).trim().toLowerCase() === target);
        if (matches.length === 0)
          return {
            content: [{ type: "text", text: `Nenhuma categoria chamada "${input.category}".` }],
            isError: true,
          };
        if (matches.length > 1)
          return {
            content: [
              {
                type: "text",
                text: `Existe mais de uma categoria "${input.category}". Informe category_id: ${matches
                  .map((m: any) => m.id)
                  .join(", ")}`,
              },
            ],
            isError: true,
          };
        categoryId = matches[0].id;
      }

      const { data: existing, error: findError } = await sb
        .from("budgets")
        .select("id")
        .eq("month_year", `${input.month}-01`)
        .eq("category_id", categoryId)
        .maybeSingle();
      if (findError) return { content: [{ type: "text", text: findError.message }], isError: true };
      if (!existing)
        return {
          content: [{ type: "text", text: "Nenhuma meta de orçamento encontrada para esta categoria no mês." }],
          isError: true,
        };
      targetId = existing.id;
    }

    const { error } = await sb.from("budgets").delete().eq("id", targetId);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: "Meta de orçamento excluída." }],
      structuredContent: { deleted_id: targetId, action: "deleted" },
    };
  }),
});
