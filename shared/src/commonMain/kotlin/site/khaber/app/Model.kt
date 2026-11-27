package site.khaber.app

import kotlinx.serialization.json.*

val J = Json { ignoreUnknownKeys = true; isLenient = true }

fun JsonObject.s(k: String): String = when (val v = this[k]) {
    null, JsonNull -> ""
    is JsonPrimitive -> v.content
    is JsonArray -> v.joinToString("\n") { (it as? JsonPrimitive)?.content ?: it.toString() }
    else -> v.toString()
}
fun JsonObject.i(k: String, d: Int = 0): Int = (this[k] as? JsonPrimitive)?.content?.toDoubleOrNull()?.toInt() ?: d
fun JsonObject.b(k: String): Boolean = (this[k] as? JsonPrimitive)?.content == "true"
fun JsonObject.list(k: String): List<String> = (this[k] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content } ?: emptyList()
fun JsonObject.obj(k: String): JsonObject = this[k] as? JsonObject ?: JsonObject(emptyMap())
fun JsonObject.arr(k: String): List<JsonObject> = (this[k] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()

/** درس كما يرسله /api/lessons — الحقول كلها نصوص، ونحتفظ بالأصل لحقول نادرة */
class Lesson(val raw: JsonObject, val order: Int) {
    val id: Long = (raw["id"] as? JsonPrimitive)?.content?.toDoubleOrNull()?.toLong() ?: 0
    val subject: String = raw.s("subject")
    val grade: String = raw.s("grade").removePrefix("الصف ").trim()
    val unit: String = raw.s("unit")
    val unitName: String = raw.s("unit_name")
    val title: String = raw.s("title")
    val term: Int = raw.i("term", 1).let { if (it == 2) 2 else 1 }
    val lessonNoRaw: Int = raw.i("lesson_no")
    val key: String get() = "$subject|${raw.s("grade")}"
    val courseKey: String = "$subject|$grade"
    fun f(k: String) = raw.s(k)
    val isEmpty: Boolean get() = f("pre_learning").isBlank() && f("outcomes").isBlank() && f("activities_teach").isBlank()
    val unitNum: Int get() = unit.toIntOrNull() ?: 0
}

data class Course(val key: String, val subject: String, val grade: String, val t1: Int, val t2: Int, val t2Status: String)
data class Tool(val key: String, val title: String, val sub: String, val route: String, val icon: String, val tone: String)
data class Flow(val id: String, val name: String, val sub: String, val keys: List<String>)

class Manifest(val raw: JsonObject) {
    val user = raw.obj("user")
    val userName = user.s("name")
    val role = user.s("role")
    val pending = user.b("pending")
    val paidUntil: Long? = (user["paid_until"] as? JsonPrimitive)?.content?.toDoubleOrNull()?.toLong()
    val term = raw.obj("term")
    val currentTerm = term.i("current", 1)
    fun termLabel(n: Int) = term.obj("labels").s(n.toString()).ifBlank { if (n == 2) "الفصل الثاني" else "الفصل الأول" }
    val year = term.s("year")
    val badge2 = term.s("badge2")
    val note2 = term.s("note2")
    val courses = raw.arr("courses").map { Course(it.s("key"), it.s("subject"), it.s("grade"), it.i("t1"), it.i("t2"), it.s("t2_status")) }
    val tools = raw.arr("tools").map { Tool(it.s("key"), it.s("title"), it.s("sub"), it.s("route"), it.s("icon"), it.s("tone")) }
    val flow = raw.arr("flow").map { Flow(it.s("id"), it.s("name"), it.s("sub"), it.list("keys")) }
    val homeTools = raw.list("home_tools")
    val prep = raw.obj("prep")
    val app = raw.obj("app")
    val minVersion = app.i("min_version", 1)
    val updateUrl = app.s("update_url")
    val banner = app.s("banner")
    val webCss = raw.s("web_css")
    val toolVersion = raw.obj("tool").s("version")
}

data class Notice(val id: Long, val title: String, val body: String, val url: String, val at: Long, val read: Boolean)

val GRADE_ORDER = listOf("الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر")
val GRADE_NUM = mapOf("الخامس" to 5, "السادس" to 6, "السابع" to 7, "الثامن" to 8, "التاسع" to 9, "العاشر" to 10, "الحادي عشر" to 11, "الثاني عشر" to 12)
fun gradeShort(g: String) = GRADE_NUM[g.removePrefix("الصف ").trim()]?.toString() ?: g

/** تطبيع عربي بسيط للبحث (كما في الموقع): الهمزات والتاء المربوطة والتشكيل */
fun normAr(s: String): String = s.lowercase()
    .replace(Regex("[ً-ٟـ]"), "")
    .replace(Regex("[إأآا]"), "ا").replace('ة', 'ه').replace('ى', 'ي').trim()
