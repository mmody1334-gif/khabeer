package site.khaber.app.quiz

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import site.khaber.app.*

/** مقرر كما تعيده /api/courses */
data class QCourse(val json: JsonObject) {
    val key get() = json.s("key"); val subject get() = json.s("subject"); val grade get() = json.s("grade")
    val items get() = json.i("quiz_items")
}

/** درس في بنك المقرر (من محرّك الموقع) */
data class QLesson(val id: Long, val unit: String, val unitName: String, val title: String, val term: Int, val n: Int)
data class QUnit(val unit: String, val name: String, val n: Int)
class QInfo(val o: JsonObject) {
    val lessons = o.arr("lessons").map { QLesson(it.i("id").toLong(), it.s("unit"), it.s("unit_name"), it.s("title"), it.i("term", 1), it.i("n")) }
    val units = o.arr("units").map { QUnit(it.s("unit"), it.s("name"), it.i("n")) }
    val specText get() = o.s("specText")
    val hwText get() = o.obj("hw").let { if (it.b("none")) "" else o.s("hwText") }
    val hwNone get() = o.obj("hw").b("none")
    val quizTotal get() = o.obj("quizSpec").i("total")
}

/** فحص واحد من فحوص الوثيقة: [ناجح؟، النص] */
data class QCheck(val ok: Boolean, val text: String)
data class QMeta(val type: String, val ao: String, val lesson: String, val lv: Int)

/**
 * واجهة محرّك الاختبارات. المحرّك نفسه هو كود صفحة الاختبارات في الموقع (spec/assemble/checks…)
 * يعمل داخل متصفح مخفي، فالقواعد في مكان واحد ويحدّثها الموقع.
 */
class QuizEngine(private val st: AppState) {
    private val lock = Mutex()
    private val infos = HashMap<String, QInfo>()
    var qno: List<String> = listOf("الأول", "الثاني", "الثالث", "الرابع"); private set
    var levels: List<String> = listOf("المستوى الأساسي", "المستوى المتوسط", "المستوى الإثرائي"); private set

    private fun q(s: String?) = if (s == null) "null" else JsonPrimitive(s).toString()

    private suspend fun raw(expr: String): JsonElement {
        val o = J.parseToJsonElement(st.host.engine(expr)).jsonObject
        (o["err"] as? JsonPrimitive)?.let { throw ApiError(0, it.content) }
        return o["ok"] ?: JsonNull
    }

    private suspend fun ensure(c: QCourse): QInfo {
        val s = raw("KE.state()").jsonObject
        if (s.s("u").isBlank()) {
            raw("KE.init(${q(st.api.base)},${q(st.api.sid)})")
            runCatching { qno = (raw("KE.qno()") as JsonArray).map { it.jsonPrimitive.content } }
            runCatching { levels = (raw("KE.levels()") as JsonArray).map { it.jsonObject.s("name") } }
        }
        val have = infos[c.key]
        if (s.s("key") != c.key || have == null) return QInfo(raw("KE.load(${q(c.key)},${c.json})").jsonObject).also { infos[c.key] = it }
        return have
    }

    suspend fun info(c: QCourse): QInfo = lock.withLock { ensure(c) }

    /** نتيجة عملية على الورقة: الورقة الجديدة أو رسالة خطأ */
    data class R(val doc: JsonObject?, val error: String?, val msg: String?)
    private fun res(e: JsonElement) = (e as JsonObject).let { R(it["doc"] as? JsonObject, it.s("error").ifBlank { null }, it.s("msg").ifBlank { null }) }

    suspend fun make(c: QCourse, opts: JsonObject): R = lock.withLock { ensure(c); res(raw("KE.make($opts)")) }
    suspend fun remake(c: QCourse, doc: JsonObject): R = lock.withLock { ensure(c); res(raw("KE.remake($doc)")) }
    suspend fun swap(c: QCourse, doc: JsonObject, i: Int): R = lock.withLock { ensure(c); res(raw("KE.swap($doc,$i)")) }

    /** الفحوص والعنوان وبيانات كل مفردة دفعة واحدة */
    data class Review(val checks: List<QCheck>, val title: String, val meta: List<QMeta>, val total: Int)
    suspend fun review(c: QCourse, doc: JsonObject): Review = lock.withLock {
        ensure(c)
        val o = raw("(function(d){return {c:KE.checks(d),t:KE.title(d),m:KE.meta(d),s:KE.total(d)};})($doc)").jsonObject
        Review(
            (o["c"] as? JsonArray).orEmpty().map { val a = it.jsonArray; QCheck(a[0].jsonPrimitive.boolean, a[1].jsonPrimitive.content) },
            o.s("t"),
            o.arr("m").map { QMeta(it.s("type"), it.s("ao"), it.s("lesson"), it.i("lv", -1)) },
            o.i("s"),
        )
    }
}

/** الملف المفتوح الآن في شاشة الورقة */
class QuizCur(val course: QCourse, doc: JsonObject, dirty: Boolean = true) {
    var doc by androidx.compose.runtime.mutableStateOf(doc)
    var dirty by androidx.compose.runtime.mutableStateOf(dirty)
    var askLeave by androidx.compose.runtime.mutableStateOf(false)
    val hw get() = doc.s("kind") == "homework"
    val id: Long? get() = doc.s("id").toDoubleOrNull()?.toLong()?.takeIf { it > 0 }
    val items: List<JsonObject> get() = doc.arr("items")
    fun withItems(l: List<JsonElement>): JsonObject = JsonObject(doc + ("items" to (JsonArray(l) as JsonElement)))
}
