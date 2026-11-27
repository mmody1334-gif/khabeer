package site.khaber.app

import kotlinx.serialization.json.*
import kotlin.random.Random

/**
 * نص الإرسال إلى نور — نسخة طبق الأصل من buildCopyJson / buildHwJson في client_app.js
 * (نفس الحقول ونفس القواعد)، حتى تعامله أداة نور كما تعامل الإرسال من الموقع تمامًا.
 * القيم الثابتة (المستوى/الاستراتيجيات/المصادر لكل مادة) تأتي من المنصة (manifest.prep).
 */
object Payload {
    fun isEn(l: Lesson) = Regex("انجليز|إنجليز|English", RegexOption.IGNORE_CASE).containsMatchIn(l.subject)

    private fun settings(m: Manifest?, subject: String): Triple<List<String>, List<String>, List<String>> {
        val def = m?.prep?.obj("def") ?: JsonObject(emptyMap())
        val sub = m?.prep?.obj("subj")?.obj(subject) ?: JsonObject(emptyMap())
        fun pick(k: String, fb: List<String>) = sub.list(k).ifEmpty { def.list(k) }.ifEmpty { fb }
        return Triple(
            pick("level", listOf("التذكُّر", "الإبداع")),
            pick("strategies", listOf("الحوار والمناقشة", "التعلم التعاوني", "التعلم التشاركي", "التعلم الذاتي")),
            pick("resources", listOf("الكتاب", "السبورة التقليدية", "جهاز عرض البيانات", "الوسائط المتعددة (سمعية - بصرية)")),
        )
    }

    /** رقم الدرس داخل وحدته: lesson_no إن وُجد، وإلا ترتيبه بين دروس الوحدة كما ترسلها المنصة */
    fun lessonNo(l: Lesson, all: List<Lesson>): Int {
        if (l.lessonNoRaw > 0) return l.lessonNoRaw
        var n = 0
        for (x in all) if (x.key == l.key && x.unit == l.unit) { n++; if (x.id == l.id) return n }
        return 0
    }

    private fun nonce() = Random.nextLong(0, Long.MAX_VALUE).toString(36).take(12)

    fun prep(l: Lesson, all: List<Lesson>, m: Manifest?): String {
        val (level, strategies, resources) = settings(m, l.subject)
        val pre = l.f("pre_learning")
        val preOnly = Regex("(^|\n)\\s*التعلم القبلي\\s*[:：][^\n]*").find(pre)?.value?.trim().orEmpty()
        val objective = when {
            isEn(l) -> l.f("outcomes").split('\n').map { it.replace(Regex("^[•◆\\-\\s]+"), "").trim() }.filter { it.isNotEmpty() }.joinToString("\n")
            l.raw.s("grade") == "الخامس" -> {
                val ol = l.f("outcomes").split('\n').map { it.trim() }.filter { it.isNotEmpty() }
                val main = ol.filter { !it.startsWith("5E", ignoreCase = true) }.ifEmpty { ol }
                main.joinToString("\n") { it.replace(Regex("^[0-9A-Za-z]+\\s*[:：]\\s*"), "") }
            }
            else -> ""
        }
        val selStr = l.raw.list("sel_strategies"); val selRes = l.raw.list("sel_resources")
        return buildJsonObject {
            put("source", "tahdir-al-aali"); put("kind", "prep")
            put("title", l.title); put("grade", l.raw.s("grade")); put("subject", l.subject)
            put("unit", l.unit); put("unit_name", l.unitName); put("lesson_no", lessonNo(l, all)); put("term", l.term)
            put("objective", objective)
            putJsonObject("fields") {
                put("lesson_vocabulary", l.f("concepts")); put("description", pre); put("pre_learning", preOnly.ifEmpty { pre })
                put("thinking_skills", l.f("activities_teach")); put("formative_assessment", l.f("formative"))
                put("closing_assessment", l.f("closing")); put("activities", l.f("homework")); put("weekly_study_plan_comments", l.f("weekly"))
            }
            put("tick_all_outcomes", true)
            putJsonObject("selects") {
                put("taxonomies", JsonArray(level.map(::JsonPrimitive)))
                put("strategies", JsonArray(selStr.ifEmpty { strategies }.map(::JsonPrimitive)))
                put("teaching_aids", JsonArray(selRes.ifEmpty { resources }.map(::JsonPrimitive)))
            }
            put("nonce", nonce())
        }.toString()
    }

    fun isMcq(l: Lesson) = l.f("hw_type") == "mcq" || (l.f("hw_type").isEmpty() && l.f("hw_q1").isBlank() && l.f("hw_q2").isBlank())

