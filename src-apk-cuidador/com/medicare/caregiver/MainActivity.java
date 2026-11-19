package com.medicare.caregiver;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String PRIMARY_URL = "https://medicare-cuidador.duckdns.org/cuidador";
    private static final String FALLBACK_URL = "http://144.22.160.191:3009/cuidador";
    private static final int REQ_POST_NOTIFICATIONS = 2001;

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout errorOverlay;
    private String currentUrl = PRIMARY_URL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_POST_NOTIFICATIONS);
            }
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b1120"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0b1120"));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(false);
        progressBar.setMax(100);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                8
        );
        pbParams.gravity = Gravity.TOP;
        root.addView(progressBar, pbParams);

        errorOverlay = buildErrorOverlay();
        errorOverlay.setVisibility(View.GONE);
        root.addView(errorOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
        configureWebView();
        loadCaregiverUrl(PRIMARY_URL);
    }

    private LinearLayout buildErrorOverlay() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#0b1120"));
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Sem conexão com o MediCare");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        TextView desc = new TextView(this);
        desc.setText("Verifique sua internet e tente abrir o MediCare Cuidador novamente.");
        desc.setTextColor(Color.parseColor("#94a3b8"));
        desc.setTextSize(14);
        desc.setGravity(Gravity.CENTER);
        desc.setPadding(0, pad / 2, 0, pad);
        layout.addView(desc);

        Button retryBtn = new Button(this);
        retryBtn.setText("Tentar novamente");
        retryBtn.setBackgroundColor(Color.parseColor("#2563eb"));
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                loadCaregiverUrl(currentUrl);
            }
        });
        layout.addView(retryBtn);

        Button fallbackBtn = new Button(this);
        fallbackBtn.setText("Usar endereço alternativo");
        fallbackBtn.setBackgroundColor(Color.parseColor("#1e293b"));
        fallbackBtn.setTextColor(Color.parseColor("#cbd5e1"));
        LinearLayout.LayoutParams fbParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        fbParams.topMargin = pad / 2;
        fallbackBtn.setLayoutParams(fbParams);
        fallbackBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String next = PRIMARY_URL.equals(currentUrl) ? FALLBACK_URL : PRIMARY_URL;
                loadCaregiverUrl(next);
            }
        });
        layout.addView(fallbackBtn);

        return layout;
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                openExternalUrl(url);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String path = uri.getPath() != null ? uri.getPath() : "";
                String host = uri.getHost() != null ? uri.getHost() : "";

                if (path.startsWith("/api/apk")) {
                    openExternalUrl(uri.toString());
                    return true;
                }
                if ("medicare-cuidador.duckdns.org".equalsIgnoreCase(host)
                        || "144.22.160.191".equals(host)) {
                    return false;
                }
                openExternalUrl(uri.toString());
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    errorOverlay.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    private void loadCaregiverUrl(String url) {
        currentUrl = url;
        errorOverlay.setVisibility(View.GONE);
        webView.loadUrl(url);
    }

    private void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
