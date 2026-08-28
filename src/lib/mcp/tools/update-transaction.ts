import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import {
  ResolveError,
  fail,
  ok,
  resolveCategory,
  resolveCreditCard,
  resolveProject,
  resolveWallet,
} from "../resolve";
import { getPaymentDate } from "../../invoiceHelpers";
import { buildFutureRecurringExceptionDates } from "../../recurringProjection";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

export default defineTool({
  name: "update_transaction",
  title: "Editar transação",
  description:
    "Edita uma transação existente pelo id: descrição, valor, data, categoria, conta/carteira, cartão, pago/não pago, recorrência, projeto, tags e observação. Em séries recorrentes ou parceladas use scope: 'single' (apenas esta ocorrência), 'future' (esta e as próximas, preservando o histórico) ou 'all' (toda a série). Confirme com o usuário antes de aplicar em série.",
  inputSchema: {
    id: z.string().uuid().describe("ID da transação (use search/list_transactions para descobrir)."),
    scope: z
      .enum(["single", "future", "all"])
      .optional()
      .describe("Escopo em séries recorrentes/parceladas. Padrão: single."),
    description: z.string().min(1).optional(),
    value: z.number().positive().optional(),
    date: dateSchema.optional(),
    type: z.enum(["expense", "income"]).optional(),
    category: z.string().optional(),
    category_id: z.string().uuid().optional(),
    wallet: z.string().optional().describe("Nome da conta/carteira."),
    wallet_id: z.string().uuid().optional(),
    credit_card: z.string().optional(),
    credit_card_id: z.string().uuid().optional(),
    remove_credit_card: z.boolean().optional().describe("true para transformar em despesa no débito."),
    invoice_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    payment_method: z.string().optional(),
    is_paid: z.boolean().optional(),
    is_recurring: z.boolean().optional().describe("Ativa/desativa recorrência fixa."),
    frequency: z.enum(["monthly", "yearly"]).optional(),
    project: z.string().optional(),
    project_id: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  handler: safeHandler("update_transaction", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const scope: "single" | "future" | "all" = input.scope ?? "single";

    const { data: row, error: rowError } = await sb.from("expenses").select("*").eq("id", input.id).maybeSingle();
    if (rowError) return fail(rowError.message);
    if (!row) return fail("Transação não encontrada para esta conta.");

    try {
      const card = input.remove_credit_card
        ? null
        : await resolveCreditCard(sb, { id: input.credit_card_id, name: input.credit_card });
      const wallet = await resolveWallet(sb, { id: input.wallet_id, name: input.wallet });
      const project = await resolveProject(sb, { id: input.project_id, name: input.project });
      const category = await resolveCategory(sb, { id: input.category_id, name: input.category });

      const patch: Record<string, unknown> = {};
      if (input.description !== undefined) patch.description = input.description;
      if (input.value !== undefined) patch.value = input.value;
      if (input.date !== undefined) patch.date = input.date;
      if (input.type !== undefined) patch.type = input.type;
      if (category) {
        patch.final_category = category.name;
      } else if (input.category !== undefined) {
        patch.final_category = input.category;
      }
      if (wallet) patch.wallet_id = wallet.id;
      if (card) patch.credit_card_id = card.id;
      if (input.remove_credit_card) {
        patch.credit_card_id = null;
        patch.invoice_month = null;
      }
      if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
      if (input.is_paid !== undefined) patch.is_paid = input.is_paid;
      if (input.project !== undefined || input.project_id !== undefined) patch.project_id = project?.id ?? null;
      if (input.tags !== undefined) patch.tags = input.tags.length ? input.tags : null;
      if (input.notes !== undefined) patch.notes = input.notes || null;
      if (input.is_recurring !== undefined) {
        patch.is_recurring = input.is_recurring;
        patch.frequency = input.is_recurring ? input.frequency ?? row.frequency ?? "monthly" : null;
      } else if (input.frequency !== undefined) {
        patch.frequency = input.frequency;
      }

      const finalCardId = (patch.credit_card_id ?? row.credit_card_id) as string | null;
      if (input.invoice_month !== undefined) {
        patch.invoice_month = input.invoice_month;
      } else if (finalCardId && (input.date !== undefined || card)) {
        const cardData = card ?? (await resolveCreditCard(sb, { id: finalCardId }));
        const due = getPaymentDate((patch.date ?? row.date) as string, cardData as any);
        patch.invoice_month = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
      }

      if (Object.keys(patch).length === 0) return fail("Nenhum campo para atualizar foi informado.");

      const isInstallment = !!row.installment_group_id;

      // Parcelamento + escopo amplo: aplica a todas as parcelas do grupo.
      if (isInstallment && scope !== "single") {
        const shared = { ...patch };
        delete shared.date; // cada parcela mantém a sua data
        delete shared.invoice_month;
        const { data, error } = await sb
          .from("expenses")
          .update(shared)
          .eq("installment_group_id", row.installment_group_id)
          .select("id");
        if (error) return fail(error.message);
        return ok(`Atualizadas ${data?.length ?? 0} parcelas do grupo.`, { updated: data });
      }

      // Ocorrência única de uma recorrência: cria um lançamento avulso e
      // registra exceção para o motor não projetar a ocorrência original.
      if (row.is_recurring && scope === "single") {
        const occurrence = row.date;
        const { error: excError } = await sb
          .from("recurring_exceptions")
          .insert({ user_id: userId, template_id: row.id, occurrence_date: occurrence });
        if (excError && !`${excError.message}`.toLowerCase().includes("duplicate")) return fail(excError.message);

        const { data, error } = await sb
          .from("expenses")
          .insert({
            ...row,
            ...patch,
            id: undefined,
            created_at: undefined,
            is_recurring: false,
            frequency: null,
            date: (patch.date ?? occurrence) as string,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok("Alteração aplicada apenas nesta ocorrência.", { transaction: data });
      }

      // Recorrência + escopo amplo: split de série (histórico preservado).
      if (row.is_recurring && scope !== "single") {
        const newDate = (patch.date ?? row.date) as string;
        const cutoff = row.date < newDate ? row.date : newDate;
        const frequency = (patch.frequency ?? row.frequency ?? "monthly") as string;
        const exceptionDates = buildFutureRecurringExceptionDates(row.date, cutoff, frequency);
        if (exceptionDates.length > 0) {
          const { error: excError } = await sb
            .from("recurring_exceptions")
            .upsert(
              exceptionDates.map((occurrence_date: string) => ({
                user_id: userId,
                template_id: row.id,
                occurrence_date,
              })),
              { onConflict: "template_id,occurrence_date", ignoreDuplicates: true },
            );
          if (excError && !`${excError.message}`.toLowerCase().includes("duplicate")) return fail(excError.message);
        }

        const { error: deactivateError } = await sb
          .from("expenses")
          .update({ is_recurring: false, frequency: null })
          .eq("id", row.id);
        if (deactivateError) return fail(deactivateError.message);

        const { error: cleanupError } = await sb
          .from("expenses")
          .delete()
          .eq("user_id", userId)
          .eq("description", row.description)
          .eq("type", row.type)
          .eq("is_recurring", false)
          .eq("is_paid", false)
          .gte("date", cutoff);
        if (cleanupError) return fail(cleanupError.message);

        const { data, error } = await sb
          .from("expenses")
          .insert({
            ...row,
            ...patch,
            id: undefined,
            created_at: undefined,
            date: newDate,
            is_paid: false,
            is_recurring: true,
            frequency,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok("Recorrência atualizada a partir desta ocorrência (meses anteriores preservados).", {
          transaction: data,
        });
      }

      const { data, error } = await sb.from("expenses").update(patch).eq("id", row.id).select().single();
      if (error) return fail(error.message);
      return ok(`Transação atualizada: ${data.description} — R$ ${Number(data.value).toFixed(2)} em ${data.date}.`, {
        transaction: data,
      });
    } catch (error) {
      if (error instanceof ResolveError) return fail(error.message);
      throw error;
    }
  }),
});
