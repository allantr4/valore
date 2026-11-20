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
        KNOWN_BANKS.put("com.bancointer", "Banco Inter");
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
        KNOWN_BANKS.put("br.com.xp.investimentos", "XP");
        KNOWN_BANKS.put("br.com.uol.ps", "PagBank");
        KNOWN_BANKS.put("com.willbank.app", "Will Bank");
        KNOWN_BANKS.put("br.com.sicredi.mobile", "Sicredi");
        KNOWN_BANKS.put("br.com.sicoob.app", "Sicoob");
        KNOWN_BANKS.put("com.nomadfinancial", "Nomad");
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
        CharSequence titleBigCs = extras.getCharSequence("android.title.big");
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

        String title = titleBigCs != null ? titleBigCs.toString() : (titleCs != null ? titleCs.toString() : "");
        String text = bigTextCs != null ? bigTextCs.toString() : (textCs != null ? textCs.toString() : "");
        if (text.trim().isEmpty() && subTextCs != null) {
            text = subTextCs.toString();
        }

        if (text.trim().isEmpty() && title.trim().isEmpty()) return;

        String combined = (title + " " + text).toLowerCase();

        // 1. Blacklist Estrita: descarta notificações de marketing, segurança, 2FA, informativos e convites
        if (combined.contains("código") || combined.contains("codigo") ||
            combined.contains("token") || combined.contains("segurança") ||
            combined.contains("seguranca") || combined.contains("pré-aprovado") ||
            combined.contains("pre-aprovado") || combined.contains("limite disponível") ||
            combined.contains("informe de rendimentos") || combined.contains("convite") ||
            combined.contains("acesse sua conta") || combined.contains("atualize seu") ||
            combined.contains("promoção") || combined.contains("promocao") ||
            combined.contains("cashback disponível") || combined.contains("empréstimo disponível") ||
            combined.contains("guarde seu dinheiro") || combined.contains("dica:") ||
            combined.contains("dica de")) {
            return;
        }

        // 2. Critério de Ação Financeira Real: exige verbos/ações de transação executada
        boolean hasAction = combined.contains("compra") ||
                            combined.contains("aprovada") ||
                            combined.contains("pix enviado") ||
                            combined.contains("pix recebido") ||
                            combined.contains("você enviou") ||
                            combined.contains("voce enviou") ||
                            combined.contains("você recebeu") ||
                            combined.contains("voce recebeu") ||
                            combined.contains("transferência enviada") ||
                            combined.contains("transferencia enviada") ||
                            combined.contains("transferência recebida") ||
                            combined.contains("transferencia recebida") ||
                            combined.contains("pagamento de") ||
                            combined.contains("pagamento realizado") ||
                            combined.contains("pagamento aprovado") ||
                            combined.contains("débito de") ||
                            combined.contains("debito de") ||
                            combined.contains("você gastou") ||
                            combined.contains("voce gastou") ||
                            combined.contains("saque realizado") ||
                            combined.contains("ted enviada") ||
                            combined.contains("ted recebida") ||
                            combined.contains("doc enviado") ||
                            combined.contains("doc recebido") ||
                            (combined.contains("fatura") && (combined.contains("fechada") || combined.contains("vence")));

        // 3. Critério Monetário Rigoroso: exige quantia explícita em reais com números
        boolean hasCurrencyValue = combined.matches(".*r\\$\\s*\\d+.*") || 
                                   combined.matches(".*r\\s\\$\\s*\\d+.*") || 
                                   combined.matches(".*(?:valor|quantia)(?:\\s+de)?\\s*\\d+.*");

        if (hasAction && hasCurrencyValue) {
            long postTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
            saveNotification(getApplicationContext(), pkg, bankName, title, text, postTime);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Nada a fazer na remoção
    }
}

