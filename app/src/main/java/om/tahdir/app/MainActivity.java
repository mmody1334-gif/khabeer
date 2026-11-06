package om.tahdir.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebResourceError;
import android.view.WindowInsets;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.content.pm.PackageManager;
import android.Manifest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * خبير — تطبيق أندرويد.
 * شاشتان: موقع خبير، ومنصة نور. الأداة (نفس سكربت Tampermonkey) تُحقن تلقائيًا في الشاشتين،
 * وتُحدَّث من الموقع عند كل تشغيل، فلا حاجة لإضافات أو Tampermonkey.
 * التطبيق لا يضغط حفظ أو نشر في نور أبدًا؛ هذا يبقى للمعلم.
 */
public class MainActivity extends Activity {
    static final String SITE = BuildConfig.SITE_URL;
    static final String NOUR = "https://lms.moe.gov.om/teacher";
    static final String TOOL_URL = BuildConfig.TOOL_URL;
    static final int GREEN = Color.parseColor(BuildConfig.TAB_COLOR);
    static final int ACTIVE = Color.parseColor(BuildConfig.TAB_ACTIVE);
    static final int FILE_REQ = 7;
    static final int CAM_REQ = 8;
    PermissionRequest camPending;

    WebView site, nour, current;
    Button tabSite, tabNour;
    ProgressBar progress;
    SharedPreferences prefs;
    volatile String toolSrc;
    ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("tahdir", MODE_PRIVATE);
        toolSrc = prefs.getString("tool_src", null);
        if (toolSrc == null) toolSrc = readAsset("tool.user.js");
        refreshTool();

