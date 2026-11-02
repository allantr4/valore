package com.valore.financeiro;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class ApkUpdater {
    private final Activity activity;
    private final WebView webView;
    private boolean isDownloading = false;
    private static File pendingApkFile = null;

    public ApkUpdater(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public void onResume() {
        if (pendingApkFile != null && pendingApkFile.exists()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (activity.getPackageManager().canRequestPackageInstalls()) {
                    File toInstall = pendingApkFile;
                    pendingApkFile = null;
                    installApkFile(toInstall);
                }
            } else {
                File toInstall = pendingApkFile;
                pendingApkFile = null;
                installApkFile(toInstall);
            }
        }
    }

    @JavascriptInterface
    public void retryInstall() {
        activity.runOnUiThread(() -> {
            File downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDir == null) downloadDir = activity.getCacheDir();
            File apk = new File(downloadDir, "Valore_Update.apk");
            if (apk.exists()) {
                installApkFile(apk);
            } else {
                sendError("Arquivo de atualização não encontrado no celular. Toque em Atualizar para baixar novamente.");
            }
        });
    }

    @JavascriptInterface
    public void downloadAndInstall(final String fileUrl) {
        if (isDownloading) {
            sendToast("O download da atualização já está em andamento. Aguarde...");
            return;
        }

        // Garante que qualquer APK residual de versoes anteriores seja excluido antes do novo download
        File downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadDir == null) downloadDir = activity.getCacheDir();
        File existingApk = new File(downloadDir, "Valore_Update.apk");
        if (existingApk.exists()) {
            try { existingApk.delete(); } catch (Exception ignored) {}
        }

        isDownloading = true;

        new Thread(() -> {
            File tempApk = null;
            try {
                File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = activity.getCacheDir();
                if (!dir.exists()) dir.mkdirs();

                tempApk = new File(dir, "Valore_Update.apk");
                if (tempApk.exists()) tempApk.delete();

                URL url = new URL(fileUrl);
                HttpURLConnection conn = openConnectionFollowingRedirects(url);

                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Servidor de atualizações retornou código HTTP " + responseCode);
                }

                long totalBytes = conn.getContentLength();
                InputStream input = conn.getInputStream();
                FileOutputStream output = new FileOutputStream(tempApk);

                byte[] buffer = new byte[8192];
                long transferredBytes = 0;
                long lastReportTime = 0;
                int bytesRead;

                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                    transferredBytes += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastReportTime > 120 || (totalBytes > 0 && transferredBytes == totalBytes)) {
                        lastReportTime = now;
                        int percent = totalBytes > 0 ? (int) Math.min(100, (transferredBytes * 100) / totalBytes) : 0;
                        double transferredMb = Math.round((transferredBytes / (1024.0 * 1024.0)) * 10.0) / 10.0;
                        double totalMb = totalBytes > 0 ? Math.round((totalBytes / (1024.0 * 1024.0)) * 10.0) / 10.0 : 0.0;

                        sendProgress(percent, transferredMb, totalMb);
                    }
                }

                output.flush();
                output.close();
                input.close();
                conn.disconnect();

                isDownloading = false;
                sendProgress(100, Math.round((tempApk.length() / (1024.0 * 1024.0)) * 10.0) / 10.0, Math.round((tempApk.length() / (1024.0 * 1024.0)) * 10.0) / 10.0);

                installApkFile(tempApk);

            } catch (final Exception e) {
                isDownloading = false;
                if (tempApk != null && tempApk.exists()) {
                    try { tempApk.delete(); } catch (Exception ignored) {}
                }
                sendError("Erro ao baixar atualização: " + e.getMessage());
            }
        }).start();
    }

    private HttpURLConnection openConnectionFollowingRedirects(URL url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Valore-Android-Updater/1.0");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);

        int redirects = 0;
        int status = conn.getResponseCode();

        while (status == HttpURLConnection.HTTP_MOVED_TEMP ||
               status == HttpURLConnection.HTTP_MOVED_PERM ||
               status == HttpURLConnection.HTTP_SEE_OTHER ||
               status == 307 || status == 308) {

            if (redirects++ > 8) {
                throw new Exception("Muitos redirecionamentos ao baixar atualização.");
            }

            String newUrl = conn.getHeaderField("Location");
            conn.disconnect();

            url = new URL(newUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("User-Agent", "Valore-Android-Updater/1.0");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            status = conn.getResponseCode();
        }

        return conn;
    }

    private void installApkFile(final File apkFile) {
        activity.runOnUiThread(() -> {
            try {
                pendingApkFile = apkFile;

                // Checa permissão no Android 8.0+ (Oreo)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!activity.getPackageManager().canRequestPackageInstalls()) {
                        notifyPermissionPending();
                        sendToast("Ative a permissão 'Permitir desta fonte' nas Configurações e retorne ao Valore.");
                        Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName()));
                        activity.startActivity(settingsIntent);
                        return;
                    }
                }

                notifyInstallReady();

                // Cria Intent com FileProvider
                Uri apkUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apkFile);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);

            } catch (Exception ex) {
                sendError("Falha ao abrir instalador do Android: " + ex.getMessage());
            }
        });
    }

    private void sendProgress(final int percent, final double transferredMb, final double totalMb) {
        if (webView != null) {
            webView.post(() -> {
                String js = String.format("if(window.onAndroidUpdateProgress) window.onAndroidUpdateProgress(%d, %.1f, %.1f);", percent, transferredMb, totalMb);
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private void notifyPermissionPending() {
        if (webView != null) {
            webView.post(() -> {
                String js = "if(window.onAndroidPermissionPending) window.onAndroidPermissionPending();";
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private void notifyInstallReady() {
        if (webView != null) {
            webView.post(() -> {
                String js = "if(window.onAndroidInstallReady) window.onAndroidInstallReady();";
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private void sendError(final String errorMsg) {
        if (webView != null) {
            webView.post(() -> {
                String safeMsg = errorMsg.replace("'", "\\'").replace("\n", " ");
                String js = String.format("if(window.onAndroidUpdateError) window.onAndroidUpdateError('%s');", safeMsg);
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private void sendToast(final String msg) {
        if (webView != null) {
            webView.post(() -> {
                String safeMsg = msg.replace("'", "\\'").replace("\n", " ");
                String js = String.format("if(typeof showToast === 'function') showToast('%s', 'info');", safeMsg);
                webView.evaluateJavascript(js, null);
            });
        }
    }
}
