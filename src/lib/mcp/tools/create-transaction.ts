import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import {
  ResolveError,
  defaultWalletId,
  fail,
  ok,
  resolveCategory,
  resolveCreditCard,
  resolveProject,
  resolveWallet,
} from "../resolve";
import { getPaymentDate } from "../../invoiceHelpers";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

export default defineTool({
  name: "create_transaction",
  title: "Criar transação",
  description:
    "Cria uma despesa ou receita. Aceita conta/carteira (nome ou id), cartão de crédito, forma de pagamento, recorrência fixa mensal/anual, parcelamento, projeto, tags e observação. Sem carteira informada, usa a carteira padrão do usuário. Para despesas no cartão, o mês da fatura é calculado automaticamente pelo fechamento do cartão.",
  inputSchema: {
    description: z.string().min(1).describe("Descrição curta da transação."),
    value: z.number().positive().describe("Valor absoluto (positivo) em BRL. Em parcelamentos, é o valor total."),
    date: dateSchema.describe("Data ISO YYYY-MM-DD."),
    type: z.enum(["expense", "income"]).describe("expense = despesa, income = receita."),
    category: z.string().optional().describe("Nome da categoria."),
    category_id: z.string().uuid().optional().describe("ID da categoria (preferencial)."),
    wallet: z.string().optional().describe("Nome da conta/carteira."),
    wallet_id: z.string().uuid().optional().describe("ID da conta/carteira."),
    credit_card: z.string().optional().describe("Nome do cartão de crédito (para compras no crédito)."),
    credit_card_id: z.string().uuid().optional().describe("ID do cartão de crédito."),
    invoice_month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Mês da fatura (YYYY-MM). Se omitido, é calculado pelo fechamento do cartão."),
    payment_method: z.string().optional().describe("Forma de pagamento (ex: pix, debito, credito, dinheiro)."),
    is_paid: z.boolean().optional().describe("Se já foi pago/recebido. Padrão: true."),
    is_recurring: z.boolean().optional().describe("Despesa/receita fixa que se repete."),
    frequency: z.enum(["monthly", "yearly"]).optional().describe("Frequência da recorrência. Padrão: monthly."),
    installments: z
      .number()
      .int()
      .min(1)
      .max(360)
      .optional()
      .describe("Número de parcelas. Acima de 1, cria uma parcela por mês dividindo o valor total."),
    project: z.string().optional().describe("Nome do projeto/centro de custo."),
    project_id: z.string().uuid().optional().describe("ID do projeto."),
    tags: z.array(z.string()).optional().describe("Etiquetas livres."),
    notes: z.string().optional().describe("Observações."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: safeHandler("create_transaction", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    try {
      const card = await resolveCreditCard(sb, { id: input.credit_card_id, name: input.credit_card });
      const project = await resolveProject(sb, { id: input.project_id, name: input.project });
      const category = await resolveCategory(sb, { id: input.category_id, name: input.category });

      let wallet = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      let walletId: string | null = wallet?.id ?? null;
      if (!card && !walletId) walletId = await defaultWalletId(sb);

      const categoryName = category?.name ?? input.category ?? "outros";
      const installments = input.installments ?? 1;
      const frequency = input.is_recurring ? input.frequency ?? "monthly" : null;

      let invoiceMonth: string | null = input.invoice_month ?? null;
      if (card && !invoiceMonth) {
        const due = getPaymentDate(input.date, card as any);
        invoiceMonth = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
      }

      const base = {
        user_id: userId,
        description: input.description,
        type: input.type,
        final_category: categoryName,
        category_ai: categoryName,
        wallet_id: card ? walletId : walletId,
        credit_card_id: card?.id ?? null,
        invoice_month: invoiceMonth,
        payment_method: input.payment_method ?? (card ? "credito" : null),
        is_paid: input.is_paid ?? true,
        is_recurring: !!input.is_recurring,
        frequency,
        project_id: project?.id ?? null,
        tags: input.tags ?? null,
        notes: input.notes ?? null,
      };

      // Parcelamento: uma linha por parcela, valor total dividido.
      if (installments > 1) {
        const groupId = crypto.randomUUID();
        const perInstallment = Math.round((input.value / installments) * 100) / 100;
        const start = new Date(`${input.date}T12:00:00`);
        const rows = Array.from({ length: installments }, (_, i) => {
          const d = new Date(start);
          d.setMonth(d.getMonth() + i);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          let rowInvoice = invoiceMonth;
          if (card) {
            const due = getPaymentDate(iso, card as any);
            rowInvoice = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
          }
          return {
            ...base,
            date: iso,
            value: perInstallment,
            installments,
            installment_group_id: groupId,
            installment_info: `${i + 1}/${installments}`,
            invoice_month: rowInvoice,
            is_paid: i === 0 ? base.is_paid : false,
            is_recurring: false,
            frequency: null,
          };
        });
        const { data, error } = await sb.from("expenses").insert(rows).select("id,date,value");
        if (error) return fail(error.message);
        return ok(
          `Criadas ${installments} parcelas de R$ ${perInstallment.toFixed(2)} para "${input.description}".`,
          { installments: data, installment_group_id: groupId },
        );
      }

      const { data, error } = await sb
        .from("expenses")
        .insert({ ...base, date: input.date, value: input.value, installments: 1 })
        .select()
        .single();
      if (error) return fail(error.message);
      return ok(
        `Criada: ${input.description} — R$ ${input.value.toFixed(2)} em ${input.date}${card ? ` (cartão ${card.name}, fatura ${invoiceMonth})` : ""}. ID ${data.id}`,
        { transaction: data },
      );
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
