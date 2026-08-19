import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, defaultWalletId, fail, ok, resolveCreditCard, resolveWallet } from "../resolve";
import { getInvoicePeriod, matchExpensesToInvoice } from "../../invoiceHelpers";

export default defineTool({
  name: "pay_invoice",
  title: "Pagar fatura do cartão",
  description:
    "Registra o pagamento da fatura de um cartão num mês de vencimento (YYYY-MM), debitando de uma conta/carteira, ou desfaz o pagamento (action='unpay'). Usa a mesma lógica do app para não contar duas vezes a fatura e o pagamento.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês de vencimento da fatura (YYYY-MM)."),
    credit_card: z.string().optional().describe("Nome do cartão."),
    credit_card_id: z.string().uuid().optional().describe("ID do cartão."),
    action: z.enum(["pay", "unpay"]).optional().describe("pay (padrão) ou unpay para desfazer."),
    wallet: z.string().optional().describe("Nome da conta que paga a fatura."),
    wallet_id: z.string().uuid().optional().describe("ID da conta que paga a fatura."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data do pagamento. Padrão: data de vencimento da fatura."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  handler: safeHandler("pay_invoice", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const action = input.action ?? "pay";
    try {
      const card = await resolveCreditCard(sb, { id: input.credit_card_id, name: input.credit_card });
      if (!card) return fail("Informe o cartão (credit_card ou credit_card_id).");

      if (action === "unpay") {
        const { data, error } = await sb
          .from("expenses")
          .delete()
          .eq("invoice_month", input.month)
          .eq("credit_card_id", card.id)
          .ilike("description", "Pagamento fatura%")
          .not("wallet_id", "is", null)
          .select("id");
        if (error) return fail(error.message);
        if (!data || data.length === 0)
          return fail(`Não encontrei um pagamento registrado para a fatura de ${card.name} em ${input.month}.`);
        return ok(`Pagamento da fatura ${card.name} (${input.month}) desfeito.`, { removed: data.length });
      }

      const { data: expenses, error: expError } = await sb
        .from("expenses")
        .select("id,date,description,value,type,final_category,credit_card_id,wallet_id,invoice_month,is_paid");
      if (expError) return fail(expError.message);

      const [year, monthNumber] = input.month.split("-").map(Number);
      const period = getInvoicePeriod(card as any, year, monthNumber - 1);
      const invoice = matchExpensesToInvoice((expenses ?? []) as any, period);

      if (invoice.status === "paid") return fail(`A fatura de ${card.name} em ${input.month} já está paga.`);
      if (invoice.total <= 0) return fail(`A fatura de ${card.name} em ${input.month} não tem valor a pagar.`);

      const wallet = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      const walletId = wallet?.id ?? (await defaultWalletId(sb));
      if (!walletId) return fail("Nenhuma conta/carteira disponível para debitar o pagamento.");

      const due = invoice.dueDate;
      const dateStr =
        input.date ??
        `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;

      const { data, error } = await sb
        .from("expenses")
        .insert({
          user_id: ctx.getUserId(),
          description: `Pagamento fatura ${card.name} - ${input.month}`,
          value: invoice.total,
          final_category: "cartao",
          category_ai: "cartao",
          type: "expense",
          date: dateStr,
          wallet_id: walletId,
          credit_card_id: card.id,
          is_paid: true,
          is_recurring: false,
          installments: 1,
          invoice_month: input.month,
        })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok(
        `Fatura ${card.name} (${input.month}) paga: R$ ${invoice.total.toFixed(2)} em ${dateStr}.`,
        { payment: data, invoice_total: invoice.total },
      );
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
