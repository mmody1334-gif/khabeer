package site.khaber.app

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.jetbrains.skia.EncodedImageFormat
import site.khaber.app.quiz.*
import java.io.File

/** اختبار المرحلة 2 على المنصة المحلية: محرّك الموقع نفسه (node) + شاشات التطبيق */
fun main(args: Array<String>) {
    val base = args.getOrElse(0) { "http://localhost:8787" }
    val out = File(args.getOrElse(1) { "/tmp/quiz_prev" }).apply { mkdirs() }
    val host = PreviewHost(base).apply { node = NodeEngine("/home/claude/khabeer/site/dist/quiz_engine.js") }
    var st: AppState? = null
    val scene = ImageComposeScene(390 * 3, 844 * 3, Density(3f)) { KhabeerApp(host) { st = it } }
    fun pump(ms: Long) { val end = System.currentTimeMillis() + ms; while (System.currentTimeMillis() < end) { scene.render(System.nanoTime()); Thread.sleep(40) } }
    fun shot(name: String) { pump(500); File(out, "$name.png").writeBytes(scene.render(System.nanoTime()).encodeToData(EncodedImageFormat.PNG)!!.bytes); println("shot $name") }
    fun waitFor(ms: Long = 20000, cond: () -> Boolean) { val end = System.currentTimeMillis() + ms; while (!cond() && System.currentTimeMillis() < end) pump(150) }
    pump(500)
    runBlocking { println("login: " + (st!!.login("mohamed", "Bio@2026x") ?: "ok")) }
    waitFor { !st!!.syncing && st!!.lessons.isNotEmpty() }
    val s = st!!
    host.put("quiz_course", "الأحياء|الحادي عشر")
    s.open(Screen.Quiz(false)); pump(4000); shot("q1-home")
    val courses = runBlocking { s.api.getJson("/api/courses").arr("courses").map { QCourse(it) } }
    val c = courses.first { it.key == "الأحياء|الحادي عشر" }
    val eng = s.quizEngine
    val info = runBlocking { eng.info(c) }
    val ls = info.lessons.filter { it.n > 0 }.take(3).map { it.id }
    fun mk(mode: String, extra: JsonObjectBuilder.() -> Unit = {}) = runBlocking { eng.make(c, buildJsonObject { put("mode", mode); putJsonArray("lessons") { ls.forEach { add(it) } }; extra() }) }
    val r = mk("quiz"); println("quiz error=${r.error} items=${r.doc?.arr("items")?.size}")
    val rv = runBlocking { eng.review(c, r.doc!!) }
    println("checks: " + rv.checks.joinToString(" | ") { (if (it.ok) "✓ " else "✗ ") + it.text } + " · title=" + rv.title + " · total=" + rv.total)
    s.quizCur = QuizCur(c, r.doc!!); s.open(Screen.QuizDoc); pump(3000); shot("q2-doc")
    // استبدال، نموذج آخر
    val sw = runBlocking { eng.swap(c, s.quizCur!!.doc, 0) }; println("swap: ${sw.msg ?: sw.error}")
    val rm = runBlocking { eng.remake(c, JsonObject(s.quizCur!!.doc)) }; println("remake: ${rm.msg ?: rm.error}")
    // حفظ ثم قراءة كما يقرؤها الموقع
    val (id, _) = runBlocking { s.api.saveDoc("quiz", JsonObject(r.doc + ("title" to (JsonPrimitive(rv.title) as JsonElement)))) }
    val back = runBlocking { s.api.getJson("/api/quizzes/$id").obj("quiz") }
    println("saved id=$id kind=${back.s("kind")} items=${back.obj("data").arr("items").size} title=${back.s("title")}")
    File(out, "saved_id.txt").writeText("$id")
    // ورقة بصور وجدول: نبحث عن مفردة فيها img
    val withImg = info.lessons.filter { it.n > 0 }.map { it.id }
    val big = runBlocking { eng.make(c, buildJsonObject { put("mode", "review"); put("unit", info.units[0].unit); put("reviewCount", 0) }) }
    println("review items=${big.doc?.arr("items")?.size} error=${big.error}")
    big.doc?.let { d -> val imgs = d.arr("items").filter { it.s("img").isNotBlank() }; if (imgs.isNotEmpty()) { s.quizCur = QuizCur(c, JsonObject(d + ("items" to (JsonArray(imgs.take(3)) as JsonElement)))); s.stack.removeAt(s.stack.lastIndex); s.open(Screen.QuizDoc); pump(5000); shot("q3-images") } }
    val df = mk("diff") { putJsonArray("dlv") { add(true); add(true); add(true) }; put("dn", 4) }
    println("diff items=${df.doc?.arr("items")?.size} error=${df.error}")
    df.doc?.let { s.quizCur = QuizCur(c, it); s.stack.removeAt(s.stack.lastIndex); s.open(Screen.QuizDoc); pump(3000); shot("q4-diff") }
    runBlocking { val b = s.api.bytes("/fin/chem10/04bfef5227.webp"); println("img bytes=${b?.size} decoded=${b?.let { decodeImage(it) }?.let { "${it.width}x${it.height}" }}") }
    // الواجب
    s.stack.clear(); s.open(Screen.Quiz(true)); pump(3000); shot("q5-hw-home")
    val h = runBlocking { eng.make(c, buildJsonObject { put("mode", "hw"); putJsonArray("lessons") { add(ls[0]) } }) }
    println("hw error=${h.error} items=${h.doc?.arr("items")?.size}")
    h.doc?.let { s.quizCur = QuizCur(c, it); s.open(Screen.QuizDoc); pump(3000); shot("q6-hw-doc") }
    // رجوع بورقة غير محفوظة → سؤال الحفظ
    s.handleBack(); pump(600); shot("q7-leave")
    s.stack.clear(); s.open(Screen.Quiz(false)); pump(2500)
    scene.close(); kotlin.system.exitProcess(0)
}
