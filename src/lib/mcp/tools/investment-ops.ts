import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, defaultWalletId, fail, ok, resolveWallet } from "../resolve";
import { computeStats, investmentTypeLabel, rateLabel } from "../../investmentMath";

async function resolveInvestment(sb: any, opts: { id?: string; name?: string }) {
  if (opts.id) {
    const { data, error } = await sb.from("investments").select("*").eq("id", opts.id).maybeSingle();
    if (error) throw new ResolveError(error.message);
    if (!data) throw new ResolveError("Investimento não encontrado para esta conta.");
    return data;
  }
  if (!opts.name) return null;
  const { data, error } = await sb.from("investments").select("*");
  if (error) throw new ResolveError(error.message);
  const rows = (data ?? []) as any[];
  const target = opts.name.trim().toLowerCase();
  let matches = rows.filter((r) => String(r.name).trim().toLowerCase() === target);
  if (matches.length === 0) matches = rows.filter((r) => String(r.name).toLowerCase().includes(target));
  if (matches.length === 0)
    throw new ResolveError(
      `Não encontrei o investimento "${opts.name}". Opções: ${rows.map((r) => r.name).join(", ") || "nenhuma"}.`,
    );
  if (matches.length > 1)
    throw new ResolveError(
      `Mais de um investimento com esse nome. Informe o id: ${matches.map((m) => `${m.name} (${m.id})`).join(", ")}.`,
    );
  return matches[0];
}

export default defineTool({
  name: "investments",
  title: "Investimentos (caixinhas)",
  description:
    "Lista os investimentos do usuário com valor atual, rendimento e projeção até o vencimento, ou registra um aporte (deposit) ou resgate (withdraw) — que movimenta o dinheiro entre a carteira e o investimento, igual ao app.",
  inputSchema: {
    action: z.enum(["list", "deposit", "withdraw"]).describe("list, deposit (aporte) ou withdraw (resgate)."),
    investment: z.string().optional().describe("Nome do investimento (para deposit/withdraw)."),
    investment_id: z.string().uuid().optional().describe("ID do investimento."),
    value: z.number().positive().optional().describe("Valor do aporte/resgate em BRL."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data da movimentação (YYYY-MM-DD). Padrão: hoje."),
    wallet: z.string().optional().describe("Carteira de origem (aporte) ou destino (resgate)."),
    wallet_id: z.string().uuid().optional().describe("ID da carteira."),
    close_investment: z
      .boolean()
      .optional()
      .describe("No resgate, true marca o investimento como resgatado/encerrado."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("investments", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      const { data: investments, error: invError } = await sb.from("investments").select("*").order("created_at");
      if (invError) return fail(invError.message);
      const { data: movements, error: movError } = await sb.from("investment_movements").select("*");
      if (movError) return fail(movError.message);
      const allMovements = (movements ?? []) as any[];

      if (input.action === "list") {
        const rows = (investments ?? []) as any[];
        if (rows.length === 0) return ok("Nenhum investimento cadastrado.", { investments: [] });
        const result = rows.map((inv) => {
          const stats = computeStats(
            inv as any,
            allMovements.filter((m) => m.investment_id === inv.id) as any,
          );
          return {
            id: inv.id,
            name: inv.name,
            type: investmentTypeLabel(inv.investment_type),
            rate: rateLabel(inv as any),
            status: inv.status,
            start_date: inv.start_date,
            maturity_date: inv.maturity_date,
            invested: Number(stats.invested.toFixed(2)),
            current_value: Number(stats.currentValue.toFixed(2)),
            earnings: Number(stats.earnings.toFixed(2)),
            earnings_pct: Number(stats.earningsPct.toFixed(2)),
            projected_value: Number(stats.projectedValue.toFixed(2)),
            days_remaining: stats.daysRemaining,
            annual_rate_pct: Number(stats.annualRate.toFixed(2)),
          };
        });
        const total = result.reduce((s, r) => s + r.current_value, 0);
        const summary = [
          `Total investido (valor atual): R$ ${total.toFixed(2)}`,
          ...result.map(
            (r) =>
              `${r.name} (${r.type}, ${r.rate}) — atual R$ ${r.current_value.toFixed(2)}, rendimento R$ ${r.earnings.toFixed(
                2,
              )} (${r.earnings_pct.toFixed(2)}%), status ${r.status}`,
          ),
        ].join("\n");
        return ok(summary, { investments: result, total_current_value: Number(total.toFixed(2)) });
      }

      const inv = await resolveInvestment(sb, { id: input.investment_id, name: input.investment });
      if (!inv) return fail("Informe investment ou investment_id.");
      if (!input.value) return fail("Informe o valor da movimentação.");
      if (!inv.investment_wallet_id) return fail("Este investimento não tem carteira de investimento vinculada.");

      const isDeposit = input.action === "deposit";
      const wallet = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      const cashWalletId = wallet?.id ?? inv.wallet_id ?? (await defaultWalletId(sb));
      if (!cashWalletId) return fail("Nenhuma carteira disponível para a movimentação.");

      const date = input.date ?? new Date().toISOString().slice(0, 10);
      const { data: expense, error: expError } = await sb
        .from("expenses")
        .insert({
          user_id: ctx.getUserId(),
          date,
          description: isDeposit ? `Aporte em ${inv.name}` : `Resgate de ${inv.name}`,
          value: input.value,
          type: "transfer",
          final_category: "investimentos",
          category_ai: "investimentos",
          wallet_id: isDeposit ? cashWalletId : inv.investment_wallet_id,
          destination_wallet_id: isDeposit ? inv.investment_wallet_id : cashWalletId,
          is_paid: true,
          installments: 1,
          is_recurring: false,
        })
        .select("id")
        .single();
      if (expError) return fail(expError.message);

      const { error: movInsertError } = await sb.from("investment_movements").insert({
        user_id: ctx.getUserId(),
        investment_id: inv.id,
        kind: isDeposit ? "deposit" : "withdraw",
        amount: input.value,
        date,
        expense_id: expense.id,
      });
      if (movInsertError) {
        await sb.from("expenses").delete().eq("id", expense.id);
        return fail(movInsertError.message);
      }

      if (!isDeposit && input.close_investment) {
        await sb.from("investments").update({ status: "redeemed" }).eq("id", inv.id);
      }

      return ok(
        `${isDeposit ? "Aporte" : "Resgate"} de R$ ${input.value.toFixed(2)} em "${inv.name}" registrado em ${date}.`,
        { investment_id: inv.id, expense_id: expense.id },
      );
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
