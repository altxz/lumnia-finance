import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveCategory } from "../resolve";

export default defineTool({
  name: "manage_category",
  title: "Criar, editar ou excluir categoria",
  description:
    "Gerencia as categorias da página de Categorias: cria (action 'create', informe parent para criar subcategoria), edita nome/ícone/cor/categoria-mãe e ativa ou desativa (action 'update'), e exclui definitivamente (action 'delete'). Use list_categories para ver a hierarquia atual. Confirme com o usuário antes de excluir.",
  inputSchema: {
    action: z.enum(["create", "update", "delete"]).describe("create, update ou delete."),
    category: z.string().optional().describe("Nome da categoria a editar ou excluir."),
    category_id: z.string().uuid().optional().describe("ID da categoria a editar ou excluir."),
    name: z.string().optional().describe("Nome (novo nome em update, obrigatório em create)."),
    parent: z.string().optional().describe("Nome da categoria-mãe (cria uma subcategoria)."),
    parent_id: z.string().uuid().optional().describe("ID da categoria-mãe."),
    icon: z.string().optional().describe("Emoji/ícone. Padrão: 📦."),
    color: z.string().optional().describe("Cor em hex. Padrão: #94a3b8."),
    active: z.boolean().optional().describe("false desativa a categoria."),
    delete_children: z
      .boolean()
      .optional()
      .describe("Em delete: true também exclui as subcategorias. Padrão false (bloqueia se houver subcategorias)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
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
