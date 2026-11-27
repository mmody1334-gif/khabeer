package site.khaber.app

import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import kotlinx.coroutines.*
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

/** يرسم شاشات التطبيق إلى صور PNG، متصلًا بالمنصة (المحلية) بحساب حقيقي. */
class PreviewHost(override val siteUrl: String) : Host {
    private val kv = HashMap<String, String>()
    private val cache = HashMap<String, String>()
    override val versionCode = 1; override val versionName = "2.preview"
    override val deviceModel = "Preview"; override val deviceFp = "preview"; override val userAgent = "Mozilla/5.0 (Linux; Android 14) TahdirApp/2 KhabeerNative/2"
    override fun get(key: String) = kv[key]
    override fun put(key: String, value: String?) { if (value == null) kv.remove(key) else kv[key] = value }
    override fun readCache(name: String) = cache[name]?.takeIf { it.isNotEmpty() }
    override fun writeCache(name: String, text: String) { cache[name] = text }
    override fun cookie(name: String): String? = null
    override fun setSessionCookies(sid: String?, did: String?) {}
    override fun copyText(text: String) {}
    override fun openExternal(url: String) {}
    override fun toast(text: String) { println("TOAST: $text") }
    override fun nowMillis() = System.currentTimeMillis()
    override fun hour() = 9
}

fun main(args: Array<String>) {
    val base = args.getOrElse(0) { "http://127.0.0.1:8787" }
    val out = File(args.getOrElse(1) { "previews" }).apply { mkdirs() }
    val user = args.getOrElse(2) { "mohamed" }; val pass = args.getOrElse(3) { "Bio@2026x" }
    val dark = args.getOrNull(4) == "dark"
    val host = PreviewHost(base)
    var st: AppState? = null
    val scene = ImageComposeScene(390 * 3, 844 * 3, Density(3f)) { KhabeerApp(host) { st = it } }
    fun shot(name: String) {
        repeat(3) { scene.render(System.nanoTime()); Thread.sleep(150) }
        val img = scene.render(System.nanoTime())
        File(out, "$name.png").writeBytes(img.encodeToData(EncodedImageFormat.PNG)!!.bytes)
        println("shot $name")
    }
    fun pump(ms: Long) { val end = System.currentTimeMillis() + ms; while (System.currentTimeMillis() < end) { scene.render(System.nanoTime()); Thread.sleep(50) } }
    pump(800); shot("0-login")
    runBlocking { println("login: " + (st!!.login(user, pass) ?: "ok")) }
    var n = 0; while (n++ < 200 && (st!!.syncing || st!!.lessons.isEmpty())) pump(200)
    println("lessons=${st!!.lessons.size} courses=${st!!.courses.size} manifest=${st!!.manifest != null} err=${st!!.syncError}")
    val s = st!!
    s.courses.firstOrNull { it.first == "الكيمياء" && it.second == "العاشر" }?.let { s.pickCourse("${it.first}|${it.second}") }
    pump(500); shot("1-home")
    s.setTerm(2); pump(400); shot("2-home-term2")
    s.selectTab(Tab.Lessons); pump(500); shot("3-lessons-term2")
    s.setTerm(1); pump(400); shot("4-lessons-term1")
    val l = s.lessonsOf("الكيمياء", "العاشر", 2).firstOrNull() ?: s.lessons.first()
    s.openLesson(l); pump(600); shot("5-lesson")
    s.stack.clear(); s.selectTab(Tab.Term); pump(500); shot("6-term")
    s.selectTab(Tab.Account); pump(400); shot("7-account")
    s.open(Screen.Tools); pump(400); shot("8-tools")
    s.stack.clear()
    s.sendPrep(l); s.nourProgress = NourProgress(onPrep = true, title = true, editors = 5, editorsTotal = 8, outcomes = true); pump(600); shot("9-nour")
    // نص الإرسال: يُطبع للمقارنة مع buildCopyJson في الموقع
    File(out, "payload_prep.json").writeText(Payload.prep(l, s.lessons, s.manifest))
    File(out, "payload_hw.json").writeText(Payload.homework(l, s.lessons))
    File(out, "lesson_id.txt").writeText(l.id.toString())
    scene.close()
    kotlin.system.exitProcess(0)
}
