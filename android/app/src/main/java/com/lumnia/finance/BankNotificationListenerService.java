package com.lumnia.finance;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BankNotificationListenerService extends NotificationListenerService {
    private static final String CHANNEL_ID = "bank_transaction_suggestions";
    private static final Pattern VALUE_PATTERN = Pattern.compile("(?i)R\\$\\s*([0-9.]+(?:,[0-9]{2})?)");
    private static final long DEDUP_WINDOW_MS = 120_000L;
    private static final Map<String, String> BANK_PACKAGES = new HashMap<>();

    static {
        BANK_PACKAGES.put("com.nu.production", "Nubank");
        BANK_PACKAGES.put("com.itau", "Itaú");
        BANK_PACKAGES.put("com.itaucard.activity", "Itaú");
        BANK_PACKAGES.put("com.bradesco", "Bradesco");
        BANK_PACKAGES.put("com.c6bank.app", "C6 Bank");
        BANK_PACKAGES.put("br.com.bb.android", "Banco do Brasil");
        BANK_PACKAGES.put("com.santander.app", "Santander");
        BANK_PACKAGES.put("com.picpay", "PicPay");
        BANK_PACKAGES.put("com.mercadopago.wallet", "Mercado Pago");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getPackageName().equals(getPackageName())) return;
        String bank = BANK_PACKAGES.get(sbn.getPackageName());
        if (bank == null) return;

        ParsedTransaction parsed = parse(sbn.getNotification(), bank);
        if (parsed == null || isDuplicate(sbn.getPackageName(), parsed)) return;
        showSuggestion(sbn.getPackageName(), parsed);
    }

    private ParsedTransaction parse(Notification notification, String bank) {
        Bundle extras = notification.extras;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        String raw = (title + " " + body).trim();
        Matcher matcher = VALUE_PATTERN.matcher(raw);
        if (!matcher.find()) return null;

        double value;
        try { value = Double.parseDouble(matcher.group(1).replace(".", "").replace(',', '.')); }
        catch (NumberFormatException ignored) { return null; }
        if (value <= 0) return null;

        String normalized = normalize(raw);
        String type = containsAny(normalized, "recebeu", "recebido", "pix recebido", "credito recebido", "entrada")
            ? "income" : "expense";
        if (!containsAny(normalized, "compra", "pagamento", "pix", "transfer", "debito", "recebe", "credito")) return null;

        String description = body.isEmpty() ? title : body;
        description = VALUE_PATTERN.matcher(description).replaceAll("").replaceAll("\\s+", " ").trim();
        if (description.length() > 120) description = description.substring(0, 120).trim();
        if (description.isEmpty()) description = type.equals("income") ? "Recebimento " + bank : "Transação " + bank;
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return new ParsedTransaction(bank, description, value, type, date, raw);
    }

    private boolean isDuplicate(String packageName, ParsedTransaction transaction) {
        String key = "seen_" + Math.abs((packageName + transaction.raw + transaction.value).hashCode());
        long previous = getSharedPreferences("lumnia_bank_capture", MODE_PRIVATE).getLong(key, 0);
        long now = System.currentTimeMillis();
        if (now - previous < DEDUP_WINDOW_MS) return true;
        getSharedPreferences("lumnia_bank_capture", MODE_PRIVATE).edit().putLong(key, now).apply();
        return false;
    }

    private void showSuggestion(String packageName, ParsedTransaction transaction) {
        createChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;

        Intent intent = new Intent(this, MainActivity.class)
            .setAction("com.lumnia.finance.REGISTER_BANK_TRANSACTION")
            .putExtra("lumnia_bank_transaction", true)
            .putExtra("bank", transaction.bank)
            .putExtra("package_name", packageName)
            .putExtra("description", transaction.description)
            .putExtra("value", transaction.value)
            .putExtra("transaction_type", transaction.type)
            .putExtra("date", transaction.date)
            .putExtra("raw_text", transaction.raw)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int requestCode = Math.abs((packageName + transaction.raw).hashCode());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String value = String.format(new Locale("pt", "BR"), "R$ %.2f", transaction.value);
        String direction = transaction.type.equals("income") ? "Recebimento" : "Transação";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.lumnia.finance.R.drawable.ic_notification_lumnia)
            .setContentTitle(direction + " de " + value + " identificada")
            .setContentText(transaction.bank + " · Toque para revisar e registrar")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(transaction.description))
            .setContentIntent(pendingIntent)
            .addAction(0, "Registrar", pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION);

        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(requestCode, builder.build());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Transações bancárias detectadas", NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Pergunta se uma compra ou recebimento deve ser registrado no Lumnia");
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private static String text(CharSequence value) { return value == null ? "" : value.toString().trim(); }
    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }
    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) if (value.contains(term)) return true;
        return false;
    }

    private static final class ParsedTransaction {
        final String bank, description, type, date, raw;
        final double value;
        ParsedTransaction(String bank, String description, double value, String type, String date, String raw) {
            this.bank = bank; this.description = description; this.value = value;
            this.type = type; this.date = date; this.raw = raw;
        }
    }
}
