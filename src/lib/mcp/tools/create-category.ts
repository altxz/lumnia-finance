import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { safeHandler } from "../safeHandler";
import { categoryFields, runManageCategory } from "./manage-category";

export default defineTool({
  name: "create_category",
  title: "Criar categoria",
  description:
    "Cria uma nova categoria ou subcategoria na página de Categorias. Informe name e, para subcategoria, parent (nome da categoria-mãe) ou parent_id.",
  inputSchema: {
    name: z.string().describe("Nome da nova categoria."),
    parent: categoryFields.parent,
    parent_id: categoryFields.parent_id,
    icon: categoryFields.icon,
    color: categoryFields.color,
    active: categoryFields.active,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("create_category", (input: any, ctx) =>
    runManageCategory({ ...input, action: "create" }, ctx),
  ),
});
