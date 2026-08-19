import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ResolveError, fail, ok, resolveCreditCard } from "../resolve";
import { getInvoicePeriod, matchExpensesToInvoice } from "../../invoiceHelpers";

export default defineTool({
  name: "invoice_details",
  title: "Detalhe da fatura do cartão",
  description:
    "Mostra a fatura de um cartão de crédito num mês de vencimento (YYYY-MM): total, status (aberta/fechada/vencida/paga), período, data de vencimento e as compras que a compõem.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês de vencimento da fatura (YYYY-MM)."),
    credit_card: z.string().optional().describe("Nome do cartão. Se omitido, retorna todos os cartões."),
    credit_card_id: z.string().uuid().optional().describe("ID do cartão."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("invoice_details", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    try {
      let cards: any[];
      if (input.credit_card || input.credit_card_id) {
        const card = await resolveCreditCard(sb, { id: input.credit_card_id, name: input.credit_card });
        cards = [card];
      } else {
        const { data, error } = await sb.from("credit_cards").select("*");
        if (error) return fail(error.message);
        cards = (data ?? []) as any[];
      }
      if (cards.length === 0) return fail("Nenhum cartão de crédito cadastrado.");

      const { data: expenses, error: expError } = await sb
        .from("expenses")
        .select("id,date,description,value,type,final_category,credit_card_id,wallet_id,invoice_month,is_paid");
      if (expError) return fail(expError.message);
      const rows = (expenses ?? []) as any[];

      const [year, monthNumber] = input.month.split("-").map(Number);
      const invoices = cards.map((card) => {
        const period = getInvoicePeriod(card as any, year, monthNumber - 1);
        const invoice = matchExpensesToInvoice(rows as any, period);
        return {
          card: card.name,
          card_id: card.id,
          month: input.month,
          status: invoice.status,
          total: Number(invoice.total.toFixed(2)),
          limit: Number(card.limit_amount),
          period_start: invoice.periodStart.toISOString().slice(0, 10),
          period_end: invoice.periodEnd.toISOString().slice(0, 10),
          due_date: invoice.dueDate.toISOString().slice(0, 10),
          transactions: invoice.transactions.map((t: any) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            value: Number(t.value),
            category: t.final_category,
          })),
        };
      });

      const summary = invoices
        .map((i) => `${i.card} (${i.month}): R$ ${i.total.toFixed(2)} — ${i.status}, vence ${i.due_date}`)
        .join("\n");
      return ok(summary, { invoices });
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
