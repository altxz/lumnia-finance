import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveProject } from "../resolve";

export default defineTool({
  name: "manage_project",
  title: "Projetos (centros de custo)",
  description:
    "Lista, cria ou edita projetos usados como centros de custo (ex: Reforma, Viagem), com orçamento total opcional e gasto acumulado.",
  inputSchema: {
    action: z.enum(["list", "create", "update"]).describe("list, create ou update."),
    project: z.string().optional().describe("Nome do projeto a editar."),
    project_id: z.string().uuid().optional().describe("ID do projeto a editar."),
    name: z.string().optional().describe("Nome (obrigatório em create)."),
    budget: z.number().optional().describe("Orçamento total do projeto em BRL."),
    color: z.string().optional().describe("Cor em hex. Padrão: #6366f1."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("manage_project", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      if (input.action === "list") {
        const { data, error } = await sb.from("projects").select("*").order("created_at");
        if (error) return fail(error.message);
        const projects = (data ?? []) as any[];
        if (projects.length === 0) return ok("Nenhum projeto cadastrado.", { projects: [] });

        const { data: expenses, error: expError } = await sb
          .from("expenses")
          .select("project_id,value,type")
          .not("project_id", "is", null);
        if (expError) return fail(expError.message);

        const spentByProject = new Map<string, number>();
        for (const row of (expenses ?? []) as any[]) {
          if (row.type !== "expense") continue;
          spentByProject.set(row.project_id, (spentByProject.get(row.project_id) ?? 0) + Number(row.value));
        }

        const result = projects.map((p) => ({
          id: p.id,
          name: p.name,
          budget: p.budget === null ? null : Number(p.budget),
          color: p.color,
          spent: Number((spentByProject.get(p.id) ?? 0).toFixed(2)),
        }));
        const summary = result
          .map(
            (p) =>
              `${p.name}: gasto R$ ${p.spent.toFixed(2)}${
                p.budget !== null ? ` de R$ ${p.budget.toFixed(2)}` : " (sem orçamento definido)"
              }`,
          )
          .join("\n");
        return ok(summary, { projects: result });
      }

      if (input.action === "create") {
        if (!input.name) return fail("Informe o nome do projeto.");
        const { data, error } = await sb
          .from("projects")
          .insert({
            user_id: ctx.getUserId(),
            name: input.name,
            budget: input.budget ?? null,
            color: input.color ?? "#6366f1",
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok(`Projeto "${data.name}" criado.`, { project: data });
      }

      const target = await resolveProject(sb, { id: input.project_id, name: input.project });
      if (!target) return fail("Informe project ou project_id do projeto a editar.");
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.budget !== undefined) patch.budget = input.budget;
      if (input.color !== undefined) patch.color = input.color;
      if (Object.keys(patch).length === 0) return fail("Nenhum campo para atualizar.");

      const { data, error } = await sb.from("projects").update(patch).eq("id", target.id).select().single();
      if (error) return fail(error.message);
      return ok(`Projeto "${data.name}" atualizado.`, { project: data });
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
