package com.valore.financeiro;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private ApkUpdater apkUpdater;
    private BankNotificationBridge bankNotificationBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);

                // Registra o atualizador embutido nativo do Android
                apkUpdater = new ApkUpdater(this, webView);
                webView.addJavascriptInterface(apkUpdater, "AndroidAppUpdater");

                // Registra a ponte do Leitor Nativo de Notificações Bancárias
                bankNotificationBridge = new BankNotificationBridge(this, webView);
                webView.addJavascriptInterface(bankNotificationBridge, "AndroidBankNotificationBridge");
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        if (apkUpdater != null) {
            apkUpdater.onResume();
        }
    }
}
