package site.khaber.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import site.khaber.app.ui.P
import java.io.File

internal fun Context.activity(): Activity? { var c = this; while (c is ContextWrapper) { if (c is Activity) return c; c = c.baseContext }; return null }

/** بديل دوال Tampermonkey ثم سكربت أداة نور نفسه — كما في التطبيق السابق تمامًا */
internal fun injectTool(w: WebView, host: AndroidHost) {
    val src = host.toolSrc ?: return
    val shim = "(function(){if(window.__tahdirTool)return;window.__tahdirTool=1;var B=window.TahdirBridge;" +
        "window.unsafeWindow=window;" +
        "window.GM_getValue=function(k,d){var v=B.getValue(String(k));if(v===null||v===undefined||v==='')return d;try{return JSON.parse(v);}catch(e){return d;}};" +
        "window.GM_setValue=function(k,v){B.setValue(String(k),JSON.stringify(v));};" +
        "window.GM_deleteValue=function(k){B.deleteValue(String(k));};" +
        "window.GM_openInTab=function(u){B.openNour(String(u));};" +
        "window.GM_registerMenuCommand=function(){};" +
        "try{\n" + src + "\n}catch(e){console.error('tahdir tool',e);}})();"
    w.evaluateJavascript(shim, null)
}

/** الطباعة من الموقع (أوراق الاختبارات والنماذج) والتنزيل من روابط blob */
private const val PAGE_HOOKS = "(function(){if(window.__khn)return;window.__khn=1;var B=window.TahdirBridge;" +
    "window.print=function(){B.print(document.title||'خبير');};" +
    "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^=\"blob:\"],a[href^=\"data:\"]');if(!a)return;e.preventDefault();" +
    "var n=a.getAttribute('download')||'khabeer';fetch(a.href).then(function(r){return r.blob();}).then(function(b){var f=new FileReader();f.onload=function(){B.saveFile(n,b.type||'',String(f.result).split(',')[1]||'');};f.readAsDataURL(b);});},true);})();"

@SuppressLint("SetJavaScriptEnabled")
internal fun newWebView(ctx: Context, zoom: Boolean): WebView = WebView(ctx).apply {
    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    setBackgroundColor(Color.WHITE)
    with(settings) {
        javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
        mediaPlaybackRequiresUserGesture = false
        loadWithOverviewMode = true; useWideViewPort = true
        textZoom = 100
        setSupportZoom(zoom); builtInZoomControls = zoom; displayZoomControls = false
        setSupportMultipleWindows(false); javaScriptCanOpenWindowsAutomatically = false
        userAgentString = "$userAgentString ${AndroidHost.APP_UA}"
    }
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
}

