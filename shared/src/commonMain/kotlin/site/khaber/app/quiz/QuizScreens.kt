package site.khaber.app.quiz

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import site.khaber.app.*
import site.khaber.app.cards.Confirm
import site.khaber.app.ui.*

private val GRADE_N = mapOf("الخامس" to 5, "السادس" to 6, "السابع" to 7, "الثامن" to 8, "التاسع" to 9, "العاشر" to 10, "الحادي عشر" to 11, "الثاني عشر" to 12)
private val EN = Regex("انجليز|إنجليز|English", RegexOption.IGNORE_CASE)

/** أنواع الأوراق في صفحة الاختبارات (الواجب له صفحته) */
private enum class QMode(val key: String, val label: String) { Quiz("quiz", "اختبار قصير"), Review("review", "مراجعة وحدة"), Diff("diff", "أوراق متمايزة"), Hw("hw", "واجب منزلي") }

private data class Saved(val id: Long, val title: String, val kind: String, val updatedAt: Long, val sub: String)

// ======================= الاختبارات والواجبات: التكوين =======================
@Composable
fun QuizHome(st: AppState, hw: Boolean) {
    val eng = st.quizEngine
    val scope = rememberCoroutineScope()
    var courses by remember { mutableStateOf<List<QCourse>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    // التبويب يبقى كما هو عند الرجوع من ورقة مفتوحة من «المحفوظة»
    var tab by remember { mutableStateOf(st.quizTab[hw] ?: 0) }
    LaunchedEffect(tab) { st.quizTab[hw] = tab }
    var reload by remember { mutableStateOf(0) }
    LaunchedEffect(reload) {
        err = null
        runCatching { st.api.getJson("/api/courses").arr("courses").map { QCourse(it) } }
            .onSuccess { l ->
                courses = l.filter { it.items > 0 && (!EN.containsMatchIn(it.subject) || (GRADE_N[it.grade] ?: 0) >= 8) }
                    .sortedWith(compareBy({ GRADE_N[it.grade] ?: 99 }, { it.subject }))
            }
            .onFailure { err = it.message ?: "تعذّر التحميل" }
    }
    val last = st.host.get("quiz_course") ?: st.courseKey
    var key by remember { mutableStateOf(last) }
    val course = courses?.let { l -> l.firstOrNull { it.key == key } ?: l.firstOrNull() }
    var info by remember { mutableStateOf<QInfo?>(null) }
    var infoErr by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(course?.key) {
        info = null; infoErr = null
        val c = course ?: return@LaunchedEffect
        runCatching { eng.info(c) }.onSuccess { info = it }.onFailure { infoErr = it.message ?: "تعذّر تحميل بنك الأسئلة" }
    }
    var mode by remember { mutableStateOf(if (hw) QMode.Hw else QMode.Quiz) }
    var quizNo by remember { mutableStateOf(0) }
    var term by remember { mutableStateOf(st.term) }
    val picked = remember(course?.key) { mutableStateListOf<Long>() }
    var unit by remember(course?.key) { mutableStateOf<String?>(null) }
    var reviewCount by remember { mutableStateOf(0) }
    val dlv = remember { mutableStateListOf(true, true, true) }
    var dn by remember { mutableStateOf(6) }
    var busy by remember { mutableStateOf(false) }

    fun generate() {
        val c = course ?: return
        val opts = buildJsonObject {
            put("mode", mode.key); put("quizNo", eng.qno.getOrElse(quizNo) { "الأول" })
            putJsonArray("lessons") { picked.forEach { add(it) } }
            unit?.let { put("unit", it) }; put("reviewCount", reviewCount)
            putJsonArray("dlv") { dlv.forEach { add(it) } }; put("dn", dn)
        }
        busy = true
        scope.launch {
            runCatching { eng.make(c, opts) }
                .onSuccess { r ->
                    if (r.doc != null) { st.host.put("quiz_course", c.key); st.quizCur = QuizCur(c, r.doc); st.open(Screen.QuizDoc) }
                    else st.host.toast(r.error ?: "تعذّر التكوين")
                }
                .onFailure { st.host.toast(it.message ?: "تعذّر التكوين") }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopBar(if (hw) "الواجبات المنزلية" else "الاختبارات القصيرة", if (hw) "واجب حسب وثيقة التقويم بنموذج إجابة" else "اختبار وورقة مطابقة لوثيقة تقويم تعلم الطلبة", onBack = { st.handleBack() })
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip("تكوين جديد", tab == 0) { tab = 0 }
            Chip("المحفوظة", tab == 1) { tab = 1 }
        }
        if (tab == 1) { SavedList(st, hw, courses.orEmpty()); return@Column }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            err?.let { e -> item { EmptyNote(e); Spacer(Modifier.height(8.dp)); PrimaryButton("إعادة المحاولة", KI.reload, Modifier.fillMaxWidth()) { reload++ } } }
            if (courses == null && err == null) item { repeat(3) { Shimmer(Modifier.fillMaxWidth().height(80.dp).padding(bottom = 10.dp)) } }
            val cl = courses
            if (cl != null && cl.isEmpty()) item { EmptyNote("لا توجد مواد فيها بنك أسئلة لحسابك.") }
            if (cl != null && cl.isNotEmpty()) {
                item {
                    Text("المادة", style = T.label.copy(color = P.mute))
                    Spacer(Modifier.height(6.dp))
                    if (cl.size <= 6) {
                        val rowState = rememberLazyListState()
                        LaunchedEffect(course?.key) { cl.indexOfFirst { it.key == course?.key }.takeIf { it >= 0 }?.let { rowState.scrollToItem(it) } }
                        LazyRow(state = rowState, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(cl, key = { it.key }) { c -> Chip("${c.subject} · ${c.grade}", c.key == course?.key) { key = c.key } }
                        }
                    } else CoursePicker(cl, course) { key = it }
                }
                if (!hw) item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(QMode.Quiz, QMode.Review, QMode.Diff).forEach { m -> Chip(m.label, mode == m) { mode = m } }
                    }
                }
                infoErr?.let { e -> item { EmptyNote(e) } }
                val inf = info
                if (inf == null && infoErr == null) item { Shimmer(Modifier.fillMaxWidth().height(120.dp)) }
                if (inf != null) {
                    // المواصفات من الوثيقة
                    item {
                        KCard(Modifier.fillMaxWidth(), bg = P.mainL, border = false) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(KI.check, null, Modifier.size(18.dp), tint = P.mainD)
                                Text("حسب وثيقة التقويم", style = T.label.copy(color = P.mainD), modifier = Modifier.padding(start = 8.dp))
                            }
                            Spacer(Modifier.height(4.dp))
                            val t = when (mode) {
                                QMode.Hw -> inf.hwText.ifBlank { "لا يوجد واجب منزلي لهذه المادة في وثيقة التقويم." }
                                QMode.Quiz -> "الاختبار القصير ${inf.quizTotal} درجات: ${inf.specText}."
                                QMode.Review -> "مراجعة نهاية الوحدة: مفردات من كل دروس الوحدة بالترتيب، مع نموذج إجابة."
                                QMode.Diff -> "ثلاثة مستويات لنفس الدروس (أساسي · متوسط · إثرائي) لتوزّع كل ورقة على مجموعتها."
                            }
                            Text(t, style = T.body.copy(color = P.mainD))
                        }
                    }
                    if (mode == QMode.Quiz) item {
                        Text("رقم الاختبار", style = T.label.copy(color = P.mute)); Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { eng.qno.forEachIndexed { i, n -> Chip(n, quizNo == i) { quizNo = i } } }
                    }
                    if (mode == QMode.Diff) item {
                        Text("المستويات", style = T.label.copy(color = P.mute)); Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { eng.levels.forEachIndexed { i, n -> Chip(n.removePrefix("المستوى "), dlv[i]) { dlv[i] = !dlv[i] } } }
                        Spacer(Modifier.height(10.dp))
                        Text("عدد المفردات في كل مستوى", style = T.label.copy(color = P.mute)); Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(4, 6, 8, 10).forEach { n -> Chip("$n", dn == n) { dn = n } } }
                    }
                    if (mode == QMode.Review) item {
                        Text("عدد المفردات", style = T.label.copy(color = P.mute)); Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(0 to "كل المفردات", 10 to "10", 15 to "15", 20 to "20").forEach { (n, l) -> Chip(l, reviewCount == n) { reviewCount = n } } }
                    }
                    // الدروس حسب الوحدة والفصل
                    val terms = inf.lessons.map { it.term }.distinct().sorted()
                    if (terms.size > 1) item {
                        TermSwitch(term, onDark = false, badge2 = "", label1 = "الفصل الأول", label2 = "الفصل الثاني") { term = it }
                    }
                    val shown = inf.lessons.filter { terms.size < 2 || it.term == term }
                    val byUnit = shown.groupBy { it.unit }
                    if (shown.isEmpty()) item { EmptyNote("لا توجد دروس لهذا الفصل في بنك المادة بعد.") }
                    item {
                        Text(if (mode == QMode.Review) "اختر الوحدة" else "اختر الدروس", style = T.h3)
                        if (mode != QMode.Review) Text(if (mode == QMode.Hw) "الواجب عادة من درس واحد" else "الوثيقة: من درسين إلى خمسة دروس عادة", style = T.small)
                    }
                    byUnit.forEach { (u, ls) ->
                        val un = inf.units.firstOrNull { it.unit == u }
                        item(key = "u$u$term") {
                            KCard(Modifier.fillMaxWidth(), pad = 0.dp) {
                                val all = ls.all { it.id in picked }
                                val selU = unit == u
                                Row(
                                    Modifier.fillMaxWidth().press({
                                        if (mode == QMode.Review) unit = u
                                        else if (all) picked.removeAll(ls.map { it.id }.toSet()) else ls.forEach { if (it.id !in picked && it.n > 0) picked.add(it.id) }
                                    }).background(if ((mode == QMode.Review && selU)) P.mainL else Color.Transparent).padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Tick(if (mode == QMode.Review) selU else all, round = mode == QMode.Review)
                                    Column(Modifier.weight(1f).padding(start = 10.dp)) {
                                        Text("الوحدة $u" + (un?.name?.takeIf { it.isNotBlank() }?.let { ": $it" } ?: ""), style = T.h3)
                                        Text("${ls.size} دروس · ${ls.sumOf { it.n }} مفردة", style = T.small)
                                    }
                                }
                                if (mode != QMode.Review) ls.forEach { l ->
                                    val on = l.id in picked
                                    Row(
                                        Modifier.fillMaxWidth().then(if (l.n > 0) Modifier.press({ if (on) picked.remove(l.id) else picked.add(l.id) }) else Modifier)
                                            .padding(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Spacer(Modifier.width(8.dp))
                                        Tick(on, small = true)
                                        Text(l.title, style = T.body.copy(color = if (l.n > 0) P.ink else P.mute), modifier = Modifier.weight(1f).padding(horizontal = 10.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        Text(if (l.n > 0) "${l.n}" else "—", style = T.small)
                                    }
                                }
                                if (mode != QMode.Review) Spacer(Modifier.height(6.dp))
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
        if (tab == 0 && info != null) {
            val ready = if (mode == QMode.Review) unit != null else picked.isNotEmpty()
            val label = when {
                busy -> "جارٍ التكوين…"
                mode == QMode.Review -> if (unit == null) "اختر وحدة" else "تكوين المراجعة"
                picked.isEmpty() -> "اختر درسًا على الأقل"
                mode == QMode.Hw -> "تكوين الواجب (${picked.size})"
                mode == QMode.Diff -> "تكوين الأوراق المتمايزة (${picked.size})"
                else -> "تكوين الاختبار (${picked.size} دروس)"
            }
            Box(Modifier.fillMaxWidth().background(P.bg).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp)) {
                PrimaryButton(label, KI.sparkle, Modifier.fillMaxWidth(), color = if (ready && !busy) P.main else P.mute) { if (ready && !busy) generate() }
            }
        }
    }
}

/** اختيار المادة عند كثرة المواد: المادة الحالية + بحث سريع */
@Composable
private fun CoursePicker(cl: List<QCourse>, cur: QCourse?, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    var q by remember { mutableStateOf("") }
    KCard(Modifier.fillMaxWidth(), pad = 0.dp) {
        Row(Modifier.fillMaxWidth().press({ open = !open; q = "" }).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(cur?.subject ?: "اختر المادة", style = T.h3)
                cur?.let { Text("الصف ${it.grade}", style = T.small) }
            }
            Text(if (open) "إغلاق" else "تغيير", style = T.label.copy(color = P.mainD))
            Icon(if (open) KI.up else KI.down, null, Modifier.padding(start = 6.dp).size(18.dp), tint = P.mainD)
        }
        AnimatedVisibility(open) {
            Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)) {
                site.khaber.app.SearchBox(q, "ابحث: أحياء 11، رياضيات…") { q = it }
                Spacer(Modifier.height(6.dp))
                val nq = q.trim().replace("أ", "ا").replace("إ", "ا").map { ch -> if (ch in '٠'..'٩') '0' + (ch - '٠') else ch }.joinToString("")
                val digits = Regex("\\d+").find(nq)?.value?.toIntOrNull()
                val words = nq.replace(Regex("\\d+"), "").trim()
                val shown = cl.filter { c ->
                    (words.isBlank() || c.subject.replace("أ", "ا").replace("إ", "ا").contains(words)) &&
                        (digits == null || GRADE_N[c.grade] == digits)
                }.take(40)
                if (shown.isEmpty()) Text("لا توجد مادة بهذا الاسم", style = T.small, modifier = Modifier.padding(8.dp))
                shown.forEach { c ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(if (c.key == cur?.key) P.mainL else Color.Transparent)
                            .press({ onPick(c.key); open = false }).padding(horizontal = 10.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(c.subject, style = T.body, modifier = Modifier.weight(1f))
                        Text(c.grade, style = T.small)
                    }
                }
            }
        }
    }
}

