package site.khaber.app.cards

import kotlinx.serialization.json.*
import site.khaber.app.*

/** صف (kind=cclass): الطلاب مرقّمون بترتيب الكشف = رقم البطاقة */
class CClass(val raw: JsonObject) {
    val id = raw.s("id").toDoubleOrNull()?.toLong() ?: 0L
    val title = raw.s("title")
    val course = raw.s("course")
    val subject = raw.s("subject")
    val grade = raw.s("grade")
    val groups = raw.s("mode") == "groups"
    data class Student(val n: Int, val name: String)
    val students: List<Student> = raw.arr("students").map { Student(it.i("n"), it.s("name").ifBlank { it.s("full") }) }.sortedBy { it.n }
}

data class CQuestion(val stem: String, val choices: List<String>, val correct: Int, val table: JsonObject?, val lesson: String, val raw: JsonObject)

/** جلسة (kind=csession): الأسئلة + إجابات كل طالب لكل سؤال، بنفس صيغة الموقع */
class CSession(var raw: JsonObject) {
    var id = raw.s("id").toDoubleOrNull()?.toLong() ?: 0L
    val title get() = raw.s("title")
    val classId = raw.s("classId").toDoubleOrNull()?.toLong() ?: 0L
    val className = raw.s("className")
    var updatedAt = raw.s("updated_at").toDoubleOrNull()?.toLong() ?: 0L
    val questions: List<CQuestion> = raw.arr("questions").map {
        CQuestion(it.s("stem"), it.list("choices"), it.i("correct"), it["table"] as? JsonObject, it.s("lesson"), it)
    }
    /** answers[سؤال][رقم الطالب] = 0..3 */
    val answers: MutableMap<Int, MutableMap<Int, Int>> = HashMap<Int, MutableMap<Int, Int>>().also { m ->
        raw.obj("answers").forEach { (q, v) ->
            val inner = HashMap<Int, Int>(); (v as? JsonObject)?.forEach { (n, a) -> (a as? JsonPrimitive)?.content?.toDoubleOrNull()?.toInt()?.let { inner[n.toIntOrNull() ?: return@forEach] = it } }
            q.toIntOrNull()?.let { m[it] = inner }
        }
    }
    var cur = raw.i("cur").coerceIn(0, (questions.size - 1).coerceAtLeast(0))
    var reveal = raw.b("reveal")

    fun toJson(): JsonObject = JsonObject(raw + mapOf(
        "id" to JsonPrimitive(id),
        "answers" to buildJsonObject { answers.toSortedMap().forEach { (q, m) -> putJsonObject(q.toString()) { m.toSortedMap().forEach { (n, a) -> put(n.toString(), a) } } } },
        "cur" to JsonPrimitive(cur), "reveal" to JsonPrimitive(reveal),
    ))
}

/** نتائج الجلسة: كما في calc() بالموقع — تُحسب النسب من الأسئلة التي عُرضت فعلًا فقط */
class CResults(s: CSession, c: CClass?) {
    data class Q(val i: Int, val n: Int, val ok: Int, val dist: List<Int>) { val p get() = if (n > 0) ok.toFloat() / n else 0f }
    data class St(val n: Int, val name: String, val ok: Int, val answered: Int)
    val qs = s.questions.mapIndexed { i, q ->
        val a = s.answers[i].orEmpty().values
        Q(i, a.size, a.count { it == q.correct }, q.choices.indices.map { k -> a.count { it == k } })
    }
    val asked = qs.filter { it.n > 0 }.map { it.i }
    val students = (c?.students ?: emptyList()).map { st ->
        St(st.n, st.name, asked.count { i -> s.answers[i]?.get(st.n) == s.questions[i].correct }, asked.count { i -> s.answers[i]?.containsKey(st.n) == true })
    }
    /** متوسط الصف كما في الموقع: متوسط نسب الطلاب الحاضرين (درجة الطالب ÷ الأسئلة المعروضة) */
    val avg: Float get() { val pr = students.filter { it.answered > 0 }; return if (pr.isEmpty() || asked.isEmpty()) 0f else pr.sumOf { it.ok.toDouble() / asked.size }.toFloat() / pr.size }
}
