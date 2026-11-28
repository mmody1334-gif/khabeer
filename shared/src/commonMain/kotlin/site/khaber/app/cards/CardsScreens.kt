package site.khaber.app.cards

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import site.khaber.app.*
import site.khaber.app.ui.*

private data class DocRow(val id: Long, val title: String, val kind: String, val updatedAt: Long, val sub: String)

// ======================= كروت الأسئلة: الصفوف والجلسات =======================
@Composable
fun CardsHome(st: AppState) {
    var tab by remember { mutableStateOf(0) }
    var rows by remember { mutableStateOf<List<DocRow>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(reload) {
        err = null
        runCatching { st.api.getJson("/api/quizzes?kind=cclass,csession").arr("quizzes") }
            .onSuccess { l -> rows = l.map { DocRow(it.s("id").toDoubleOrNull()?.toLong() ?: 0, it.s("title"), it.s("kind"), it.s("updated_at").toDoubleOrNull()?.toLong() ?: 0, listOf(it.s("subject"), it.s("grade")).filter(String::isNotBlank).joinToString(" · ")) } }
            .onFailure { err = it.message ?: "تعذّر التحميل" }
    }
    val classes = rows.orEmpty().filter { it.kind == "cclass" }
    val sessions = rows.orEmpty().filter { it.kind == "csession" }.sortedByDescending { it.updatedAt }
    var confirmDel by remember { mutableStateOf<DocRow?>(null) }
    Column(Modifier.fillMaxSize()) {
        TopBar("كروت الأسئلة", "بطاقة لكل طالب وامسح الصف بكاميرا جوالك", onBack = { st.handleBack() }) {
            SquareButton(KI.reload, "تحديث", size = 44.dp, bg = P.paper, fg = P.ink) { reload++ }
        }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip("صفوفي (${classes.size})", tab == 0) { tab = 0 }
            Chip("الجلسات والنتائج (${sessions.size})", tab == 1) { tab = 1 }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (rows == null && err == null) item { repeat(3) { Shimmer(Modifier.fillMaxWidth().height(96.dp).padding(bottom = 10.dp)) } }
            err?.let { item { EmptyNote(it) } }
            if (rows != null && tab == 0) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrimaryButton("إضافة صف", KI.users, Modifier.weight(1f), height = 46.dp) { st.open(Screen.Web("/cards", "كروت الأسئلة")) }
                        SquareButton(KI.external, "طريقة الاستخدام على الموقع", size = 46.dp) { st.open(Screen.Web("/cards", "كروت الأسئلة")) }
                    }
                }
                if (classes.isEmpty()) item { EmptyNote("لا توجد صفوف بعد. أضف صفًا والصق أسماء الطلاب، ثم اطبع البطاقات ووزّعها بالترتيب.") }
                items(classes, key = { it.id }) { c ->
                    KCard(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBox(KI.users, Tone.Main, 40.dp, 20.dp)
                            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) { Text(c.title, style = T.h3); if (c.sub.isNotBlank()) Text(c.sub, style = T.small) }
                            Icon(KI.close, "حذف", Modifier.size(20.dp).press({ confirmDel = c }), tint = P.mute)
                        }
                        Spacer(Modifier.height(10.dp))
                        PrimaryButton("توليد أسئلة وبدء", KI.sparkle, Modifier.fillMaxWidth(), height = 46.dp) { st.open(Screen.CardsGen(c.id)) }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("طباعة البطاقات", style = T.label.copy(color = P.mainD), textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(P.mainL).press({ st.open(Screen.Web("/cards", "طباعة البطاقات")) }).padding(10.dp))
                            Text("الطلاب", style = T.label.copy(color = P.mainD), textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(P.mainL).press({ st.open(Screen.Web("/cards", "طلاب الصف")) }).padding(10.dp))
                        }
                    }
                }
            }
            if (rows != null && tab == 1) {
                if (sessions.isEmpty()) item { EmptyNote("لا توجد جلسات بعد. ابدأ من «صفوفي» ← «توليد أسئلة وبدء».") }
                items(sessions, key = { it.id }) { s ->
                    KCard(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(s.title, style = T.h3, maxLines = 2, overflow = TextOverflow.Ellipsis); if (s.sub.isNotBlank()) Text(s.sub, style = T.small) }
                            Icon(KI.close, "حذف", Modifier.size(20.dp).press({ confirmDel = s }), tint = P.mute)
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PrimaryButton("متابعة المسح", KI.target, Modifier.weight(1f), height = 46.dp) { st.open(Screen.CardsStart(s.id)) }
                            PrimaryButton("النتائج", KI.chart, Modifier.weight(1f), height = 46.dp, color = P.leafInk) { st.open(Screen.CardsResults(s.id)) }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }
    confirmDel?.let { d ->
        Confirm(if (d.kind == "cclass") "حذف الصف؟" else "حذف الجلسة؟",
            if (d.kind == "cclass") "سيُحذف الصف وقائمة طلابه (تبقى نتائج جلساته السابقة)." else "ستُحذف الجلسة وإجابات الطلاب فيها.",
            "حذف", danger = true, onDismiss = { confirmDel = null }) {
            confirmDel = null
            scope.launch { runCatching { st.api.deleteDoc(d.id) }.onFailure { st.host.toast(it.message ?: "تعذّر الحذف") }; reload++ }
        }
    }
}

