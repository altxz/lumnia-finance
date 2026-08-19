import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveWallet } from "../resolve";

export default defineTool({
  name: "create_transfer",
  title: "Transferir entre carteiras",
  description:
    "Registra uma transferência de dinheiro entre duas contas/carteiras do usuário (sai de uma e entra na outra). Use list_wallets para ver os nomes disponíveis.",
  inputSchema: {
    from_wallet: z.string().optional().describe("Nome da carteira de origem."),
    from_wallet_id: z.string().uuid().optional().describe("ID da carteira de origem."),
    to_wallet: z.string().optional().describe("Nome da carteira de destino."),
    to_wallet_id: z.string().uuid().optional().describe("ID da carteira de destino."),
    value: z.number().positive().describe("Valor transferido em BRL."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data ISO YYYY-MM-DD."),
    description: z.string().optional().describe("Descrição. Padrão: 'Transferência <origem> → <destino>'."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("create_transfer", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      const from = await resolveWallet(sb, { id: input.from_wallet_id, name: input.from_wallet });
      const to = await resolveWallet(sb, { id: input.to_wallet_id, name: input.to_wallet });
      if (!from || !to) return fail("Informe a carteira de origem e a de destino.");
      if (from.id === to.id) return fail("Origem e destino precisam ser carteiras diferentes.");

      const { data, error } = await sb
        .from("expenses")
        .insert({
          user_id: ctx.getUserId(),
          date: input.date,
          description: input.description ?? `Transferência ${from.name} → ${to.name}`,
          value: input.value,
          type: "transfer",
          final_category: "transferencia",
          category_ai: "transferencia",
          wallet_id: from.id,
          destination_wallet_id: to.id,
          is_paid: true,
          is_recurring: false,
          installments: 1,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok(
        `Transferência registrada: R$ ${input.value.toFixed(2)} de ${from.name} para ${to.name} em ${input.date}.`,
        { transfer: data },
      );
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
