import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeDescription(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

interface CardSettings {
  closing_day: number;
  due_day: number;
  closing_strategy: string;
  closing_days_before_due: number;
}

function getClosingDay(card: CardSettings): number {
  if (card.closing_strategy === "relative") {
    let cd = card.due_day - card.closing_days_before_due;
    if (cd <= 0) cd += 30;
    return cd;
  }
  return card.closing_day;
}

function toMonthLabel(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function addMonthsToLabel(label: string, months: number): string {
  const [year, month] = label.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return toMonthLabel(Math.floor(index / 12), ((index % 12) + 12) % 12);
}

function monthsBetweenLabels(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty * 12 + (tm - 1)) - (fy * 12 + (fm - 1));
}

/**
 * Fatura (mês devido) em que uma compra feita em `purchaseDate` cairia,
 * dado o fechamento do cartão. Mesma regra usada no cliente
 * (src/lib/invoiceHelpers.ts getPaymentDate): compra após o fechamento
 * cai na fatura seguinte.
 */
function getPurchaseInvoiceLabel(purchaseDate: Date, card: CardSettings): string {
  const closingDay = getClosingDay(card);
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();
  const day = purchaseDate.getDate();

  let cycleYear = year;
  let cycleMonth = month;
  if (day > closingDay) {
    if (cycleMonth === 11) {
      cycleMonth = 0;
      cycleYear += 1;
    } else {
      cycleMonth += 1;
    }
  }

  const dueYear = cycleMonth === 11 ? cycleYear + 1 : cycleYear;
  const dueMonth = cycleMonth === 11 ? 0 : cycleMonth + 1;
  return toMonthLabel(dueYear, dueMonth);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Fetch all recurring expenses
    const { data: recurring, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("is_recurring", true)
      .neq("type", "transfer");

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    // Fetch all recurring exceptions in one shot — used to skip occurrences the
    // user explicitly removed/edited/quick-paid.
    const { data: exceptions } = await supabase
      .from("recurring_exceptions")
      .select("template_id, occurrence_date");

    const exceptionSet = new Set(
      (exceptions ?? []).map((e: any) => `${e.template_id}|${e.occurrence_date}`),
    );

    // Fetch credit cards once — needed to compute the correct invoice cycle
    // for card-linked recurring templates (their closing day can push a
    // purchase into an invoice due one or two months later).
    const { data: cardsData } = await supabase
      .from("credit_cards")
      .select("id, closing_day, due_day, closing_strategy, closing_days_before_due");
    const cardsById = new Map((cardsData ?? []).map((c: any) => [c.id, c as CardSettings]));

    let created = 0;
    let skipped = 0;

    for (const expense of recurring || []) {
      const freq = expense.frequency || "monthly";
      const originalDate = new Date(expense.date);
      const normalizedTarget = normalizeDescription(expense.description);

      // ─── Cartão de crédito: avança por FATURA (invoice_month), não por
      // data de compra — o fechamento do cartão pode empurrar a compra para
      // uma fatura um ou dois meses à frente da data do lançamento. ───
      if (expense.credit_card_id) {
        const card = cardsById.get(expense.credit_card_id);
        if (!card || !expense.invoice_month) {
          skipped++;
          continue;
        }

        // A fatura em que uma compra "hoje" (mesma regra de fechamento) cairia.
        const currentCycleLabel = getPurchaseInvoiceLabel(today, card);
        const diffFromOrigin = monthsBetweenLabels(expense.invoice_month, currentCycleLabel);

        if (diffFromOrigin <= 0) {
          skipped++;
          continue;
        }

        const step = freq === "yearly" || freq === "annual" ? 12 : freq === "weekly" ? 1 : 1;
        // Frequência semanal não se aplica a cartão; trata como mensal.
        const labelsToEnsure: string[] = [];
        for (let n = step; n <= diffFromOrigin; n += step) {
          if ((freq === "yearly" || freq === "annual") && n % 12 !== 0) continue;
          labelsToEnsure.push(addMonthsToLabel(expense.invoice_month, n));
        }

        if (labelsToEnsure.length === 0) {
          skipped++;
          continue;
        }

        const { data: existingForCard } = await supabase
          .from("expenses")
          .select("id, description, invoice_month")
          .eq("user_id", expense.user_id)
          .eq("credit_card_id", expense.credit_card_id)
          .eq("type", expense.type)
          .eq("is_recurring", false)
          .in("invoice_month", labelsToEnsure);

        const alreadyMaterializedLabels = new Set(
          (existingForCard ?? [])
            .filter((row: any) => normalizeDescription(row.description) === normalizedTarget)
            .map((row: any) => row.invoice_month),
        );

        for (const label of labelsToEnsure) {
          if (alreadyMaterializedLabels.has(label)) {
            skipped++;
            continue;
          }
          if (exceptionSet.has(`${expense.id}|${label}`)) {
            skipped++;
            continue;
          }

          // Data de lançamento aproximada: mesmo dia do molde, no mês de
          // compra que corresponde a essa fatura (2 meses antes do
          // vencimento quando o dia cai depois do fechamento, 1 mês antes
          // caso contrário).
          const [dueYear, dueMonth] = label.split("-").map(Number);
          const closingDay = getClosingDay(card);
          const purchaseOffset = originalDate.getDate() > closingDay ? 2 : 1;
          const purchaseIndex = dueYear * 12 + (dueMonth - 1) - purchaseOffset;
          const purchaseYear = Math.floor(purchaseIndex / 12);
          const purchaseMonth = ((purchaseIndex % 12) + 12) % 12;
          const lastDay = new Date(purchaseYear, purchaseMonth + 1, 0).getDate();
          const day = Math.min(originalDate.getDate(), lastDay);
          const purchaseDateStr = `${purchaseYear}-${String(purchaseMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          const newExpense = {
            user_id: expense.user_id,
            description: expense.description,
            value: expense.value,
            final_category: expense.final_category,
            type: expense.type,
            date: purchaseDateStr,
            invoice_month: label,
            is_recurring: false,
            is_paid: false,
            wallet_id: expense.wallet_id,
            credit_card_id: expense.credit_card_id,
            notes: `Gerado automaticamente (recorrente ${freq})`,
            payment_method: expense.payment_method,
          };

          const { error: insertError } = await supabase.from("expenses").insert(newExpense);
          if (insertError) {
            console.error(`Insert error (card) for ${expense.description}:`, insertError);
            continue;
          }
          created++;
        }

        continue;
      }

      // ─── Débito/receita: mantém a lógica original, por data de calendário. ───
      const targetDay = originalDate.getDate();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const adjustedDay = Math.min(targetDay, lastDayOfMonth);
      const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;

      // Skip if original date is in current month (it's the source)
      const origMonth = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, "0")}`;
      if (origMonth === currentMonth) {
        skipped++;
        continue;
      }

      // Check frequency
      if (freq === "monthly") {
        // OK, generate every month
      } else if (freq === "weekly") {
        if (today.getDay() !== originalDate.getDay()) {
          skipped++;
          continue;
        }
      } else if (freq === "yearly") {
        if (today.getMonth() !== originalDate.getMonth()) {
          skipped++;
          continue;
        }
      }

      // Honor explicit user exceptions (mark as paid w/ new date, delete one
      // occurrence, edit "this one only", edit "all from now on", etc.)
      const occurrenceDate = freq === "weekly" ? todayStr : targetDate;
      if (exceptionSet.has(`${expense.id}|${occurrenceDate}`)) {
        skipped++;
        continue;
      }

      // Check if already generated for this period — match by description+type
      // only (value or exact day might have changed when user paid/edited).
      const checkStart = freq === "weekly"
        ? todayStr
        : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const checkEnd = freq === "weekly"
        ? todayStr
        : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${lastDayOfMonth}`;

      const { data: existing } = await supabase
        .from("expenses")
        .select("id, description, type")
        .eq("user_id", expense.user_id)
        .eq("type", expense.type)
        .eq("is_recurring", false)
        .gte("date", checkStart)
        .lte("date", checkEnd);

      const alreadyMaterialized = (existing ?? []).some(
        (row: any) => normalizeDescription(row.description) === normalizedTarget,
      );

      if (alreadyMaterialized) {
        skipped++;
        continue;
      }

      // Generate the recurring entry
      const newExpense: Record<string, unknown> = {
        user_id: expense.user_id,
        description: expense.description,
        value: expense.value,
        final_category: expense.final_category,
        type: expense.type,
        date: occurrenceDate,
        is_recurring: false,
        is_paid: false,
        wallet_id: expense.wallet_id,
        credit_card_id: expense.credit_card_id,
        notes: `Gerado automaticamente (recorrente ${freq})`,
        payment_method: expense.payment_method,
      };

      const { error: insertError } = await supabase
        .from("expenses")
        .insert(newExpense);

      if (insertError) {
        console.error(`Insert error for ${expense.description}:`, insertError);
        continue;
      }

      created++;
    }

    console.log(`Recurring expenses processed: ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, created, skipped, date: todayStr }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-recurring error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar despesas recorrentes" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