@Composable
private fun Tick(on: Boolean, round: Boolean = false, small: Boolean = false) {
    val s = if (small) 20.dp else 24.dp
    val shape = if (round) CircleShape else RoundedCornerShape(7.dp)
    Box(
        Modifier.size(s).clip(shape).background(if (on) P.main else Color.Transparent).border(1.6.dp, if (on) P.main else P.line, shape),
        contentAlignment = Alignment.Center,
    ) { if (on) Icon(KI.tick, null, Modifier.size(s * 0.7f), tint = P.onMain) }
}

@Composable
private fun SavedList(st: AppState, hw: Boolean, courses: List<QCourse>) {
    var rows by remember { mutableStateOf<List<Saved>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    var del by remember { mutableStateOf<Saved?>(null) }
    var opening by remember { mutableStateOf<Long?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(reload) {
        err = null
        runCatching { st.api.getJson("/api/quizzes?kind=" + (if (hw) "homework" else "quiz,review,diff,remedy")).arr("quizzes") }
            .onSuccess { l -> rows = l.map { Saved(it.s("id").toDoubleOrNull()?.toLong() ?: 0, it.s("title"), it.s("kind"), it.s("updated_at").toDoubleOrNull()?.toLong() ?: 0, listOf(it.s("subject"), it.s("grade")).filter(String::isNotBlank).joinToString(" · ")) }.sortedByDescending { it.updatedAt } }
            .onFailure { err = it.message ?: "تعذّر التحميل" }
    }
    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            err?.let { item { EmptyNote(it) } }
            if (rows == null && err == null) item { repeat(3) { Shimmer(Modifier.fillMaxWidth().height(72.dp).padding(bottom = 10.dp)) } }
            if (rows?.isEmpty() == true) item { EmptyNote(if (hw) "لا توجد واجبات محفوظة بعد. كوّن واجبًا ثم اضغط «حفظ»." else "لا توجد اختبارات محفوظة بعد. كوّن اختبارًا ثم اضغط «حفظ».") }
            items(rows.orEmpty(), key = { it.id }) { r ->
                KCard(Modifier.fillMaxWidth().press({
                    if (opening != null) return@press
                    opening = r.id
                    scope.launch {
                        runCatching {
                            val q = st.api.getJson("/api/quizzes/${r.id}").obj("quiz")
                            val d = JsonObject(q.obj("data") + mapOf("id" to JsonPrimitive(r.id), "title" to JsonPrimitive(q.s("title"))))
                            val c = courses.firstOrNull { it.key == d.s("course") } ?: throw ApiError(0, "مادة هذا الملف غير متاحة لحسابك")
                            st.quizCur = QuizCur(c, d, dirty = false); st.open(Screen.QuizDoc)
                        }.onFailure { st.host.toast(it.message ?: "تعذّر الفتح") }
                        opening = null
                    }
                })) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBox(if (r.kind == "homework") KI.pen else KI.check, if (r.kind == "homework") Tone.Accent else Tone.Main, 40.dp, 20.dp)
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(r.title, style = T.h3, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            if (r.sub.isNotBlank()) Text(r.sub, style = T.small)
                        }
                        if (opening == r.id) Text("…", style = T.h3) else Icon(KI.close, "حذف", Modifier.size(20.dp).press({ del = r }), tint = P.mute)
                    }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
        // داخل الصندوق نفسه حتى يغطي الشاشة (القائمة داخل عمود الصفحة)
        del?.let { d ->
            Confirm("حذف الملف المحفوظ؟", d.title, "حذف", danger = true, onDismiss = { del = null }) {
                del = null; scope.launch { runCatching { st.api.deleteDoc(d.id) }.onFailure { st.host.toast(it.message ?: "تعذّر الحذف") }; reload++ }
            }
        }
    }
}

// ======================= الورقة =======================
@Composable
fun QuizDocScreen(st: AppState) {
    val cur = st.quizCur ?: run { LaunchedEffect(Unit) { st.handleBack() }; return }
    val eng = st.quizEngine
    val scope = rememberCoroutineScope()
    var rev by remember { mutableStateOf<QuizEngine.Review?>(null) }
    var showAns by remember { mutableStateOf(false) }
    var showChecks by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf<String?>(null) }
    var confirmDel by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(cur.doc) { runCatching { eng.review(cur.course, cur.doc) }.onSuccess { rev = it }.onFailure { st.host.toast(it.message ?: "تعذّر الفحص") } }
    val items = cur.items
    val title = cur.doc.s("title").ifBlank { rev?.title ?: "" }
    val failed = rev?.checks?.filter { !it.ok }.orEmpty()

    fun apply(r: QuizEngine.R) { if (r.doc != null) { cur.doc = r.doc; cur.dirty = true; r.msg?.let { st.host.toast(it) } } else st.host.toast(r.error ?: "تعذّر") }
    suspend fun save(): Long? {
        val t = title.ifBlank { rev?.title ?: "اختبار" }
        val d = JsonObject(cur.doc + ("title" to (JsonPrimitive(t) as JsonElement)))
        return runCatching { st.api.saveDoc(d.s("kind"), d) }
            .onSuccess { (id, _) -> cur.doc = JsonObject(d + ("id" to (JsonPrimitive(id) as JsonElement))); cur.dirty = false }
            .onFailure { st.host.toast(it.message ?: "تعذّر الحفظ") }.getOrNull()?.first
    }

    Column(Modifier.fillMaxSize()) {
        TopBar(title.ifBlank { "الورقة" }, rev?.let { "${items.size} مفردة · ${it.total} درجة" + if (cur.dirty) " · غير محفوظ" else "" }, onBack = { st.handleBack() }) {
            SquareButton(if (showAns) KI.check else KI.doc, if (showAns) "إخفاء الإجابات" else "إظهار الإجابات", size = 44.dp, bg = if (showAns) P.main else P.paper, fg = if (showAns) P.onMain else P.ink) { showAns = !showAns }
        }
        LazyColumn(Modifier.weight(1f), state = rememberLazyListState(), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // فحوص الوثيقة
            item {
                val r = rev
                val ok = r != null && failed.isEmpty()
                KCard(Modifier.fillMaxWidth().press({ showChecks = !showChecks }), bg = if (r == null) P.paper else if (ok) P.leafL else P.accentL, border = false) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (ok) KI.tick else KI.target, null, Modifier.size(20.dp), tint = if (ok) P.leafInk else P.accentInk)
                        Text(
                            when { r == null -> "جارٍ الفحص…"; ok -> "مطابق لوثيقة التقويم"; else -> "${failed.size} من ${r.checks.size} شروط غير مستوفاة" },
                            style = T.h3.copy(color = if (ok) P.leafInk else P.accentInk), modifier = Modifier.weight(1f).padding(start = 8.dp),
                        )
                        if (r != null) Icon(if (showChecks) KI.up else KI.down, null, Modifier.size(18.dp), tint = P.mute)
                    }
                    if (r != null && !ok && !showChecks) Text("السبب غالبًا قلة المفردات في الدروس المختارة. جرّب «نموذج آخر» أو أضف درسًا.", style = T.small.copy(color = P.accentInk), modifier = Modifier.padding(top = 4.dp))
                    AnimatedVisibility(showChecks && r != null) {
                        Column(Modifier.padding(top = 8.dp)) {
                            r?.checks?.forEach { c ->
                                Row(Modifier.padding(vertical = 3.dp), verticalAlignment = Alignment.Top) {
                                    Text(if (c.ok) "✓" else "✗", style = T.label.copy(color = if (c.ok) P.leafInk else P.danger), modifier = Modifier.width(18.dp))
                                    Text(c.text, style = T.small.copy(color = P.ink))
                                }
                            }
                        }
                    }
                }
            }
            itemsIndexed(items, key = { i, it -> "${it.s("qid")}#$i" }) { i, it ->
                val m = rev?.meta?.getOrNull(i)
                val lv = m?.lv ?: -1
                Column {
                    if (cur.doc.s("kind") == "diff" && lv >= 0 && (i == 0 || rev?.meta?.getOrNull(i - 1)?.lv != lv)) {
                        Text(eng.levels.getOrElse(lv) { "" }, style = T.h2, modifier = Modifier.padding(top = 6.dp, bottom = 6.dp))
                    }
                    ItemCard(st, i, it, m, showAns, busy == "i$i",
                        onSwap = { busy = "i$i"; scope.launch { runCatching { eng.swap(cur.course, cur.doc, i) }.onSuccess(::apply).onFailure { e -> st.host.toast(e.message ?: "تعذّر") }; busy = null } },
                        onUp = if (i > 0) ({ val l = items.toMutableList(); l.add(i - 1, l.removeAt(i)); cur.doc = cur.withItems(l); cur.dirty = true }) else null,
                        onDown = if (i < items.lastIndex) ({ val l = items.toMutableList(); l.add(i + 1, l.removeAt(i)); cur.doc = cur.withItems(l); cur.dirty = true }) else null,
                        onDelete = { confirmDel = i })
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
        // الأزرار السفلية
        Row(Modifier.fillMaxWidth().background(P.bg).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SquareButton(KI.reload, "نموذج آخر") {
                if (busy != null) return@SquareButton
                busy = "remake"; scope.launch { runCatching { eng.remake(cur.course, cur.doc) }.onSuccess(::apply).onFailure { st.host.toast(it.message ?: "تعذّر") }; busy = null }
            }
            PrimaryButton(if (busy == "save") "جارٍ الحفظ…" else if (cur.dirty) "حفظ" else "محفوظ ✓", KI.folder, Modifier.weight(1f), color = if (cur.dirty) P.main else P.leafInk) {
                if (busy != null || !cur.dirty) return@PrimaryButton
                busy = "save"; scope.launch { if (save() != null) st.host.toast(if (cur.hw) "حُفظ في واجباتي" else "حُفظ في اختباراتي"); busy = null }
            }
            PrimaryButton("طباعة · Word", null, Modifier.weight(1f), color = P.dock) {
                if (busy != null) return@PrimaryButton
                busy = "print"
                scope.launch {
                    val id = if (cur.dirty || cur.id == null) save() else cur.id
                    busy = null
                    if (id != null) st.open(Screen.Web((if (cur.hw) "/homework" else "/quiz") + "?open=$id", title))
                }
            }
        }
    }
    confirmDel?.let { i ->
        Confirm("حذف المفردة ${i + 1}؟", "تُحذف من هذه الورقة فقط (تبقى في بنك الأسئلة).", "حذف", danger = true, onDismiss = { confirmDel = null }) {
            confirmDel = null; val l = items.toMutableList(); if (i in l.indices) { l.removeAt(i); cur.doc = cur.withItems(l); cur.dirty = true }
        }
    }
    if (cur.askLeave) {
        Confirm("الورقة غير محفوظة", "احفظها لتجدها لاحقًا في «المحفوظة»، أو اخرج بدون حفظ.", "حفظ والخروج", cancel = "خروج بدون حفظ", onOutside = { cur.askLeave = false },
            onDismiss = { cur.askLeave = false; cur.dirty = false; st.handleBack() }) {
            cur.askLeave = false
            scope.launch { if (save() != null) st.handleBack() }
        }
    }
}

