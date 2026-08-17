import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabaseClient";

export default defineTool({
  name: "delete_transaction",
  title: "Excluir transação",
  description:
    "Exclui uma transação (despesa ou receita) do usuário autenticado pelo id. Para parcelamentos, use scope='group' para remover todas as parcelas do mesmo grupo. Ação irreversível: confirme com o usuário antes de chamar.",
  inputSchema: {
    id: z.string().uuid().describe("ID da transação a excluir."),
    scope: z
      .enum(["single", "group"])
      .optional()
      .describe(
        "'single' (padrão) remove apenas esta transação; 'group' remove todas as parcelas do mesmo installment_group_id.",
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  handler: safeHandler("delete_transaction", async ({ id, scope }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }

    try {
      const sb = supabaseForUser(ctx);
      const userId = ctx.getUserId();

      const { data: target, error: findError } = await sb
        .from("expenses")
        .select("id,date,description,value,type,installment_group_id,is_recurring")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (findError) return toolError("Falha ao localizar a transação", findError);
      if (!target) {
        return {
          content: [{ type: "text", text: "Transação não encontrada para este usuário." }],
          isError: true,
        };
      }

      const deleteGroup = scope === "group" && !!target.installment_group_id;

      const query = sb.from("expenses").delete().eq("user_id", userId);
      const { data: deleted, error: deleteError } = deleteGroup
        ? await query.eq("installment_group_id", target.installment_group_id!).select("id")
        : await query.eq("id", id).select("id");

      if (deleteError) return toolError("Falha ao excluir a transação", deleteError);

      const count = deleted?.length ?? 0;
      return {
        content: [
          {
            type: "text",
            text: `Excluída(s) ${count} transação(ões): "${target.description}" (${target.date}).`,
          },
        ],
        structuredContent: {
          deleted_count: count,
          deleted_ids: (deleted ?? []).map((d) => d.id),
          scope: deleteGroup ? "group" : "single",
          transaction: target,
        },
      };
    } catch (error) {
      return toolError("Erro de conexão com o banco de dados", error);
    }
  }),
});
