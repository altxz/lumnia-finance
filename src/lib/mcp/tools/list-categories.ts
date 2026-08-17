import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { supabaseForUser } from "../supabaseClient";

export default defineTool({
  name: "list_categories",
  title: "Listar categorias",
  description: "Lista todas as categorias e subcategorias do usuário autenticado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("list_categories", async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("categories")
      .select("id,name,icon,color,parent_id,active,sort_order")
      .order("sort_order");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { categories: data ?? [] },
    };
  }),
});
