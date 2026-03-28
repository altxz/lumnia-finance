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

    // Get all distinct user IDs from wallets
    const { data: walletRows } = await supabase
      .from("wallets")
      .select("user_id, current_balance, asset_type");

    if (!walletRows || walletRows.length === 0) {
      return new Response(JSON.stringify({ message: "No wallets found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(walletRows.map((w: any) => w.user_id))];
    const snapshotDate = new Date();
    snapshotDate.setDate(1); // first day of current month
    const dateStr = snapshotDate.toISOString().split("T")[0];

    const results: any[] = [];

    for (const userId of userIds) {
      // Total assets = sum of all wallet balances
      const userWallets = walletRows.filter((w: any) => w.user_id === userId);
      const totalAssets = userWallets.reduce(
        (s: number, w: any) => s + (w.current_balance || 0),
        0
      );

      // Total liabilities = unpaid credit card expenses + debts (i_owe remaining)
      const [{ data: unpaidExpenses }, { data: debts }] = await Promise.all([
        supabase
          .from("expenses")
          .select("value")
          .eq("user_id", userId)
          .eq("is_paid", false)
          .not("credit_card_id", "is", null),
        supabase
          .from("debts")
          .select("remaining_amount, type")
          .eq("user_id", userId)
          .eq("type", "i_owe"),
      ]);

      const unpaidTotal = (unpaidExpenses || []).reduce(
        (s: number, e: any) => s + e.value,
        0
      );
      const debtTotal = (debts || []).reduce(
        (s: number, d: any) => s + (d.remaining_amount || 0),
        0
      );
      const totalLiabilities = unpaidTotal + debtTotal;

      // Upsert snapshot
      const { error } = await supabase.from("net_worth_history").upsert(
        {
          user_id: userId,
          date: dateStr,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
        },
        { onConflict: "user_id,date" }
      );

      results.push({ userId, totalAssets, totalLiabilities, error: error?.message });
    }

    return new Response(JSON.stringify({ success: true, snapshots: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
