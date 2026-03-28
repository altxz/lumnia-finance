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

    // 1. Check credit card due dates (due_day = tomorrow's day)
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id, user_id, name, due_day")
      .eq("due_day", tomorrowDay);

    const notifications: {
      user_id: string;
      title: string;
      message: string;
    }[] = [];

    if (cards && cards.length > 0) {
      // For each card due tomorrow, get the current invoice total
      for (const card of cards) {
        const currentMonth = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}`;
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

    // 2. Check recurring expenses due tomorrow
    const { data: recurring } = await supabase
      .from("expenses")
      .select("user_id, description, value, date")
      .eq("is_recurring", true)
      .eq("is_paid", false)
      .eq("date", tomorrowDateStr);

    if (recurring && recurring.length > 0) {
      for (const exp of recurring) {
        notifications.push({
          user_id: exp.user_id,
          title: "Assinatura a vencer",
          message: `Lembrete: A sua assinatura ${exp.description} de R$ ${exp.value.toFixed(2).replace(".", ",")} vence amanhã.`,
        });
      }
    }

    // 3. Also check non-recurring unpaid expenses due tomorrow
    const { data: unpaid } = await supabase
      .from("expenses")
      .select("user_id, description, value")
      .eq("is_paid", false)
      .eq("is_recurring", false)
      .eq("date", tomorrowDateStr);

    if (unpaid && unpaid.length > 0) {
      for (const exp of unpaid) {
        notifications.push({
          user_id: exp.user_id,
          title: "Conta a vencer",
          message: `Lembrete: A sua conta ${exp.description} de R$ ${exp.value.toFixed(2).replace(".", ",")} vence amanhã.`,
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
