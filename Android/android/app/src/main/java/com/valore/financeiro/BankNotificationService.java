package com.valore.financeiro;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

public class BankNotificationService extends NotificationListenerService {
    private static final String PREF_NAME = "valore_bank_notifications";
    private static final String KEY_PENDING = "pending_notifications";
    private static final Map<String, String> KNOWN_BANKS = new HashMap<>();

    static {
        KNOWN_BANKS.put("com.nu.production", "Nubank");
        KNOWN_BANKS.put("br.com.intermedium", "Banco Inter");
        KNOWN_BANKS.put("com.itau", "Itaú");
        KNOWN_BANKS.put("com.itau.personnalite", "Itaú Personnalité");
        KNOWN_BANKS.put("com.itau.cartoes", "Itaú Cartões");
        KNOWN_BANKS.put("com.c6bank.app", "C6 Bank");
        KNOWN_BANKS.put("com.bradesco", "Bradesco");
        KNOWN_BANKS.put("com.bradesco.cartoes", "Bradesco Cartões");
        KNOWN_BANKS.put("com.santander.app", "Santander");
        KNOWN_BANKS.put("br.com.bb.android", "Banco do Brasil");
        KNOWN_BANKS.put("br.gov.caixa.atendimentovirtual", "Caixa");
        KNOWN_BANKS.put("com.mercadopago.wallet", "Mercado Pago");
        KNOWN_BANKS.put("com.picpay", "PicPay");
        KNOWN_BANKS.put("br.com.original.bank", "Banco Original");
        KNOWN_BANKS.put("com.btg.pactual.banking", "BTG Pactual");
        KNOWN_BANKS.put("com.neon", "Neon");
    }

    public static void saveNotification(Context context, String bankKey, String bankName, String title, String text, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String existingStr = prefs.getString(KEY_PENDING, "[]");
            JSONArray array = new JSONArray(existingStr);

            JSONObject item = new JSONObject();
            item.put("id", "notif_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
            item.put("bankKey", bankKey);
            item.put("bankName", bankName);
            item.put("title", title != null ? title : "");
            item.put("text", text != null ? text : "");
            item.put("timestamp", timestamp > 0 ? timestamp : System.currentTimeMillis());

            // Limita histórico acumulado a 30 notificações recentes
            if (array.length() >= 30) {
                JSONArray trimmed = new JSONArray();
                for (int i = array.length() - 29; i < array.length(); i++) {
                    trimmed.put(array.get(i));
                }
                array = trimmed;
            }

            array.put(item);
            prefs.edit().putString(KEY_PENDING, array.toString()).apply();

            // Notifica ponte ativa se a interface estiver rodando
            BankNotificationBridge.notifyNewBankNotification(item.toString());
        } catch (Exception ignored) {}
    }

    public static String getPendingNotifications(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_PENDING, "[]");
        } catch (Exception e) {
            return "[]";
        }
    }

    public static void clearPendingNotifications(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_PENDING, "[]").apply();
        } catch (Exception ignored) {}
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        String pkg = sbn.getPackageName();
        if (pkg == null) return;

        String bankName = KNOWN_BANKS.get(pkg);
        if (bankName == null) {
            // Verifica se o pacote contém identificadores bancários comuns
            String pkgLower = pkg.toLowerCase();
            if (pkgLower.contains("bank") || pkgLower.contains("banco") || pkgLower.contains("finance") || pkgLower.contains("pagamento")) {
                bankName = "Banco";
            } else {
                return;
            }
        }

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String text = bigTextCs != null ? bigTextCs.toString() : (textCs != null ? textCs.toString() : "");

        if (text.trim().isEmpty() && title.trim().isEmpty()) return;

        String combined = (title + " " + text).toLowerCase();

        // Filtro financeiro: apenas notificações que representem movimentação monetária ou compras
        boolean isFinancial = combined.contains("r$") || 
                              combined.contains("compra") || 
                              combined.contains("aprovada") || 
                              combined.contains("pix") || 
                              combined.contains("pagamento") || 
                              combined.contains("transferência") || 
                              combined.contains("transferencia") || 
                              combined.contains("débito") || 
                              combined.contains("debito") || 
                              combined.contains("crédito") || 
                              combined.contains("credito") || 
                              combined.contains("enviado") || 
                              combined.contains("recebido") || 
                              combined.contains("pago");

        if (isFinancial) {
            long postTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
            saveNotification(getApplicationContext(), pkg, bankName, title, text, postTime);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Nada a fazer na remoção
    }
}