        CookieManager.getInstance().setAcceptCookie(true);
        // نفس الشكل على كل الإصدارات: التطبيق يمتد خلف الأشرطة، والمسافات نضبطها بأنفسنا
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if (Build.VERSION.SDK_INT < 35) { getWindow().setStatusBarColor(Color.TRANSPARENT); getWindow().setNavigationBarColor(GREEN); }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setBackgroundColor(GREEN);
        // أندرويد 15+ يرسم التطبيق خلف شريط الحالة: نترك مسافة بقدر الأشرطة ولوحة المفاتيح
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            int l, t, r, btm;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                l = i.left; t = i.top; r = i.right; btm = i.bottom;
            } else {
                l = ins.getSystemWindowInsetLeft(); t = ins.getSystemWindowInsetTop(); r = ins.getSystemWindowInsetRight(); btm = ins.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, btm);
            return ins;
        });

        LinearLayout bar = new LinearLayout(this);
        bar.setBackgroundColor(GREEN);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dp(6);
        bar.setPadding(pad, pad, pad, pad);
        tabSite = tab(BuildConfig.APP_LABEL);
        tabNour = tab("منصة نور");
        Button reload = tab("↻");
        bar.addView(tabSite, new LinearLayout.LayoutParams(0, dp(42), 1f));
        bar.addView(tabNour, new LinearLayout.LayoutParams(0, dp(42), 1f));
        bar.addView(reload, new LinearLayout.LayoutParams(dp(52), dp(42)));
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));

        FrameLayout frame = new FrameLayout(this);
        site = makeWebView();
        site.getSettings().setSupportZoom(false);
        site.getSettings().setBuiltInZoomControls(false);
        nour = makeWebView();
        frame.addView(site);
        frame.addView(nour);
        root.addView(frame, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        tabSite.setOnClickListener(v -> show(site));
        tabNour.setOnClickListener(v -> { if (nour.getUrl() == null) nour.loadUrl(NOUR); show(nour); });
        reload.setOnClickListener(v -> current.reload());

        site.loadUrl(SITE);
        show(site);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
    }

    void goBack() {
        if (current != null && current.canGoBack()) current.goBack();
        else if (current == nour) show(site);
        else finish();
    }

    Button tab(String text) {
        Button t = new Button(this);
        t.setText(text);
        t.setAllCaps(false);
        t.setTextSize(15);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(Color.WHITE);
        t.setBackgroundColor(Color.TRANSPARENT);
        return t;
    }

    void show(WebView w) {
        current = w;
        site.setVisibility(w == site ? View.VISIBLE : View.GONE);
        nour.setVisibility(w == nour ? View.VISIBLE : View.GONE);
        tabSite.setBackgroundColor(w == site ? ACTIVE : Color.TRANSPARENT);
        tabNour.setBackgroundColor(w == nour ? ACTIVE : Color.TRANSPARENT);
    }

    WebView makeWebView() {
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        // يتصرف كتطبيق جوال: الموقع يعرض واجهة الجوال (شريط سفلي، أوراق سفلية)، فلا تكبير بالأصابع،
        // وحجم الخط ثابت حتى لا يكسر تكبيرُ خط النظام التخطيطَ (كان يُظهر صفحات أعرض من الشاشة).
        // منصة نور تبقى قابلة للتكبير لأنها موقع كمبيوتر.
        s.setTextZoom(100);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setUserAgentString(s.getUserAgentString() + " TahdirApp/1");
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.addJavascriptInterface(new Bridge(), "TahdirBridge");
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.endsWith("moe.gov.om") || host.endsWith("workers.dev") || host.endsWith("elkabsula.site")) {
                    // روابط نور تفتح في شاشة نور، وروابط الموقع في شاشة الموقع
                    WebView target = host.endsWith("moe.gov.om") ? nour : site;
                    if (target != view) { target.loadUrl(u.toString()); show(target); return true; }
                    return false;
                }
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) { inject(view); }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                String u = req.getUrl().toString().replace("'", "%27");
                view.loadDataWithBaseURL(null, "<html dir='rtl'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                    + "<body style='font-family:sans-serif;text-align:center;padding:60px 24px;color:#163'>"
                    + "<h2>لا يوجد اتصال بالإنترنت</h2><p>تأكد من الاتصال ثم اضغط إعادة المحاولة.</p>"
                    + "<button style='background:" + BuildConfig.TAB_ACTIVE + ";color:#fff;border:0;border-radius:10px;padding:12px 26px;font-size:16px' onclick=\"location.href='" + u + "'\">إعادة المحاولة</button></body></html>",
                    "text/html", "utf-8", u);
            }
        });
        w.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                if (view != current) return;
                progress.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(p);
            }
            /** الكاميرا لصفحة «بطاقات الإجابة» في موقع خبير فقط (لا تُمنح لأي موقع آخر مثل نور). */
            @Override
            public void onPermissionRequest(PermissionRequest r) {
                runOnUiThread(() -> {
                    boolean ours = false, video = false;
                    try { String h = r.getOrigin().getHost(); ours = h != null && (h.endsWith("workers.dev") || h.endsWith("elkabsula.site")); } catch (Exception ignored) { }
                    for (String x : r.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) video = true;
                    if (!ours || !video) { r.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        r.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (camPending != null) camPending.deny();
                        camPending = r;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAM_REQ);
                    }
                });
            }
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { startActivityForResult(params.createIntent(), FILE_REQ); }
                catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        w.setDownloadListener((url, ua, cd, mime, len) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
        });
        return w;
    }

    /** نحقن بديلًا لدوال Tampermonkey ثم سكربت الأداة نفسه (مرة واحدة لكل صفحة). */
    void inject(WebView w) {
        String src = toolSrc;
        if (src == null) return;
        String shim = "(function(){if(window.__tahdirTool)return;window.__tahdirTool=1;var B=window.TahdirBridge;"
            + "window.unsafeWindow=window;"
            + "window.GM_getValue=function(k,d){var v=B.getValue(String(k));if(v===null||v===undefined||v==='')return d;try{return JSON.parse(v);}catch(e){return d;}};"
            + "window.GM_setValue=function(k,v){B.setValue(String(k),JSON.stringify(v));};"
            + "window.GM_deleteValue=function(k){B.deleteValue(String(k));};"
            + "window.GM_openInTab=function(u){B.openNour(String(u));};"
            + "window.GM_registerMenuCommand=function(){};"
            + "try{\n" + src + "\n}catch(e){console.error('tahdir tool',e);}})();";
        w.evaluateJavascript(shim, null);
    }

    /** نجلب أحدث نسخة من الأداة من الموقع (تحديث تلقائي بدون تحديث التطبيق). */
    void refreshTool() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(TOOL_URL).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                if (c.getResponseCode() == 200) {
                    String s = readAll(c.getInputStream());
                    if (s.contains("==UserScript==")) { toolSrc = s; prefs.edit().putString("tool_src", s).apply(); }
                }
                c.disconnect();
            } catch (Exception ignored) { }
        }).start();
    }

    class Bridge {
        @JavascriptInterface public String getValue(String k) { return prefs.getString("gm_" + k, null); }
        @JavascriptInterface public void setValue(String k, String v) { prefs.edit().putString("gm_" + k, v).apply(); }
        @JavascriptInterface public void deleteValue(String k) { prefs.edit().remove("gm_" + k).apply(); }
        // كروت الأسئلة: المسح بالعرض يرى عددًا أكبر من الطلاب
        @JavascriptInterface public void setLandscape(boolean on) {
            runOnUiThread(() -> setRequestedOrientation(on ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        }
        @JavascriptInterface public void openNour(String url) {
            runOnUiThread(() -> {
                String u = (url != null && url.startsWith("https://lms.moe.gov.om")) ? url : NOUR;
                nour.loadUrl(u);
                show(nour);
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == CAM_REQ && camPending != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) camPending.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else camPending.deny();
            camPending = null;
            return;
        }
        super.onRequestPermissionsResult(req, perms, res);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { goBack(); }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) { return readAll(in); } catch (Exception e) { return null; }
    }

    static String readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        return o.toString(StandardCharsets.UTF_8.name());
    }

    int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
