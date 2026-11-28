package site.khaber.app.cards

import androidx.compose.runtime.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import site.khaber.app.*

/**
 * المسح الحي — نفس منطق live() في client_cards.js:
 * • تُسجَّل الإجابة بعد 3 قراءات متطابقة متتالية، وتغيير إجابة مسجّلة يحتاج 6
 * • بعد الانتقال لسؤال جديد: بطاقة ما زالت مرفوعة بإجابة السؤال السابق لا تُحتسب حتى يُنزلها الطالب
 * • شاشة السبورة (الكمبيوتر) تقرأ الحالة من /api/cards/live، والإجابات تُحفظ في الجلسة نفسها
 */
class LiveSession(val st: AppState, val s: CSession, val c: CClass, private val scope: CoroutineScope) {
    private val roster = c.students.associate { it.n to it.name }
    var rev by mutableStateOf(0)            // يتغيّر مع كل تحديث للواجهة
    var mark by mutableStateOf(false)       // إظهار الصح/الخطأ على جوال المعلم وحده
    var sync by mutableStateOf("جارٍ الاتصال بالسبورة")
    var hits by mutableStateOf<List<Shown>>(emptyList())
    var frame by mutableStateOf(1 to 1)

    class Shown(val hit: CardDetector.Hit, val name: String, val ok: Boolean, val wait: Boolean)
    private class Pend(var ans: Int, var c: Int, var t: Long)
    private var pend = HashMap<Int, Pend>()
    private var held = HashMap<Int, Long>()
    private var prevQ: Map<Int, Int> = emptyMap()
    private var qStart = 0L
    private var dirty = false
    private var saveJob: Job? = null
    private var pushJob: Job? = null
    private var saving = false

    init { s.reveal = false; s.cur = s.cur.coerceIn(0, (s.questions.size - 1).coerceAtLeast(0)); pushSoon() }

    val q get() = s.questions[s.cur]
    fun answersNow(): MutableMap<Int, Int> = s.answers.getOrPut(s.cur) { HashMap() }
    val total get() = c.students.size

    fun onFrame(list: List<CardDetector.Hit>, w: Int, h: Int) {
        frame = w to h
        val a = answersNow(); val now = st.host.nowMillis(); var changed = false
        val seen = HashSet<Int>(); val out = ArrayList<Shown>()
        for (hit in list) {
            val name = roster[hit.n]
            if (name == null || !seen.add(hit.n)) continue
            val stale = prevQ[hit.n] == hit.ans && a[hit.n] == null
            if (stale && (now - qStart < 1500 || (held[hit.n]?.let { now - it < 700 } == true))) { held[hit.n] = now; out.add(Shown(hit, name, false, true)); continue }
            if (!stale || held.containsKey(hit.n)) held.remove(hit.n)
            var p = pend[hit.n]
            if (p != null && p.ans == hit.ans && now - p.t < 1500) { p.c++; p.t = now } else { p = Pend(hit.ans, 1, now); pend[hit.n] = p }
            val need = if (a[hit.n] == null) 3 else 6
            val ok = p.c >= need || a[hit.n] == hit.ans
            if (p.c >= need && a[hit.n] != hit.ans) { val isNew = a[hit.n] == null; a[hit.n] = hit.ans; changed = true; if (isNew) st.host.beep() }
            out.add(Shown(hit, name, ok && a[hit.n] == hit.ans, false))
        }
        hits = out
        if (changed) { markDirty(); rev++ }
    }

    private fun resetQ() { prevQ = HashMap(answersNow()); pend = HashMap(); held = HashMap(); qStart = st.host.nowMillis() }
    fun prev() { if (s.cur > 0) { resetQ(); s.cur--; s.reveal = false; markDirty(); rev++ } }
    fun next(): Boolean { if (s.cur < s.questions.size - 1) { resetQ(); s.cur++; s.reveal = false; markDirty(); rev++; return true }; return false }
    fun toggleReveal() { s.reveal = !s.reveal; markDirty(); rev++ }