/** نافذة تأكيد بسيطة بهوية التطبيق */
@Composable
fun Confirm(title: String, msg: String, ok: String, danger: Boolean = false, cancel: String = "إلغاء", onOutside: (() -> Unit)? = null, onDismiss: () -> Unit, onOk: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0x991E1A4D)).press(onOutside ?: onDismiss), contentAlignment = Alignment.Center) {
        KCard(Modifier.padding(28.dp).fillMaxWidth().press({}), pad = 20.dp, radius = 24.dp) {
            Text(title, style = T.h2)
            Text(msg, style = T.body.copy(color = P.mute), modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PrimaryButton(ok, modifier = Modifier.weight(1f), height = 46.dp, color = if (danger) P.danger else P.main, onClick = onOk)
                Text(cancel, style = T.h3, textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).border(1.dp, P.line, RoundedCornerShape(16.dp)).press(onDismiss).padding(13.dp))
            }
        }
    }
}

// ======================= توليد الأسئلة من بنك المنصة =======================
private data class BankQ(val raw: JsonObject, val lessonId: Long, val difficulty: String, val qid: String)
private data class BankLesson(val id: Long, val title: String, val unit: String, val unitName: String, val term: Int)

@Composable
fun CardsGenerate(st: AppState, classId: Long) {
    val scope = rememberCoroutineScope()
    var cls by remember { mutableStateOf<CClass?>(null) }
    var pool by remember { mutableStateOf<List<BankQ>?>(null) }
    var lessons by remember { mutableStateOf<List<BankLesson>>(emptyList()) }
    var err by remember { mutableStateOf<String?>(null) }
    val picked = remember { mutableStateListOf<Long>() }
    var count by remember { mutableStateOf(10) }
    var out by remember { mutableStateOf<List<BankQ>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(classId) {
        runCatching {
            val c = CClass(st.api.quizDoc(classId)); cls = c
            if (c.students.isEmpty()) error("أضف طلاب الصف أولًا من «الطلاب».")
            val b = st.api.getJson("/api/quiz/bank?key=" + c.course.encodeUrl())
            val items = b.arr("items").filter { it.s("type") == "mcq" && it.list("choices").size in 2..4 }
                .map { BankQ(it, it.s("lesson_id").toDoubleOrNull()?.toLong() ?: 0, it.s("difficulty"), it.s("qid").ifBlank { it.s("stem") }) }
            val has = items.groupingBy { it.lessonId }.eachCount()
            lessons = b.arr("lessons").map { BankLesson(it.s("id").toDoubleOrNull()?.toLong() ?: 0, it.s("title"), it.s("unit"), it.s("unit_name"), it.i("term", 1)) }.filter { (has[it.id] ?: 0) > 0 }
            pool = items
            // الافتراضي: دروس الفصل الحالي الأولى
            if (lessons.isEmpty()) error("لا توجد أسئلة اختيار من متعدد لهذا الصف بعد.")
        }.onFailure { err = it.message }
    }
    fun mk(q: BankQ): JsonObject {
        val l = lessons.firstOrNull { it.id == q.lessonId }
        return buildJsonObject {
            put("stem", q.raw.s("stem")); put("choices", q.raw["choices"] ?: JsonArray(emptyList())); put("correct", q.raw.i("correct"))
            put("ao", q.raw.s("ao")); put("difficulty", q.difficulty); put("qid", q.raw["qid"] ?: JsonPrimitive(q.qid))
            put("lesson_id", q.lessonId); put("lesson", l?.title ?: ""); put("table", q.raw["table"] ?: JsonNull)
        }
    }
    fun generate() {
        val p = pool ?: return
        if (picked.isEmpty()) { st.host.toast("اختر درسًا واحدًا على الأقل"); return }
        val by = p.filter { it.lessonId in picked }.shuffled().groupBy { it.lessonId }.mapValues { it.value.toMutableList() }
        val res = ArrayList<BankQ>(); var k = 0; val ids = picked.toList()
        while (res.size < count && by.values.any { it.isNotEmpty() } && k < count * ids.size * 4) { by[ids[k % ids.size]]?.let { if (it.isNotEmpty()) res.add(it.removeAt(0)) }; k++ }
        val DL = mapOf("منخفضة" to 0, "متوسطة" to 1, "مرتفعة" to 2)
        out = res.withIndex().sortedWith(compareBy({ DL[it.value.difficulty] ?: 1 }, { it.index })).map { it.value }
    }
    Column(Modifier.fillMaxSize()) {
        TopBar("توليد أسئلة", cls?.let { "${it.title} · ${it.subject} ${it.grade}" }, onBack = { st.handleBack() })
        err?.let { EmptyNote(it, Modifier.padding(16.dp)); return@Column }
        if (pool == null) { Box(Modifier.padding(16.dp)) { Shimmer(Modifier.fillMaxWidth().height(200.dp)) }; return@Column }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (out.isEmpty()) {
                item { Text("اختر الدروس", style = T.h3) }
                lessons.groupBy { "${it.term}|${it.unit}" }.forEach { (k, ls) ->
                    val all = ls.all { it.id in picked }
                    item(key = "u$k") {
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(P.mainL).press({ if (all) picked.removeAll(ls.map { it.id }) else ls.forEach { if (it.id !in picked) picked.add(it.id) } }).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Check(all)
                            Text((if (ls[0].term > 1) "ف${ls[0].term} · " else "") + "الوحدة ${ls[0].unit}${if (ls[0].unitName.isNotBlank()) ": " + ls[0].unitName else ""}", style = T.h3, modifier = Modifier.padding(start = 10.dp))
                        }
                    }
                    items(ls, key = { "l${it.id}" }) { l ->
                        val on = l.id in picked
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(P.paper).border(1.dp, if (on) P.main else P.line, RoundedCornerShape(12.dp)).press({ if (on) picked.remove(l.id) else picked.add(l.id) }).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Check(on)
                            Text(l.title, style = T.body, modifier = Modifier.weight(1f).padding(start = 10.dp))
                            Text("${pool!!.count { it.lessonId == l.id }}", style = T.small)
                        }
                    }
                }
            } else {
                item { Text("الأسئلة (${out.size})${if (out.size < count) " — المتاح في الدروس المختارة ${out.size} فقط" else ""}", style = T.h3) }
                itemsIndexed(out, key = { _, q -> q.qid }) { i, q ->
                    KCard(Modifier.fillMaxWidth()) {
                        Row {
                            Text("${i + 1}. ${q.raw.s("stem")}", style = T.body, modifier = Modifier.weight(1f))
                            Icon(KI.reload, "سؤال آخر", Modifier.padding(start = 8.dp).size(20.dp).press({
                                val used = out.map { it.qid }.toSet()
                                val alt = pool!!.filter { it.lessonId in picked && it.qid !in used }.shuffled().firstOrNull()
                                if (alt == null) st.host.toast("لا توجد أسئلة أخرى في الدروس المختارة") else out = out.toMutableList().also { it[i] = alt }
                            }), tint = P.main)
                            Icon(KI.close, "حذف", Modifier.padding(start = 8.dp).size(20.dp).press({ out = out.toMutableList().also { it.removeAt(i) } }), tint = P.mute)
                        }
                        q.raw.list("choices").forEachIndexed { k, ch ->
                            Text("${CardDetector.LET[k]}) $ch", style = T.small.copy(color = if (k == q.raw.i("correct")) P.leafInk else P.mute))
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(120.dp)) }
        }
        Column(Modifier.fillMaxWidth().background(P.paper).navigationBarsPadding().padding(16.dp)) {
            if (out.isEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("عدد الأسئلة", style = T.label, modifier = Modifier.padding(end = 10.dp))
                    listOf(5, 10, 15, 20, 25).forEach { n -> Box(Modifier.padding(end = 6.dp)) { Chip("$n", n == count) { count = n } } }
                }
                Spacer(Modifier.height(10.dp))
                PrimaryButton("توليد الأسئلة (${picked.size} درس)", KI.sparkle, Modifier.fillMaxWidth()) { generate() }
            } else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PrimaryButton(if (busy) "جارٍ الحفظ…" else "بدء الجلسة", KI.target, Modifier.weight(1f)) {
                    val c = cls ?: return@PrimaryButton
                    if (busy || out.isEmpty()) return@PrimaryButton
                    busy = true
                    scope.launch {
                        val qs = out.map(::mk)
                        val first = qs[0].s("lesson"); val lt = if (first.isNotBlank() && qs.all { it.s("lesson") == first }) first else "مراجعة"
                        val doc = buildJsonObject {
                            put("title", "$lt — ${c.title}"); put("classId", c.id); put("className", c.title); put("course", c.course)
                            put("subject", c.subject); put("grade", c.grade); put("date", todayStr(st.host.nowMillis())); put("questions", JsonArray(qs))
                            put("answers", JsonObject(emptyMap())); put("cur", 0); put("reveal", false)
                        }
                        runCatching { st.api.saveDoc("csession", doc) }
                            .onSuccess { (id, _) -> st.api.event("cards_session", null, qs.size.toString()); st.stack.removeAt(st.stack.lastIndex); st.open(Screen.CardsStart(id)) }
                            .onFailure { st.host.toast(it.message ?: "تعذّر الحفظ") }
                        busy = false
                    }
                }
                SquareButton(KI.reload, "توليد من جديد", size = 52.dp) { generate() }
                SquareButton(KI.back, "تغيير الدروس", size = 52.dp) { out = emptyList() }
            }
        }
    }
}

