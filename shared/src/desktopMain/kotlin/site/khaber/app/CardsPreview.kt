package site.khaber.app

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.jetbrains.skia.EncodedImageFormat
import site.khaber.app.cards.*
import java.io.File

/** اختبار «كروت الأسئلة» على المنصة المحلية: صف + جلسة بصيغة الموقع، مسح مُحاكى، ثم صور الشاشات */
fun main(args: Array<String>) {
    val base = args.getOrElse(0) { "http://localhost:8787" }
    val out = File(args.getOrElse(1) { "/tmp/cards_prev" }).apply { mkdirs() }
    val host = PreviewHost(base)
    var st: AppState? = null
    val portrait = ImageComposeScene(390 * 3, 844 * 3, Density(3f)) { KhabeerApp(host) { st = it } }
    fun pump(scene: ImageComposeScene, ms: Long) { val end = System.currentTimeMillis() + ms; while (System.currentTimeMillis() < end) { scene.render(System.nanoTime()); Thread.sleep(40) } }
    fun shot(scene: ImageComposeScene, name: String) { pump(scene, 400); File(out, "$name.png").writeBytes(scene.render(System.nanoTime()).encodeToData(EncodedImageFormat.PNG)!!.bytes); println("shot $name") }
    pump(portrait, 500)
    runBlocking { println("login: " + (st!!.login("mohamed", "Bio@2026x") ?: "ok")) }
    var n = 0; while (n++ < 200 && (st!!.syncing || st!!.lessons.isEmpty())) pump(portrait, 150)
    val s = st!!
    val names = listOf("أحمد البلوشي", "سالم الكعبي", "مريم الشامسي", "خالد النعيمي", "فاطمة المقبالي")
    val (cid, sid) = runBlocking {
        val (cid, _) = s.api.saveDoc("cclass", buildJsonObject {
            put("title", "الحادي عشر / 1"); put("course", "الأحياء|الحادي عشر"); put("subject", "الأحياء"); put("grade", "الحادي عشر"); put("mode", "students")
            putJsonArray("students") { names.forEachIndexed { i, f -> addJsonObject { put("n", i + 1); put("full", f); put("name", f) } } }
        })
        // جلسة كما يبنيها الموقع: 4 أسئلة اختيار من متعدد من بنك الصف
        val b = s.api.getJson("/api/quiz/bank?key=" + "الأحياء|الحادي عشر".encodeUrlT())
        val qs = b.arr("items").filter { it.s("type") == "mcq" && it.list("choices").size in 2..4 }.take(4).map { q ->
            buildJsonObject { put("stem", q.s("stem")); put("choices", q["choices"]!!); put("correct", q.i("correct")); put("lesson_id", q.i("lesson_id")); put("lesson", "درس"); put("qid", q["qid"] ?: JsonPrimitive("x")); put("table", q["table"] ?: JsonNull) }
        }
        val (sid, _) = s.api.saveDoc("csession", buildJsonObject {
            put("title", "مراجعة — الحادي عشر / 1"); put("classId", cid); put("className", "الحادي عشر / 1"); put("course", "الأحياء|الحادي عشر")
            put("subject", "الأحياء"); put("grade", "الحادي عشر"); put("date", "2026/11/28"); put("questions", JsonArray(qs)); put("answers", JsonObject(emptyMap())); put("cur", 0); put("reveal", false)
        })
        cid to sid
    }
    println("class=$cid session=$sid")
    s.open(Screen.Cards); pump(portrait, 1500); shot(portrait, "c1-home")
    s.stack.clear(); s.open(Screen.CardsGen(cid)); pump(portrait, 1500); shot(portrait, "c2-generate")
    s.stack.clear(); s.open(Screen.CardsStart(sid)); pump(portrait, 1200); shot(portrait, "c3-start")

    // ---- المسح المُحاكى عبر LiveSession نفسها ----
    val scope = CoroutineScope(Dispatchers.Default)
    val sess = runBlocking { CSession(s.api.quizDoc(sid)) }
    val cls = runBlocking { CClass(s.api.quizDoc(cid)) }
    val live = LiveSession(s, sess, cls, scope)
    fun hit(n: Int, ans: Int, x: Float) = CardDetector.Hit(n, ans, listOf(floatArrayOf(x, 300f), floatArrayOf(x + 120, 300f), floatArrayOf(x + 120, 420f), floatArrayOf(x, 420f)), 120f)
    val plan = listOf(  // سؤال ← (طالب، إجابة)
        listOf(1 to 0, 2 to 1, 3 to sess.questions[0].correct, 4 to sess.questions[0].correct),
        listOf(1 to sess.questions[1].correct, 2 to sess.questions[1].correct, 5 to 3),
        listOf(3 to sess.questions[2].correct),
    )
    plan.forEachIndexed { qi, ans ->
        if (qi > 0) { live.next(); Thread.sleep(1600) }
        repeat(4) { ans.forEachIndexed { i, (n0, a) -> }; live.onFrame(ans.mapIndexed { i, (n0, a) -> hit(n0, a, 60f + i * 200) }, 1280, 720); Thread.sleep(110) }
        // بطاقة عابرة بقراءة واحدة لا تُحتسب
        if (qi == 2) live.onFrame(listOf(hit(5, 1, 900f)), 1280, 720)
    }
    val closed = runBlocking { live.close() }
    println("closed=$closed answers=${sess.answers}")
    File(out, "answers.json").writeText(sess.toJson()["answers"].toString())
    File(out, "ids.txt").writeText("$cid $sid")
    s.stack.clear(); s.open(Screen.CardsResults(sid)); pump(portrait, 1500); shot(portrait, "c4-results")
    // شاشة المسح بالعرض (بلا كاميرا على الكمبيوتر)
    val land = ImageComposeScene(844 * 3, 390 * 3, Density(3f)) { KhabeerApp(host) { st = it } }
    pump(land, 800); st!!.phase = Phase.Main; st!!.stack.clear(); st!!.open(Screen.CardsLive(sid)); pump(land, 2000); shot(land, "c5-live")
    portrait.close(); land.close(); scope.cancel()
    kotlin.system.exitProcess(0)
}
private fun String.encodeUrlT(): String = java.net.URLEncoder.encode(this, "UTF-8")
