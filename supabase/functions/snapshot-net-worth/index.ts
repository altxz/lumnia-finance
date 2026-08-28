import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function transactionAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // A carteira é uma posição derivada das movimentações. `current_balance`
    // continua existindo por compatibilidade, mas não é fonte de verdade para
    // contas de caixa: ele pode estar defasado após lançamentos comuns.
    const { data: walletRows } = await supabase
      .from("wallets")
      .select("user_id, id, initial_balance, current_balance, asset_type");

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
      const snapshotCutoff = new Date(snapshotDate);
      snapshotCutoff.setDate(0);
      const cutoffDate = snapshotCutoff.toISOString().split("T")[0];

      const { data: cashEvents } = await supabase
        .from("expenses")
        .select("value, type, date, wallet_id, destination_wallet_id, credit_card_id, is_paid, description, invoice_month")
        .eq("user_id", userId)
        .lte("date", cutoffDate);

      const userWallets = walletRows.filter((w: any) => w.user_id === userId);
      const cashBalances = new Map(userWallets.map((wallet: any) => [wallet.id, transactionAmount(wallet.initial_balance)]));
      const defaultWalletId = userWallets.find((wallet: any) => wallet.asset_type === "checking_account")?.id ?? userWallets[0]?.id;

      for (const event of cashEvents || []) {
        if (!event.is_paid) continue;
        const amount = transactionAmount(event.value);
        const isInvoicePayment = String(event.description || "").toLowerCase().startsWith("pagamento fatura")
          || Boolean(event.invoice_month && !event.credit_card_id && String(event.description || "").toLowerCase().includes("fatura"));
        if (event.type === "transfer") {
          const origin = event.wallet_id || defaultWalletId;
          if (origin && cashBalances.has(origin)) cashBalances.set(origin, (cashBalances.get(origin) || 0) - amount);
          if (event.destination_wallet_id && cashBalances.has(event.destination_wallet_id)) {
            cashBalances.set(event.destination_wallet_id, (cashBalances.get(event.destination_wallet_id) || 0) + amount);
          }
          continue;
        }
        if (event.credit_card_id && !isInvoicePayment) continue;
        const walletId = event.wallet_id || defaultWalletId;
        if (!walletId || !cashBalances.has(walletId)) continue;
        const direction = event.type === "income" ? 1 : -1;
        cashBalances.set(walletId, (cashBalances.get(walletId) || 0) + direction * amount);
      }

      const totalAssets = userWallets.reduce((sum: number, wallet: any) => {
        if (wallet.asset_type === "investment") return sum + transactionAmount(wallet.current_balance);
        return sum + (cashBalances.get(wallet.id) || 0);
      }, 0);

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
        (s: number, e: any) => s + transactionAmount(e.value),
        0
      );
      const debtTotal = (debts || []).reduce(
        (s: number, d: any) => s + transactionAmount(d.remaining_amount),
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