@Composable
private fun Check(on: Boolean) {
    Box(Modifier.size(22.dp).clip(RoundedCornerShape(7.dp)).background(if (on) P.main else Color.Transparent).border(1.5.dp, if (on) P.main else P.mute, RoundedCornerShape(7.dp)), contentAlignment = Alignment.Center) {
        if (on) Icon(KI.tick, null, Modifier.size(14.dp), tint = P.onMain)
    }
}

internal fun String.encodeUrl(): String = buildString {
    for (b in this@encodeUrl.encodeToByteArray()) {
        val c = b.toInt() and 0xFF
        if ((c in 'a'.code..'z'.code) || (c in 'A'.code..'Z'.code) || (c in '0'.code..'9'.code) || c == '-'.code || c == '_'.code || c == '.'.code) append(c.toChar())
        else { append('%'); append("0123456789ABCDEF"[c shr 4]); append("0123456789ABCDEF"[c and 15]) }
    }
}

/** التاريخ بصيغة الموقع (YYYY/M/D) بتوقيت مسقط */
internal fun todayStr(ms: Long): String {
    val days = (ms + 4 * 3600_000L) / 86_400_000L
    // تحويل أيام يونكس إلى تاريخ (خوارزمية هوارد هينانت)
    val z = days + 719468; val era = (if (z >= 0) z else z - 146096) / 146097; val doe = z - era * 146097
    val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153; val d = doy - (153 * mp + 2) / 5 + 1; val m = if (mp < 10) mp + 3 else mp - 9; val y = yoe + era * 400 + (if (m <= 2) 1 else 0)
    return "$y/$m/$d"
}

