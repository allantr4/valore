package com.valore.financeiro;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.NotificationManagerCompat;

import java.util.Set;

public class BankNotificationBridge {
    private final Activity activity;
    private final WebView webView;
    private static BankNotificationBridge activeInstance = null;

    public BankNotificationBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        activeInstance = this;
    }

    public static void notifyNewBankNotification(final String jsonItem) {
        if (activeInstance != null && activeInstance.webView != null) {
            activeInstance.activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String escaped = jsonItem.replace("\\", "\\\\").replace("'", "\\'");
                        activeInstance.webView.evaluateJavascript(
                            "if (typeof window.handleNativeBankNotificationReceived === 'function') { window.handleNativeBankNotificationReceived('" + escaped + "'); }",
                            null
                        );
                    } catch (Exception ignored) {}
                }
            });
        }
    }

    @JavascriptInterface
    public boolean isSupported() {
        return true;
    }

    @JavascriptInterface
    public boolean isPermissionGranted() {
        try {
            Context context = activity.getApplicationContext();
            String packageName = context.getPackageName();
            
            // Método 1: NotificationManagerCompat
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            if (packageNames != null && packageNames.contains(packageName)) {
                return true;
            }

            // Método 2: Verificação direta via Secure Settings
            String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
            if (!TextUtils.isEmpty(flat)) {
                String[] names = flat.split(":");
                for (String name : names) {
                    ComponentName cn = ComponentName.unflattenFromString(name);
                    if (cn != null && TextUtils.equals(packageName, cn.getPackageName())) {
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    @JavascriptInterface
    public void openPermissionSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            try {
                // Fallback para configurações gerais de apps
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(fallback);
            } catch (Exception ignored) {}
        }
    }

    @JavascriptInterface
    public String getPendingNotifications() {
        return BankNotificationService.getPendingNotifications(activity.getApplicationContext());
    }

    @JavascriptInterface
    public void clearPendingNotifications() {
        BankNotificationService.clearPendingNotifications(activity.getApplicationContext());
    }

    @JavascriptInterface
    public void simulateTestNotification(String bankName, String sampleText) {
        String finalBank = (bankName != null && !bankName.trim().isEmpty()) ? bankName : "Nubank";
        String finalText = (sampleText != null && !sampleText.trim().isEmpty()) 
            ? sampleText 
            : "Compra de R$ 45,90 aprovada em Padaria Bella Vista";

        BankNotificationService.saveNotification(
            activity.getApplicationContext(),
            "com.simulated.bank",
            finalBank,
            finalBank,
            finalText,
            System.currentTimeMillis()
        );
    }
}