private val LETTERS = listOf("أ", "ب", "ج", "د", "هـ", "و")

@Composable
private fun ItemCard(st: AppState, i: Int, it: JsonObject, m: QMeta?, showAns: Boolean, busy: Boolean, onSwap: () -> Unit, onUp: (() -> Unit)?, onDown: (() -> Unit)?, onDelete: () -> Unit) {
    val marks = it.i("marks")
    KCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(30.dp).clip(CircleShape).background(P.dock), contentAlignment = Alignment.Center) {
                Text("${i + 1}", style = T.label.copy(color = Color.White, fontWeight = FontWeight.Bold))
            }
            Spacer(Modifier.width(8.dp))
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(m?.type ?: it.s("type"))
                if (!m?.ao.isNullOrBlank()) Pill(m!!.ao.substringBefore(" · "), Tone.Leaf)
            }
            Text("$marks ${if (marks == 1) "درجة" else if (marks == 2) "درجتان" else "درجات"}", style = T.label.copy(color = P.accentInk))
        }
        Spacer(Modifier.height(10.dp))
        val stem = it.s("stem")
        val img = it.s("img")
        // سؤال وزاري مصوَّر (بلا fig): الصورة نفسها هي السؤال كما في الورقة، والنص نسخة احتياطية إن تعذّرت الصورة
        val photoQ = img.isNotBlank() && !it.b("fig")
        val stemView: @Composable () -> Unit = { if (stem.isNotBlank()) Text(rich(stem), style = T.body.copy(fontSize = 15.sp, lineHeight = 26.sp)) }
        if (photoQ) NetImage(st, "/fin/$img", it.i("iw", 1000), it.i("ih", 600), stemView)
        else {
            stemView()
            (it["table"] as? JsonObject)?.let { tb -> Spacer(Modifier.height(8.dp)); QTable(tb) }
            if (img.isNotBlank()) { Spacer(Modifier.height(8.dp)); NetImage(st, "/fin/$img", it.i("iw", 1000), it.i("ih", 600)) }
        }
        val ch = it.list("choices")
        if (ch.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            val correct = it.i("correct", -1)
            ch.forEachIndexed { k, c ->
                val good = showAns && k == correct
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(RoundedCornerShape(12.dp))
                        .background(if (good) P.leafL else P.bg).padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(LETTERS.getOrElse(k) { "${k + 1}" }, style = T.label.copy(color = if (good) P.leafInk else P.mainD, fontWeight = FontWeight.Bold), modifier = Modifier.width(24.dp))
                    Text(rich(c), style = T.body.copy(color = if (good) P.leafInk else P.ink), modifier = Modifier.weight(1f))
                    if (good) Icon(KI.tick, null, Modifier.size(16.dp), tint = P.leafInk)
                }
            }
        }
        AnimatedVisibility(showAns) {
            Column(Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(P.leafL).padding(12.dp)) {
                Text("نموذج الإجابة", style = T.label.copy(color = P.leafInk))
                Text(rich(it.s("answer").ifBlank { "—" }), style = T.body.copy(color = P.ink))
                (it["aimg"] as? JsonArray)?.forEach { a ->
                    val arr = a as? JsonArray ?: return@forEach
                    Spacer(Modifier.height(6.dp))
                    NetImage(st, "/fin/" + arr[0].jsonPrimitive.content, arr.getOrNull(1)?.jsonPrimitive?.intOrNull ?: 400, arr.getOrNull(2)?.jsonPrimitive?.intOrNull ?: 80)
                }
                if (it.s("notes").isNotBlank()) Text(it.s("notes"), style = T.small, modifier = Modifier.padding(top = 4.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(listOfNotNull(m?.lesson?.takeIf { it.isNotBlank() }, it.s("src").takeIf { it.isNotBlank() }).joinToString(" · "), style = T.small, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                MiniBtn(if (busy) "…" else "استبدال", onSwap)
                onUp?.let { MiniIcon(KI.up, "تقديم", it) }
                onDown?.let { MiniIcon(KI.down, "تأخير", it) }
                MiniIcon(KI.close, "حذف", onDelete)
            }
        }
    }
}

@Composable private fun MiniBtn(text: String, onClick: () -> Unit) {
    Text(text, style = T.label.copy(color = P.mainD), modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(P.mainL).press(onClick).padding(horizontal = 12.dp, vertical = 7.dp))
}
@Composable private fun MiniIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(P.mainL).press(onClick, label = label), contentAlignment = Alignment.Center) { Icon(icon, label, Modifier.size(16.dp), tint = P.mainD) }
}

