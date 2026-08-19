import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveWallet } from "../resolve";

export default defineTool({
  name: "manage_wallet",
  title: "Criar ou editar carteira",
  description:
    "Cria uma nova conta/carteira ou edita uma existente (nome, saldo inicial, moeda e tipo). Para editar, informe wallet ou wallet_id.",
  inputSchema: {
    action: z.enum(["create", "update"]).describe("create para nova carteira, update para editar."),
    wallet: z.string().optional().describe("Nome da carteira a editar."),
    wallet_id: z.string().uuid().optional().describe("ID da carteira a editar."),
    name: z.string().optional().describe("Nome (obrigatório em create)."),
    initial_balance: z.number().optional().describe("Saldo inicial em BRL."),
    currency: z.string().optional().describe("Moeda (ex: BRL, USD). Padrão: BRL."),
    asset_type: z
      .enum(["cash", "bank", "investment", "crypto", "other"])
      .optional()
      .describe("Tipo do ativo. Padrão: bank."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("manage_wallet", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      if (input.action === "create") {
        if (!input.name) return fail("Informe o nome da carteira.");
        const initial = input.initial_balance ?? 0;
        const { data, error } = await sb
          .from("wallets")
          .insert({
            user_id: ctx.getUserId(),
            name: input.name,
            asset_type: input.asset_type ?? "bank",
            currency: input.currency ?? "BRL",
            initial_balance: initial,
            current_balance: initial,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok(`Carteira "${data.name}" criada com saldo inicial de R$ ${Number(initial).toFixed(2)}.`, {
          wallet: data,
        });
      }

      const target = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      if (!target) return fail("Informe wallet ou wallet_id da carteira a editar.");
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.initial_balance !== undefined) patch.initial_balance = input.initial_balance;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.asset_type !== undefined) patch.asset_type = input.asset_type;
      if (Object.keys(patch).length === 0) return fail("Nenhum campo para atualizar.");

      const { data, error } = await sb.from("wallets").update(patch).eq("id", target.id).select().single();
      if (error) return fail(error.message);
      return ok(`Carteira "${data.name}" atualizada.`, { wallet: data });
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
