package site.khaber.app

import android.util.Base64
import android.webkit.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import org.json.JSONObject
import site.khaber.app.ui.P
import java.net.URLEncoder

const val NOUR_HOME = "https://lms.moe.gov.om/teacher"

/**
 * يقرأ حالة صفحة إضافة التحضير في نور (بلا أي تعديل عليها) ليعرض التطبيق تقدّم التعبئة:
 * العنوان، محررات النصوص CKEditor، القوائم الثلاث، ومربعات المخرجات.
 */
private const val POLL_JS = """(function(){try{var r={p:location.pathname};
r.lo=!!document.querySelector('input[type=password]')||/login|auth/i.test(location.pathname);
r.prep=/add_preparation|edit_preparation/.test(location.pathname);
var t=document.getElementById('PreparationTitle');r.t=!!(t&&t.value&&t.value.trim());
var C=(window.CKEDITOR&&CKEDITOR.instances)||{},n=0,f=0;for(var k in C){n++;try{var d=C[k].getData().replace(/<[^>]*>|&nbsp;/g,'').trim();if(d)f++;}catch(e){}}r.en=n;r.ef=f;
function sel(id){var s=document.getElementById(id);return !!(s&&s.selectedOptions&&s.selectedOptions.length);}
r.l=sel('taxonomies');r.s=sel('strategies');r.a=sel('teaching_aids');
var cb=[].slice.call(document.querySelectorAll('input[type=checkbox]')).filter(function(x){var p=x.closest('.form-group,fieldset,.panel,div');return p&&/المخرجات/.test(p.textContent||'');});
r.o=(cb.length>0&&cb.every(function(x){return x.checked;}))||document.querySelectorAll('.jstree-checked,.jstree-clicked,.jstree-anchor.jstree-clicked').length>0;r.done=/✓\s*تم[:：]/.test((document.body&&document.body.innerText)||'');if(r.done){r.o=true;}return JSON.stringify(r);}catch(e){return '{}';}})()"""

@Composable
actual fun NourScreen(host: Host, job: NourJob?, onProgress: (NourProgress) -> Unit, onJobTaken: () -> Unit) {
    val ah = host as AndroidHost
    val ctx = LocalContext.current
    var progress by remember { mutableStateOf(0) }
    val jobState = rememberUpdatedState(job)
    val web = remember {
        newWebView(ctx, zoom = true).also { w ->
            w.addJavascriptInterface(Bridge(ctx, ah, { w }) { u -> w.loadUrl(u ?: NOUR_HOME) }, "TahdirBridge")
            w.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                    val h = req.url.host ?: ""
                    if (h.endsWith("moe.gov.om")) return false
                    ah.openExternal(req.url.toString()); return true
                }
                override fun onPageFinished(v: WebView, u: String?) { injectTool(v, ah) }
                override fun onReceivedError(v: WebView, req: WebResourceRequest, err: WebResourceError) {
                    if (!req.isForMainFrame) return
                    v.loadDataWithBaseURL(null, offlineHtml(req.url.toString()), "text/html", "utf-8", req.url.toString())
                }
            }
            w.webChromeClient = object : WebChromeClient() { override fun onProgressChanged(v: WebView, p: Int) { progress = p } }
            w.setDownloadListener { u, _, _, _, _ -> ah.openExternal(u) }
        }
    }
    // مهمة جديدة: تُحفظ في تخزين الأداة وتُمرَّر في الرابط أيضًا (#tahdir=) كما يفعل الموقع تمامًا
    fun apply(j: NourJob) {
        val key = if (j.kind == "homework") "tahdir_pending_hw" else "tahdir_pending_prep"
        ah.prefs.edit().putString("gm_$key", JSONObject().put("data", JSONObject(j.json)).put("ts", System.currentTimeMillis()).put("routed", false).toString()).apply()
        val b64 = Base64.encodeToString(j.json.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        web.loadUrl(if (b64.length < 60000) "$NOUR_HOME#tahdir=" + URLEncoder.encode(b64, "UTF-8") else NOUR_HOME)
    }
    var needsLogin by remember { mutableStateOf(false) }
    LaunchedEffect(job?.json, job?.kind) {
        val j = job
        needsLogin = false
        when {
            j == null -> if (web.url == null) web.loadUrl(NOUR_HOME)
            j.kind == "url" -> web.loadUrl(j.json.ifBlank { NOUR_HOME })
            else -> { apply(j); onJobTaken() }
        }
    }
    // نور طلب تسجيل الدخول أثناء المهمة: بعد الدخول نعيد المهمة مرة واحدة (تضيع مع إعادة التوجيه للدخول)
    LaunchedEffect(job?.json) {
        val j = job ?: return@LaunchedEffect
        if (j.kind == "url") return@LaunchedEffect
        repeat(900) {
            delay(1000)
            web.evaluateJavascript("(function(){return !!document.querySelector('input[type=password]')||/login|auth/i.test(location.pathname)})()") { r ->
                val lo = r == "true"
                if (lo) needsLogin = true
                else if (needsLogin && (web.url ?: "").contains("lms.moe.gov.om")) { needsLogin = false; apply(j) }
            }
        }
    }
    // متابعة التقدّم أثناء مهمة تحضير
    LaunchedEffect(job?.json) {
        if (job?.kind != "prep") return@LaunchedEffect
        repeat(600) {
            delay(800)
            web.evaluateJavascript(POLL_JS) { raw ->
                runCatching {
                    val o = JSONObject(JSONObject("{\"v\":$raw}").getString("v"))
                    onProgress(NourProgress(
                        page = o.optString("p"), onPrep = o.optBoolean("prep"), title = o.optBoolean("t"),
                        editors = o.optInt("ef"), editorsTotal = o.optInt("en"), level = o.optBoolean("l"),
                        strategies = o.optBoolean("s") || o.optBoolean("done"), resources = o.optBoolean("a") || o.optBoolean("done"), outcomes = o.optBoolean("o"), loggedOut = o.optBoolean("lo"),
                    ))
                }
            }
        }
    }
    DisposableEffect(web) {
        NourControl.reload = { web.reload() }
        NourControl.back = { if (web.canGoBack()) { web.goBack(); true } else false }
        onDispose { NourControl.reload = null; NourControl.back = null; CookieManager.getInstance().flush() }
    }
    Box(Modifier.fillMaxSize()) {
        AndroidView({ web }, Modifier.fillMaxSize())
        if (progress in 1..99) LinearProgressIndicator(progress = { progress / 100f }, Modifier.fillMaxWidth().height(3.dp), color = P.owl, trackColor = P.mainL)
    }
}
