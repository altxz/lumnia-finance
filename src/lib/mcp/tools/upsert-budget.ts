import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { safeHandler } from "../safeHandler";
import { supabaseForUser } from "../supabaseClient";

export const budgetFields = {
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe("Mês no formato YYYY-MM."),
  allocated_amount: z.number().min(0).describe("Valor planejado em BRL."),
  category_id: z.string().uuid().optional().describe("ID da categoria (preferencial)."),
  category: z.string().optional().describe("Nome da categoria, usado se category_id não for informado."),
  is_recurring: z.boolean().optional().describe("Se a meta deve se repetir nos meses seguintes."),
};

export const runUpsertBudget = async (input: any, ctx: any) => {
    const sb = supabaseForUser(ctx);
    const monthStart = `${input.month}-01`;

    let categoryId = input.category_id ?? null;
    let categoryName = input.category ?? null;

    const { data: categories, error: catError } = await sb.from("categories").select("id,name,active");
    if (catError) return { content: [{ type: "text", text: catError.message }], isError: true };
    const cats = (categories ?? []) as any[];

    if (categoryId) {
      const found = cats.find(c => c.id === categoryId);
      if (!found)
        return { content: [{ type: "text", text: "Categoria não encontrada para este usuário." }], isError: true };
      categoryName = found.name;
    } else if (categoryName) {
      const target = categoryName.trim().toLowerCase();
      const matches = cats.filter(c => String(c.name).trim().toLowerCase() === target);
      if (matches.length === 0)
        return {
          content: [
            { type: "text", text: `Nenhuma categoria chamada "${categoryName}". Use list_categories para ver as opções.` },
          ],
          isError: true,
        };
      if (matches.length > 1)
        return {
          content: [
            {
              type: "text",
              text: `Existe mais de uma categoria "${categoryName}". Informe category_id: ${matches.map(m => m.id).join(", ")}`,
            },
          ],
          isError: true,
        };
      categoryId = matches[0].id;
      categoryName = matches[0].name;
    } else {
      return {
        content: [{ type: "text", text: "Informe category_id ou category." }],
        isError: true,
      };
    }

    const { data: existing, error: findError } = await sb
      .from("budgets")
      .select("*")
      .eq("month_year", monthStart)
      .eq("category_id", categoryId)
      .maybeSingle();
    if (findError) return { content: [{ type: "text", text: findError.message }], isError: true };

    if (existing) {
      const patch: Record<string, unknown> = { allocated_amount: input.allocated_amount };
      if (input.is_recurring !== undefined) patch.is_recurring = input.is_recurring;
      const { data, error } = await sb.from("budgets").update(patch).eq("id", existing.id).select().single();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [
          {
            type: "text",
            text: `Orçamento atualizado: ${categoryName} em ${input.month} = ${input.allocated_amount}`,
          },
        ],
        structuredContent: { budget: data, action: "updated" },
      };
    }

    const { data, error } = await sb
      .from("budgets")
      .insert({
        user_id: ctx.getUserId(),
        category: categoryName ?? "",
        category_id: categoryId,
        month_year: monthStart,
        allocated_amount: input.allocated_amount,
        is_recurring: input.is_recurring ?? false,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: `Orçamento criado: ${categoryName} em ${input.month} = ${input.allocated_amount}`,
        },
      ],
      structuredContent: { budget: data, action: "created" },
    };
};

export default defineTool({
  name: "upsert_budget",
  title: "Criar ou editar orçamento",
  description:
    "Cria ou atualiza a meta de orçamento de uma categoria em um mês. Informe category_id (preferencial) ou o nome da categoria — use list_categories/list_budgets antes para descobrir os identificadores.",
  inputSchema: budgetFields,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: safeHandler("upsert_budget", (input: any, ctx) => runUpsertBudget(input, ctx)),
});
