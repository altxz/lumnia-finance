import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveWallet } from "../resolve";

export default defineTool({
  name: "set_transaction_paid",
  title: "Marcar como pago / desfazer",
  description:
    "Marca uma transação como paga/recebida ou reverte o pagamento. Opcionalmente ajusta a data efetiva e a conta/carteira usada no pagamento.",
  inputSchema: {
    id: z.string().uuid().describe("ID da transação."),
    is_paid: z.boolean().describe("true = pago/recebido, false = desfazer o pagamento."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data efetiva do pagamento (opcional)."),
    wallet: z.string().optional().describe("Nome da conta/carteira usada."),
    wallet_id: z.string().uuid().optional().describe("ID da conta/carteira usada."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: safeHandler("set_transaction_paid", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      const wallet = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      const patch: Record<string, unknown> = { is_paid: input.is_paid };
      if (input.date) patch.date = input.date;
      if (wallet) patch.wallet_id = wallet.id;

      const { data, error } = await sb.from("expenses").update(patch).eq("id", input.id).select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Transação não encontrada para esta conta.");
      return ok(
        `${data.description}: ${input.is_paid ? "marcada como paga/recebida" : "pagamento desfeito"} (${data.date}).`,
        { transaction: data },
      );
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