    // ---------- شاشة السبورة ----------
    private fun liveState(ended: Boolean = false): JsonObject = if (ended) buildJsonObject {
        put("t", st.host.nowMillis()); put("sid", s.id); put("title", s.title); put("ended", true)
    } else buildJsonObject {
        val a = answersNow(); val qq = q
        put("t", st.host.nowMillis()); put("sid", s.id); put("title", s.title); put("cls", c.title)
        put("i", s.cur); put("n", s.questions.size)
        putJsonObject("q") {
            put("stem", qq.stem); put("choices", JsonArray(qq.choices.map(::JsonPrimitive)))
            put("table", qq.table ?: JsonNull); put("correct", if (s.reveal) JsonPrimitive(qq.correct) else JsonNull)
        }
        put("reveal", s.reveal)
        put("done", JsonArray(a.keys.sorted().map(::JsonPrimitive)))
        put("dist", if (s.reveal) JsonArray(qq.choices.indices.map { k -> JsonPrimitive(a.values.count { it == k }) }) else JsonNull)
        put("students", JsonArray(c.students.map { JsonArray(listOf(JsonPrimitive(it.n), JsonPrimitive(it.name))) }))
        put("ended", false)
    }
    private fun pushSoon() {
        pushJob?.cancel()
        pushJob = scope.launch {
            delay(250)
            var n = 0
            while (isActive) {
                sync = "جارٍ المزامنة مع السبورة…"
                val ok = runCatching { st.api.postJson("/api/cards/live?sid=${s.id}", buildJsonObject { put("state", liveState()) }) }.isSuccess
                if (ok) { sync = "متصل بالسبورة"; break }
                sync = "تعذّر الاتصال — جارٍ إعادة المحاولة"
                delay(minOf(15000L, 500L shl minOf(n++, 5)))
            }
        }
    }

    // ---------- الحفظ: نسخة على الجهاز فورًا، ثم الخادم بعد ثانية ونصف (مع إعادة المحاولة) ----------
    private fun backup() { st.host.put("cards_pending_${s.id}", buildJsonObject { put("base", s.updatedAt); put("data", s.toJson()) }.toString()) }
    private fun markDirty() {
        dirty = true; backup(); pushSoon()
        saveJob?.cancel()
        saveJob = scope.launch { delay(1500); persist() }
    }
    suspend fun persist(): Boolean {
        if (!dirty) return true
        if (saving) { while (saving) delay(100); return persist() }
        saving = true; var n = 0
        try {
            while (true) {
                val before = rev
                val r = runCatching { st.api.saveDoc("csession", s.toJson()) }
                if (r.isSuccess) {
                    s.updatedAt = r.getOrThrow().second.takeIf { it > 0 } ?: s.updatedAt
                    if (rev == before) { dirty = false; st.host.put("cards_pending_${s.id}", null) }
                    sync = "متصل بالسبورة"; return !dirty
                }
                sync = "تعذّر حفظ الإجابات — جارٍ إعادة المحاولة"
                if (++n >= 8) return false
                delay(minOf(30000L, 1000L shl minOf(n, 5)))
            }
        } finally { saving = false }
    }
    /** إنهاء: إعلان انتهاء الجلسة للسبورة ثم حفظ نهائي */
    suspend fun close(): Boolean {
        pushJob?.cancel(); saveJob?.cancel()
        runCatching { st.api.postJson("/api/cards/live?sid=${s.id}", buildJsonObject { put("state", liveState(ended = true)) }) }
        dirty = true; backup()
        return persist()
    }

    companion object {
        /** نسخة محفوظة على الهاتف لم تصل للخادم: تُستعاد إن لم يتغيّر الخادم بعدها (كما في restorePending) */
        fun restore(host: Host, s: CSession): CSession {
            val raw = host.get("cards_pending_${s.id}") ?: return s
            return runCatching {
                val p = J.parseToJsonElement(raw).jsonObject; val d = p.obj("data")
                val base = p.s("base").toDoubleOrNull()?.toLong() ?: 0L
                if (s.updatedAt <= base) CSession(JsonObject(d + mapOf("updated_at" to JsonPrimitive(s.updatedAt), "id" to JsonPrimitive(s.id)))).also { host.toast("استُعيدت إجابات محفوظة على هذا الهاتف لم تصل إلى الخادم بعد.") }
                else s
            }.getOrDefault(s)
        }
    }
}
