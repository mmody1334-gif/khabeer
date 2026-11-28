package site.khaber.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.webkit.*
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

actual fun decodeImage(bytes: ByteArray): ImageBitmap? = runCatching { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }.getOrNull()

/**
 * محرّك الاختبارات: متصفح مخفي يفتح /app/quiz-engine من الموقع (بنفس جلسة التطبيق)،
 * فتعمل قواعد «وثيقة تقويم تعلم الطلبة» وخوارزمية التكوين كما في الموقع حرفيًّا، وتتحدث معه بلا تحديث للتطبيق.
 */
internal class EngineWeb(private val ctx: Context, private val siteUrl: String) {
    private val main = Handler(Looper.getMainLooper())
    private var web: WebView? = null
    private var ready: CompletableDeferred<Unit>? = null
    private val pending = ConcurrentHashMap<Int, CompletableDeferred<String>>()
    private val seq = AtomicInteger()

    inner class Keb {
        @JavascriptInterface fun done(id: Int, s: String) { pending.remove(id)?.complete(s) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun create(): CompletableDeferred<Unit> {
        val d = CompletableDeferred<Unit>()
        val w = WebView(ctx)
        w.settings.javaScriptEnabled = true; w.settings.domStorageEnabled = true
        w.settings.userAgentString = "${w.settings.userAgentString} ${AndroidHost.APP_UA}"
        w.addJavascriptInterface(Keb(), "KEB")
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript("typeof window.KE==='object'") { r ->
                    if (r == "true") d.complete(Unit)
                    else d.completeExceptionally(ApiError(401, if (url.contains("/quiz-engine")) "تعذّر تشغيل محرّك الاختبارات" else "انتهت الجلسة — سجّل الدخول من جديد"))
                }
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) d.completeExceptionally(ApiError(0, "تعذّر الاتصال بالمنصة. تأكد من الإنترنت."))
            }
        }
        web = w
        w.loadUrl(siteUrl.trimEnd('/') + "/app/quiz-engine")
        return d
    }

    private suspend fun ensure() {
        val r = withContext(Dispatchers.Main) { ready ?: create().also { ready = it } }
        try { withTimeout(30_000) { r.await() } } catch (e: Throwable) {
            withContext(Dispatchers.Main) { web?.destroy(); web = null; ready = null }
            throw if (e is TimeoutCancellationException) ApiError(0, "المنصة بطيئة الآن — أعد المحاولة") else e
        }
    }

    suspend fun eval(expr: String): String {
        ensure()
        val id = seq.incrementAndGet()
        val d = CompletableDeferred<String>(); pending[id] = d
        val js = "(function(){Promise.resolve().then(function(){return ($expr);}).then(function(r){KEB.done($id,JSON.stringify({ok:r===undefined?null:r}));}," +
            "function(e){KEB.done($id,JSON.stringify({err:String(e&&e.message||e)}));});})();"
        main.post { web?.evaluateJavascript(js, null) ?: d.complete("{\"err\":\"المحرّك غير جاهز\"}") }
        return try { withTimeout(90_000) { d.await() } } catch (e: TimeoutCancellationException) { pending.remove(id); "{\"err\":\"انتهت المهلة — أعد المحاولة\"}" }
    }
}

/** معاينة عرض Google Drive: متصفح بسيط بالتكبير، وروابط خارج Google تُفتح خارجيًّا */
@androidx.compose.runtime.Composable
actual fun DocPreview(host: Host, url: String, modifier: androidx.compose.ui.Modifier) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var progress by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(0) }
    val web = androidx.compose.runtime.remember(url) {
        newWebView(ctx, zoom = true).also { w ->
            w.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                    val h = req.url.host ?: ""
                    if (h.endsWith("google.com") || h.endsWith("googleusercontent.com") || h.endsWith("gstatic.com")) return false
                    host.openExternal(req.url.toString()); return true
                }
            }
            w.webChromeClient = object : WebChromeClient() { override fun onProgressChanged(v: WebView, p: Int) { progress = p } }
            w.loadUrl(url)
        }
    }
    androidx.compose.runtime.DisposableEffect(web) { onDispose { web.stopLoading(); web.destroy() } }
    androidx.compose.foundation.layout.Box(modifier) {
        androidx.compose.ui.viewinterop.AndroidView({ web }, androidx.compose.ui.Modifier.fillMaxSize())
        if (progress in 1..99) androidx.compose.material3.LinearProgressIndicator(
            progress = { progress / 100f }, modifier = androidx.compose.ui.Modifier.fillMaxWidth(), color = site.khaber.app.ui.P.main,
        )
    }
}
