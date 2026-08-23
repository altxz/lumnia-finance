package com.lumnia.finance;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

final class PendingBankTransactionStore {
    private static final String PREFS = "lumnia_bank_capture";
    private static final String PENDING = "pending_transaction";

    private PendingBankTransactionStore() {}

    static void saveFromIntent(Context context, Intent intent) {
        if (intent == null || !intent.getBooleanExtra("lumnia_bank_transaction", false)) return;
        JSONObject data = new JSONObject();
        try {
            data.put("bank", intent.getStringExtra("bank"));
            data.put("packageName", intent.getStringExtra("package_name"));
            data.put("description", intent.getStringExtra("description"));
            data.put("value", readValue(intent));
            data.put("type", intent.getStringExtra("transaction_type"));
            data.put("date", intent.getStringExtra("date"));
            data.put("rawText", intent.getStringExtra("raw_text"));
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(PENDING, data.toString()).apply();
        } catch (JSONException ignored) {}
    }

    private static double readValue(Intent intent) {
        Object rawValue = intent.getExtras() == null ? null : intent.getExtras().get("value");
        if (rawValue instanceof Number) return ((Number) rawValue).doubleValue();
        if (rawValue instanceof String) {
            try { return Double.parseDouble(((String) rawValue).replace(',', '.')); }
            catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    static JSONObject consume(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(PENDING, null);
        if (raw == null) return null;
        prefs.edit().remove(PENDING).apply();
        try { return new JSONObject(raw); } catch (JSONException ignored) { return null; }
    }
}