    data class HwItem(val text: String, val answer: String, val choices: List<String> = emptyList())

    fun hwItems(l: Lesson): List<HwItem> = if (isMcq(l)) {
        (1..2).mapNotNull { n ->
            val c = l.f("hw_a$n").split('\n').map { it.trim() }.filter { it.isNotEmpty() }.take(6)
            if (c.size < 2 || l.f("hw_q$n").isBlank()) null else HwItem(l.f("hw_q$n"), c[0], c)
        }
    } else (1..2).mapNotNull { n -> if (l.f("hw_q$n").isBlank()) null else HwItem(l.f("hw_q$n"), l.f("hw_a$n")) }

    fun homework(l: Lesson, all: List<Lesson>): String = buildJsonObject {
        put("source", "tahdir-al-aali"); put("kind", "homework")
        put("title", l.title); put("base_title", l.title); put("grade", l.raw.s("grade")); put("subject", l.subject)
        put("unit", l.unit); put("lesson_no", lessonNo(l, all))
        putJsonArray("items") {
            hwItems(l).forEach { h ->
                addJsonObject {
                    if (h.choices.isNotEmpty()) {
                        val mix = h.choices.shuffled()
                        put("type", "mcq"); put("text", h.text)
                        put("choices", JsonArray(mix.map(::JsonPrimitive))); put("correct", mix.indexOf(h.answer) + 1); put("answer", h.answer)
                    } else { put("text", h.text); put("answer", h.answer) }
                    put("mark", 1)
                }
            }
        }
        put("nonce", nonce())
    }.toString()

    /** نص «نسخ الكل» كما في الموقع (للصق اليدوي) */
    fun copyAll(l: Lesson, m: Manifest?): String {
        if (isEn(l) || l.subject == "اللغة العربية") {
            val e = StringBuilder("Title:\n${l.title}\n\nStrategies: ${l.f("strategies")}\nResources: ${l.f("resources")}\n\n")
            listOf("concepts" to "Concepts", "pre_learning" to "Warm-up", "activities_teach" to "Lesson Procedures", "formative" to "Formative Assessment",
                "closing" to "Closing Assessment", "homework" to "Homework", "outcomes" to "Objectives").forEach { (k, t) -> e.append("— $t —\n${l.f(k)}\n\n") }
            return e.toString().trim()
        }
        val (level, strategies, resources) = settings(m, l.subject)
        val sb = StringBuilder("العنوان:\n${l.title}\n\n")
        if (isEn(l)) sb.append("Strategies: ${l.f("strategies")}\nResources: ${l.f("resources")}\n\n")
        else sb.append("المستوى: ${level.joinToString("، ")}\nالاستراتيجيات: ${strategies.joinToString("، ")}\nالمصادر التعليمية: ${resources.joinToString("، ")}\n\n")
        ESSENTIAL.forEach { (k, label) -> if (k != "weekly" || l.f("weekly").isNotBlank()) sb.append("— $label —\n${l.f(k)}\n\n") }
        return sb.toString().trim()
    }

    /** نفس ترتيب ESSENTIAL وعناوينه في client_app.js */
    val ESSENTIAL = listOf(
        "concepts" to "المفاهيم",
        "pre_learning" to "التهيئة / التمهيد / التعلم القبلي",
        "activities_teach" to "إجراءات سير الدرس / الأنشطة التدريسية",
        "strategies" to "الاستراتيجيات كما وردت في ملف التحضير",
        "resources" to "الوسائل ومصادر التعلم",
        "formative" to "التقويم التكويني",
        "closing" to "التقويم الختامي",
        "homework" to "الأنشطة والمهام المنزلية",
        "outcomes" to "المخرجات التعليمية",
        "weekly" to "ملاحظات ضمن خطة الدراسة الأسبوعية",
    )

    /** ترتيب العرض في صفحة الدرس بالتطبيق */
    val SECTIONS = listOf(
        "outcomes" to "المخرجات التعليمية",
        "concepts" to "المفاهيم",
        "pre_learning" to "التهيئة والتعلم القبلي",
        "activities_teach" to "إجراءات سير الدرس والأنشطة",
        "strategies" to "الاستراتيجيات",
        "resources" to "الوسائل ومصادر التعلم",
        "formative" to "التقويم التكويني",
        "closing" to "التقويم الختامي",
        "homework" to "الأنشطة والمهام المنزلية",
        "weekly" to "ملاحظات خطة الدراسة الأسبوعية",
        "enrich" to "نشاط إثرائي / علاجي",
        "misconceptions" to "المفاهيم الخاطئة",
    )
}