// ======================= بدء الجلسة: السبورة + الجوال =======================
@Composable
fun CardsStart(st: AppState, sid: Long) {
    var s by remember { mutableStateOf<CSession?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(sid) { runCatching { s = CSession(st.api.quizDoc(sid)) }.onFailure { err = it.message } }
    val board = st.api.base + "/cards?board=1&s=$sid"
    Column(Modifier.fillMaxSize()) {
        TopBar(s?.title ?: "الجلسة", s?.let { "${it.questions.size} سؤالًا · ${it.className}" }, onBack = { st.handleBack() })
        err?.let { EmptyNote(it, Modifier.padding(16.dp)) }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            KCard(Modifier.fillMaxWidth(), pad = 16.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) { IconBox(KI.screen, Tone.Accent); Text("1. اعرض الأسئلة على السبورة", style = T.h3, modifier = Modifier.padding(start = 10.dp)) }
                Text("على كمبيوتر الفصل افتح الرابط ده (بنفس حسابك)، وتتغير الأسئلة عليه تلقائيًا وأنت تتحكم من الجوال:", style = T.body.copy(color = P.mute), modifier = Modifier.padding(top = 8.dp))
                Text(board.removePrefix("https://"), style = T.label.copy(color = P.mainD), modifier = Modifier.padding(vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(P.mainL).padding(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("نسخ الرابط", style = T.label.copy(color = P.mainD), textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).border(1.dp, P.line, RoundedCornerShape(12.dp)).press({ st.host.copyText(board); st.host.toast("نُسخ الرابط") }).padding(10.dp))
                    Text("مشاركة", style = T.label.copy(color = P.mainD), textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).border(1.dp, P.line, RoundedCornerShape(12.dp)).press({ st.host.share(board) }).padding(10.dp))
                }
            }
            KCard(Modifier.fillMaxWidth(), pad = 16.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) { IconBox(KI.target, Tone.Leaf); Text("2. امسح البطاقات بالجوال", style = T.h3, modifier = Modifier.padding(start = 10.dp)) }
                Text("الطالب يدير بطاقته فيصبح حرف إجابته في الأعلى ويرفعها. وجّه الكاميرا للصف وتُسجَّل كل إجابة باسم صاحبها.", style = T.body.copy(color = P.mute), modifier = Modifier.padding(top = 8.dp))
                Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CardDetector.LET.forEachIndexed { k, l ->
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            MiniCard(k); Text("إجابتي $l", style = T.small, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
        }
        Box(Modifier.background(P.paper).navigationBarsPadding().padding(16.dp)) {
            PrimaryButton("ابدأ المسح بالكاميرا", KI.target, Modifier.fillMaxWidth(), height = 56.dp) { if (s != null) { st.stack.removeAt(st.stack.lastIndex); st.open(Screen.CardsLive(sid)) } }
        }
    }
}

/** رسم مصغّر لبطاقة مدارة بحيث يكون الحرف k في الأعلى */
@Composable
private fun MiniCard(k: Int) {
    val code = CardDetector.CODES[6]
    Canvas(Modifier.size(54.dp)) {
        val r = listOf(0f, -90f, 180f, 90f)[k]
        rotateCard(r) {
            val m = size.width * 0.11f; val cell = (size.width - 2 * m) / 6
            drawRect(Color.White)
            for (y in 0 until 6) for (x in 0 until 6) {
                val black = y == 0 || x == 0 || y == 5 || x == 5 || ((code shr ((y - 1) * 4 + (x - 1))) and 1) == 1
                if (black) drawRect(Color.Black, topLeft = androidx.compose.ui.geometry.Offset(m + x * cell, m + y * cell), size = androidx.compose.ui.geometry.Size(cell + .5f, cell + .5f))
            }
        }
        drawRect(Color(0xFFFFA216), topLeft = androidx.compose.ui.geometry.Offset(size.width * .35f, 0f), size = androidx.compose.ui.geometry.Size(size.width * .3f, size.width * .06f))
    }
}
private fun androidx.compose.ui.graphics.drawscope.DrawScope.rotateCard(deg: Float, block: androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit) {
    rotate(deg) { block() }
}
