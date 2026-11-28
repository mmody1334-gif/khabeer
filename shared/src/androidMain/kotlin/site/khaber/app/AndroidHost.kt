package site.khaber.app

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.widget.Toast
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import java.io.File
import java.security.MessageDigest
import java.util.Calendar

actual fun createHttpClient(): HttpClient = HttpClient(OkHttp) {
    expectSuccess = false
    install(HttpTimeout) { requestTimeoutMillis = 60_000; connectTimeoutMillis = 15_000 }
}

/** تطبيق أندرويد. التخزين في نفس ملف إعدادات التطبيق السابق («tahdir») فتبقى بيانات أداة نور بعد التحديث. */
class AndroidHost(
    private val ctx: Context,
    private val window: () -> android.view.Window?,
    override val siteUrl: String,
    override val versionCode: Int,
    override val versionName: String,
) : Host {
    val prefs = ctx.getSharedPreferences("tahdir", Context.MODE_PRIVATE)
    private val cacheDir = File(ctx.filesDir, "khabeer").apply { mkdirs() }
    private val host = Uri.parse(siteUrl).host ?: "khaber.site"

    override val deviceModel: String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
    @SuppressLint("HardwareIds")
    override val deviceFp: String = run {
        val id = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID) ?: deviceModel
        MessageDigest.getInstance("SHA-256").digest(("khabeer:" + id).toByteArray()).joinToString("") { "%02x".format(it) }.take(32)
    }
    override val userAgent: String = runCatching { WebSettings.getDefaultUserAgent(ctx) }.getOrDefault("Mozilla/5.0 (Linux; Android)") + " " + APP_UA

    override fun get(key: String): String? = prefs.getString("app_$key", null)
    override fun put(key: String, value: String?) { prefs.edit().apply { if (value == null) remove("app_$key") else putString("app_$key", value) }.apply() }
    override fun readCache(name: String): String? = File(cacheDir, name).takeIf { it.exists() && it.length() > 0 }?.readText()
    override fun writeCache(name: String, text: String) { File(cacheDir, name).writeText(text) }

    override fun cookie(name: String): String? = runCatching {
        CookieManager.getInstance().getCookie("https://$host")?.split(";")?.map { it.trim() }?.firstOrNull { it.startsWith("$name=") }?.substringAfter("=")
    }.getOrNull()

    override fun setSessionCookies(sid: String?, did: String?) {
        val cm = CookieManager.getInstance(); cm.setAcceptCookie(true)
        val base = "https://$host"
        if (sid.isNullOrBlank()) cm.setCookie(base, "sid=; Path=/; Max-Age=0; Secure")
        else cm.setCookie(base, "sid=$sid; Path=/; Max-Age=${60 * 86400}; Secure; HttpOnly; SameSite=Lax")
        if (!did.isNullOrBlank()) cm.setCookie(base, "did=$did; Path=/; Max-Age=63072000; Secure; HttpOnly; SameSite=Lax")
        cm.flush()
    }

    override fun copyText(text: String) {
        (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("خبير", text))
    }
    override fun openExternal(url: String) {
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    override fun toast(text: String) { Toast.makeText(ctx, text, Toast.LENGTH_SHORT).show() }
    override fun nowMillis(): Long = System.currentTimeMillis()
    override fun download(url: String, name: String) {
        runCatching {
            val r = android.app.DownloadManager.Request(android.net.Uri.parse(url))
                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, name.replace(Regex("[\\\\/:*?\"<>|]"), "_"))
                .setTitle(name)
            (ctx.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager).enqueue(r)
            toast("جارٍ التنزيل: $name")
        }.onFailure { openExternal(url) }
    }
    private val engineWeb by lazy { EngineWeb(ctx, siteUrl) }
    override suspend fun engine(expr: String): String = engineWeb.eval(expr)
    override fun hour(): Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    private val tone by lazy { runCatching { android.media.ToneGenerator(android.media.AudioManager.STREAM_NOTIFICATION, 40) }.getOrNull() }
    override fun beep() {
        runCatching { tone?.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 60) }
        runCatching {
            val v = if (Build.VERSION.SDK_INT >= 31) (ctx.getSystemService(android.os.VibratorManager::class.java)).defaultVibrator
                    else @Suppress("DEPRECATION") ctx.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(android.os.VibrationEffect.createOneShot(25, 120)) else @Suppress("DEPRECATION") v.vibrate(25)
        }
    }
    override fun share(text: String) {
        runCatching { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    override fun setDarkStatusIcons(dark: Boolean) {
        val w = window() ?: return
        androidx.core.view.WindowCompat.getInsetsController(w, w.decorView).isAppearanceLightStatusBars = dark
    }

    // ---------- أداة نور: آخر نسخة من المنصة، محفوظة على الجهاز ----------
    @Volatile var toolSrc: String? = prefs.getString("tool_src", null)
        ?: runCatching { ctx.assets.open("tool.user.js").bufferedReader().readText() }.getOrNull()

    fun refreshTool() = Thread {
        runCatching {
            val c = java.net.URL("$siteUrl/tool/tahdir-noor.user.js").openConnection() as java.net.HttpURLConnection
            c.connectTimeout = 8000; c.readTimeout = 8000
            if (c.responseCode == 200) {
                val s = c.inputStream.bufferedReader().readText()
                if (s.contains("==UserScript==")) { toolSrc = s; prefs.edit().putString("tool_src", s).apply() }
            }
            c.disconnect()
        }
    }.start()

    companion object {
        /** «TahdirApp» يفعّل وضع التطبيق في الموقع وفي أداة نور؛ «KhabeerNative» = التطبيق الأصلي */
        const val APP_UA = "TahdirApp/2 KhabeerNative/2"
    }
}