/** الجسر الذي تستعمله أداة نور (GM_*) والموقع (طباعة/حفظ/تدوير) */
internal class Bridge(private val ctx: Context, private val host: AndroidHost, private val w: () -> WebView?, private val onNour: (String?) -> Unit, private val onAction: ((String, String) -> Unit)? = null) {
    @JavascriptInterface fun getValue(k: String): String? = host.prefs.getString("gm_$k", null)
    @JavascriptInterface fun setValue(k: String, v: String) { host.prefs.edit().putString("gm_$k", v).apply() }
    @JavascriptInterface fun deleteValue(k: String) { host.prefs.edit().remove("gm_$k").apply() }
    @JavascriptInterface fun openNour(url: String?) {
        val u = if (url != null && url.startsWith("https://lms.moe.gov.om")) url else null
        w()?.post { onNour(u) }
    }
    /** صفحة الكروت: افتح الماسح الأصلي (موجودة فقط في الشاشات التي تدعمه) */
    @JavascriptInterface fun openScan(id: String) { val a = onAction ?: return; w()?.post { a("scan", id) } }
    @JavascriptInterface fun setLandscape(on: Boolean) {
        w()?.post { ctx.activity()?.requestedOrientation = if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
    @JavascriptInterface fun print(title: String) {
        val v = w() ?: return
        v.post {
            val pm = ctx.activity()?.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return@post
            pm.print(title.ifBlank { "خبير" }, v.createPrintDocumentAdapter(title.ifBlank { "خبير" }), PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
        }
    }
    @JavascriptInterface fun saveFile(name: String, mime: String, b64: String) {
        runCatching {
            val dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: ctx.filesDir
            val f = File(dir, name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "khaber" })
            f.writeBytes(Base64.decode(b64, Base64.DEFAULT))
            val uri = androidx.core.content.FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
            val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime.ifBlank { "*/*" }).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(Intent.createChooser(i, name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }.onFailure { w()?.post { host.toast("تعذّر حفظ الملف") } }
    }
}

private fun download(ctx: Context, host: AndroidHost, url: String, cd: String?, mime: String?) {
    if (!url.startsWith("http")) return
    runCatching {
        val name = URLUtil.guessFileName(url, cd, mime)
        val r = DownloadManager.Request(Uri.parse(url))
            .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
            .addRequestHeader("User-Agent", host.userAgent)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            .setTitle(name)
        if (mime != null) r.setMimeType(mime)
        (ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)
        host.toast("جارٍ التنزيل: $name")
    }.onFailure { host.openExternal(url) }
}

@Composable
actual fun WebModuleScreen(host: Host, url: String, webCss: String, onOpenNour: (String?) -> Unit, onTitle: (String) -> Unit, onAction: (String, String) -> Unit) {
    val ah = host as AndroidHost
    val ctx = LocalContext.current
    var progress by remember { mutableStateOf(0) }
    var fileCb by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var camReq by remember { mutableStateOf<PermissionRequest?>(null) }
    val fileLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)); fileCb = null
    }
    val camLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        camReq?.let { if (ok) it.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else it.deny() }; camReq = null
    }
    val siteHost = Uri.parse(ah.siteUrl).host ?: "khaber.site"
    val css = webCss.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ")
    val hooks = "(function(){var s=document.getElementById('khn-css');if(!s){s=document.createElement('style');s.id='khn-css';(document.head||document.documentElement).appendChild(s);}s.textContent='$css';})();"
    val web = remember(url) {
        newWebView(ctx, zoom = false).also { w ->
            w.addJavascriptInterface(Bridge(ctx, ah, { w }, onOpenNour, onAction), "TahdirBridge")
            w.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                    val u = req.url; val h = u.host ?: ""
                    if (h == siteHost || h.endsWith(".$siteHost")) return false
                    if (h.endsWith("moe.gov.om")) { onOpenNour(u.toString()); return true }
                    ah.openExternal(u.toString()); return true
                }
                override fun onPageCommitVisible(v: WebView, u: String?) { v.evaluateJavascript(hooks, null) }
                override fun onPageFinished(v: WebView, u: String?) {
                    v.evaluateJavascript(hooks, null); v.evaluateJavascript(PAGE_HOOKS, null); injectTool(v, ah)
                    v.title?.let(onTitle)
                }
                override fun onReceivedError(v: WebView, req: WebResourceRequest, err: WebResourceError) {
                    if (!req.isForMainFrame) return
                    v.loadDataWithBaseURL(null, offlineHtml(req.url.toString()), "text/html", "utf-8", req.url.toString())
                }
            }
            w.webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(v: WebView, p: Int) { progress = p }
                override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    fileCb?.onReceiveValue(null); fileCb = cb
                    return runCatching { fileLauncher.launch(params.createIntent()); true }.getOrElse { fileCb = null; false }
                }
                override fun onPermissionRequest(r: PermissionRequest) {
                    val ours = r.origin?.host?.let { it == siteHost || it.endsWith(".$siteHost") } == true
                    if (!ours || PermissionRequest.RESOURCE_VIDEO_CAPTURE !in r.resources) { r.deny(); return }
                    if (ctx.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) r.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    else { camReq?.deny(); camReq = r; camLauncher.launch(Manifest.permission.CAMERA) }
                }
            }
            w.setDownloadListener { u, _, cd, mime, _ -> download(ctx, ah, u, cd, mime) }
            w.loadUrl(url)
        }
    }
    DisposableEffect(web) {
        WebBack.handler = { if (web.canGoBack()) { web.goBack(); true } else false }
        onDispose { if (WebBack.handler != null) WebBack.handler = null; CookieManager.getInstance().flush(); web.destroy() }
    }
    Box(Modifier.fillMaxSize()) {
        AndroidView({ web }, Modifier.fillMaxSize())
        if (progress in 1..99) LinearProgressIndicator(progress = { progress / 100f }, Modifier.fillMaxWidth().height(3.dp), color = P.owl, trackColor = P.mainL)
    }
}

internal fun offlineHtml(u: String) = "<html dir='rtl'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<body style='font-family:sans-serif;text-align:center;padding:60px 24px;color:#1e1a4d;background:#f6f5fc'>" +
    "<h2>لا يوجد اتصال بالإنترنت</h2><p style='color:#625e8a'>تأكد من الاتصال ثم اضغط إعادة المحاولة.</p>" +
    "<button style='background:#4b40a9;color:#fff;border:0;border-radius:12px;padding:12px 26px;font-size:16px' onclick=\"location.href='" + u.replace("'", "%27") + "'\">إعادة المحاولة</button></body></html>"
