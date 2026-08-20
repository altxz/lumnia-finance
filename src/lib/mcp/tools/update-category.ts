import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { categoryFields, runManageCategory } from "./manage-category";

export default defineTool({
  name: "update_category",
  title: "Editar categoria",
  description:
    "Edita uma categoria existente: renomeia, muda ícone/cor, move para outra categoria-mãe (parent/parent_id) ou arquiva/desarquiva com active. Identifique pelo nome (category) ou id (category_id).",
  inputSchema: {
    category: categoryFields.category,
    category_id: categoryFields.category_id,
    name: categoryFields.name,
    parent: categoryFields.parent,
    parent_id: categoryFields.parent_id,
    icon: categoryFields.icon,
    color: categoryFields.color,
    active: categoryFields.active,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("update_category", (input: any, ctx) =>
    runManageCategory({ ...input, action: "update" }, ctx),
  ),
});
