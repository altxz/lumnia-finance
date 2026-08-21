import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { budgetFields, runUpsertBudget } from "./upsert-budget";

export default defineTool({
  name: "create_budget",
  title: "Criar orçamento",
  description:
    "Cria a meta de orçamento (valor planejado) de uma categoria em um mês na página de Orçamento. Se já existir meta para a categoria no mês, o valor é atualizado.",
  inputSchema: budgetFields,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: safeHandler("create_budget", (input: any, ctx) => runUpsertBudget(input, ctx)),
});
