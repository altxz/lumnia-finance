import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveCategory } from "../resolve";

export default defineTool({
  name: "manage_category",
  title: "Criar, renomear ou desativar categoria",
  description:
    "Cria uma categoria ou subcategoria (informe parent para vincular à categoria-mãe), renomeia, ou ativa/desativa uma existente. Use list_categories para ver a hierarquia atual.",
  inputSchema: {
    action: z.enum(["create", "update"]).describe("create ou update."),
    category: z.string().optional().describe("Nome da categoria a editar."),
    category_id: z.string().uuid().optional().describe("ID da categoria a editar."),
    name: z.string().optional().describe("Nome (novo nome em update, obrigatório em create)."),
    parent: z.string().optional().describe("Nome da categoria-mãe (cria uma subcategoria)."),
    parent_id: z.string().uuid().optional().describe("ID da categoria-mãe."),
    icon: z.string().optional().describe("Emoji/ícone. Padrão: 📦."),
    color: z.string().optional().describe("Cor em hex. Padrão: #94a3b8."),
    active: z.boolean().optional().describe("false desativa a categoria."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("manage_category", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      const parent =
        input.parent || input.parent_id
          ? await resolveCategory(sb, { id: input.parent_id, name: input.parent })
          : null;

      if (input.action === "create") {
        if (!input.name) return fail("Informe o nome da categoria.");
        const { data, error } = await sb
          .from("categories")
          .insert({
            user_id: ctx.getUserId(),
            name: input.name,
            parent_id: parent?.id ?? null,
            icon: input.icon ?? "📦",
            color: input.color ?? "#94a3b8",
            active: input.active ?? true,
            sort_order: 999,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok(
          `Categoria "${data.name}" criada${parent ? ` como subcategoria de "${parent.name}"` : ""}.`,
          { category: data },
        );
      }

      const target = await resolveCategory(sb, { id: input.category_id, name: input.category });
      if (!target) return fail("Informe category ou category_id da categoria a editar.");
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.icon !== undefined) patch.icon = input.icon;
      if (input.color !== undefined) patch.color = input.color;
      if (input.active !== undefined) patch.active = input.active;
      if (input.parent || input.parent_id) patch.parent_id = parent?.id ?? null;
      if (Object.keys(patch).length === 0) return fail("Nenhum campo para atualizar.");

      const { data, error } = await sb.from("categories").update(patch).eq("id", target.id).select().single();
      if (error) return fail(error.message);
      return ok(`Categoria "${data.name}" atualizada${data.active ? "" : " (desativada)"}.`, { category: data });
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