/** **غامق** كما في بنك الأسئلة */
private fun rich(s: String): AnnotatedString = buildAnnotatedString {
    val parts = s.split("**")
    parts.forEachIndexed { k, p -> if (k % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(p) } else append(p) }
}

@Composable
private fun QTable(tb: JsonObject) {
    val rows = (tb["rows"] as? JsonArray)?.map { r -> (r as? JsonArray)?.map { c -> (c as? JsonPrimitive)?.content ?: "" } ?: emptyList() }.orEmpty()
    if (rows.isEmpty()) return
    if (tb.s("caption").isNotBlank()) Text(tb.s("caption"), style = T.label, modifier = Modifier.padding(bottom = 4.dp))
    val cols = rows.maxOf { it.size }
    Column(Modifier.fillMaxWidth().border(1.dp, P.line, RoundedCornerShape(10.dp)).clip(RoundedCornerShape(10.dp))) {
        rows.forEachIndexed { r, row ->
            Row(Modifier.fillMaxWidth().background(if (r == 0) P.mainL else P.paper).height(IntrinsicSize.Min)) {
                for (c in 0 until cols) {
                    Text(row.getOrElse(c) { "" }, style = T.small.copy(color = P.ink, fontWeight = if (r == 0) FontWeight.Bold else FontWeight.Normal), textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f).fillMaxHeight().border(0.5.dp, P.line).padding(6.dp))
                }
            }
        }
    }
}

private val imgCache = HashMap<String, ImageBitmap>()

/** صورة من الموقع (أسئلة الوزارة) بنسبة أبعادها الأصلية */
@Composable
fun NetImage(st: AppState, path: String, w: Int, h: Int, fallback: (@Composable () -> Unit)? = null) {
    var bmp by remember(path) { mutableStateOf(imgCache[path]) }
    var failed by remember(path) { mutableStateOf(false) }
    LaunchedEffect(path) {
        if (bmp != null) return@LaunchedEffect
        val b = st.api.bytes(path)?.let { decodeImage(it) }
        if (b != null) { imgCache[path] = b; bmp = b } else failed = true
    }
    if (failed && fallback != null) { fallback(); return }
    val ratio = if (w > 0 && h > 0) w.toFloat() / h else 1.6f
    Box(Modifier.fillMaxWidth().aspectRatio(ratio).clip(RoundedCornerShape(10.dp)).background(Color.White).border(1.dp, P.line, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
        val b = bmp
        if (b != null) Image(b, null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        else if (failed) Text("تعذّر تحميل الصورة", style = T.small)
        else Shimmer(Modifier.fillMaxSize())
    }
}
