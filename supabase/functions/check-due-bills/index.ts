import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowDateStr = tomorrow.toISOString().slice(0, 10);

    const today = new Date();
    const todayDay = today.getDate();
    const todayDateStr = today.toISOString().slice(0, 10);

    const notifications: {
      user_id: string;
      title: string;
      message: string;
      expense_id?: string;
    }[] = [];

    // 1. Check credit card due dates (due_day = tomorrow's day)
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id, user_id, name, due_day, closing_day, closing_strategy, closing_days_before_due");

    if (cards && cards.length > 0) {
      for (const card of cards) {
        let closingDay = card.closing_day;
        if (card.closing_strategy === "relative") {
          closingDay = card.due_day - card.closing_days_before_due;
          if (closingDay <= 0) closingDay += 30;
        }

        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

        // Invoice closing notification (closing_day = today)
        if (closingDay === todayDay) {
          const { data: invoiceExpenses } = await supabase
            .from("expenses")
            .select("value")
            .eq("user_id", card.user_id)
            .eq("credit_card_id", card.id)
            .eq("invoice_month", currentMonth);

          const total = (invoiceExpenses || []).reduce(
            (sum: number, e: { value: number }) => sum + e.value,
            0
          );

          if (total > 0) {
            notifications.push({
              user_id: card.user_id,
              title: "Fatura fechada",
              message: `A fatura ${card.name} de R$ ${total.toFixed(2).replace(".", ",")} fechou hoje. Vencimento dia ${card.due_day}.`,
            });
          }
        }

        // Invoice due tomorrow notification
        if (card.due_day === tomorrowDay) {
          const { data: invoiceExpenses } = await supabase
            .from("expenses")
            .select("value")
            .eq("user_id", card.user_id)
            .eq("credit_card_id", card.id)
            .eq("invoice_month", currentMonth);

          const total = (invoiceExpenses || []).reduce(
            (sum: number, e: { value: number }) => sum + e.value,
            0
          );

          if (total > 0) {
            notifications.push({
              user_id: card.user_id,
              title: "Fatura a vencer",
              message: `Lembrete: A sua fatura ${card.name} de R$ ${total.toFixed(2).replace(".", ",")} vence amanhã.`,
            });
          }
        }
      }
    }

    // 2. Check recurring expenses due tomorrow
    const { data: recurring } = await supabase
      .from("expenses")
      .select("id, user_id, description, value, date, type")
      .eq("is_recurring", true)
      .eq("is_paid", false)
      .eq("date", tomorrowDateStr);

    if (recurring && recurring.length > 0) {
      for (const exp of recurring) {
        const isIncome = exp.type === "income";
        notifications.push({
          user_id: exp.user_id,
          title: isIncome ? "Receita a vencer" : "Assinatura a vencer",
          message: `Lembrete: ${isIncome ? "Sua receita" : "Sua assinatura"} ${exp.description} de R$ ${exp.value.toFixed(2).replace(".", ",")} vence amanhã.`,
          expense_id: exp.id,
        });
      }
    }

    // 3. Check non-recurring unpaid expenses/income due tomorrow
    const { data: unpaidTomorrow } = await supabase
      .from("expenses")
      .select("id, user_id, description, value, type")
      .eq("is_paid", false)
      .eq("is_recurring", false)
      .eq("date", tomorrowDateStr);

    if (unpaidTomorrow && unpaidTomorrow.length > 0) {
      for (const exp of unpaidTomorrow) {
        const isIncome = exp.type === "income";
        notifications.push({
          user_id: exp.user_id,
          title: isIncome ? "Receita a vencer" : "Conta a vencer",
          message: `Lembrete: ${isIncome ? "Sua receita" : "Sua conta"} ${exp.description} de R$ ${exp.value.toFixed(2).replace(".", ",")} vence amanhã.`,
          expense_id: exp.id,
        });
      }
    }

    // 4. Check unpaid expenses/income due TODAY (day of due date)
    const { data: unpaidToday } = await supabase
      .from("expenses")
      .select("id, user_id, description, value, type, is_recurring")
      .eq("is_paid", false)
      .eq("date", todayDateStr);

    if (unpaidToday && unpaidToday.length > 0) {
      for (const exp of unpaidToday) {
        const isIncome = exp.type === "income";
        notifications.push({
          user_id: exp.user_id,
          title: isIncome ? "Receita vencendo hoje" : "Conta vencendo hoje",
          message: `${isIncome ? "Sua receita" : "Sua conta"} ${exp.description} de R$ ${exp.value.toFixed(2).replace(".", ",")} vence hoje!`,
          expense_id: exp.id,
        });
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error } = await supabase
        .from("notifications")
        .insert(notifications);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
