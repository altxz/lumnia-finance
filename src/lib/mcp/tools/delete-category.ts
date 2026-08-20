import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { categoryFields, runManageCategory } from "./manage-category";

export default defineTool({
  name: "delete_category",
  title: "Excluir categoria",
  description:
    "Exclui definitivamente uma categoria (ou subcategoria). Se ela tiver subcategorias, é necessário repetir com delete_children: true. Confirme com o usuário antes de excluir.",
  inputSchema: {
    category: categoryFields.category,
    category_id: categoryFields.category_id,
    delete_children: categoryFields.delete_children,
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  handler: safeHandler("delete_category", (input: any, ctx) =>
    runManageCategory({ ...input, action: "delete" }, ctx),
  ),
});
