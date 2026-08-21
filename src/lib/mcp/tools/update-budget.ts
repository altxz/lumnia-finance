import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { budgetFields, runUpsertBudget } from "./upsert-budget";

export default defineTool({
  name: "update_budget",
  title: "Editar orçamento",
  description:
    "Altera o valor planejado (e a recorrência) da meta de orçamento de uma categoria em um mês. Se ainda não existir meta, ela é criada.",
  inputSchema: budgetFields,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: safeHandler("update_budget", (input: any, ctx) => runUpsertBudget(input, ctx)),
});
