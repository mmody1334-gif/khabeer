package site.khaber.app.cards

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import site.khaber.app.*
import site.khaber.app.ui.*

private val ORANGE = Color(0xFFF59E0B); private val BLUE = Color(0xFF2563EB); private val GREEN = Color(0xFF16A34A); private val RED = Color(0xFFDC2626)

// ======================= المسح الحي بالكاميرا =======================
@Composable
fun CardsLive(st: AppState, sid: Long) {
    val scope = rememberCoroutineScope()
    var live by remember { mutableStateOf<LiveSession?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var camErr by remember { mutableStateOf<String?>(null) }
    var sheet by remember { mutableStateOf(false) }
    var ask by remember { mutableStateOf(false) }
    var closing by remember { mutableStateOf(false) }
    LaunchedEffect(sid) {
        runCatching {
            val s = LiveSession.restore(st.host, CSession(st.api.quizDoc(sid)))
            if (s.questions.isEmpty()) error("لا توجد أسئلة في هذه الجلسة.")
            val c = CClass(st.api.quizDoc(s.classId))
            live = LiveSession(st, s, c, scope)
        }.onFailure { err = it.message ?: "تعذّر فتح الجلسة" }
    }
    fun finish() {
        val l = live ?: return
        if (closing) return
        closing = true
        scope.launch {
            val ok = l.close()
            closing = false
            if (!ok) st.host.toast("تعذّر الحفظ على المنصة — الإجابات محفوظة على جوالك وتُرسل عند عودة الاتصال")
            st.stack.removeAt(st.stack.lastIndex); st.open(Screen.CardsResults(sid))
        }
    }
    // زر الرجوع في الجهاز = نافذة «إنهاء المسح؟»
    DisposableEffect(Unit) { WebBack.handler = { ask = true; true }; onDispose { WebBack.handler = null } }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        val l = live
        if (l == null) {
            Text(err ?: "جارٍ فتح الجلسة…", style = T.body.copy(color = Color.White), modifier = Modifier.align(Alignment.Center).padding(24.dp))
            if (err != null) Box(Modifier.align(Alignment.TopStart).statusBarsPadding().padding(12.dp)) { SquareButton(KI.close, "رجوع", bg = Color.White.copy(.12f), fg = Color.White) { WebBack.handler = null; st.handleBack() } }
            return@Box
        }
        l.rev // إعادة الرسم مع كل تحديث
        val q = l.q; val a = l.answersNow(); val n = a.size; val showRW = l.s.reveal || l.mark
        CardCamera(Modifier.fillMaxSize(), onFrame = { hits, w, h -> l.onFrame(hits, w, h) }, onError = { camErr = it })
        Overlay(l, showRW)
        // ---- الرأس: السؤال والعدّاد ----
        Row(Modifier.fillMaxWidth().background(Color(0xB3000000)).statusBarsPadding().padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            SquareButton(KI.close, "إنهاء", size = 40.dp, bg = Color.White.copy(.12f), fg = Color.White) { ask = true }
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text("السؤال ${l.s.cur + 1} / ${l.s.questions.size}${if (l.s.reveal) " · الإجابة: ${CardDetector.LET[q.correct]}" else ""}", style = T.label.copy(color = Color(0xFFFFC978)))
                Text(q.stem, style = T.body.copy(color = Color.White, fontSize = 13.sp, lineHeight = 18.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("$n / ${l.total}", style = T.h2.copy(color = Color.White))
                if (showRW && n > 0) { val ok = a.values.count { it == q.correct }; Text("✓ $ok  ✗ ${n - ok}", style = T.small.copy(color = Color.White)) }
                Text(l.sync, style = T.small.copy(color = Color(0xFFC9C4F5), fontSize = 10.sp))
            }
        }
        // ---- الإجابة الصحيحة (للمعلم وحده) ----
        Column(Modifier.align(Alignment.TopEnd).padding(top = 86.dp, end = 12.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xCC1E1A4D)).padding(horizontal = 12.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("الإجابة", style = T.small.copy(color = Color(0xFFC9C4F5), fontSize = 10.sp))
            Text(CardDetector.LET[q.correct], style = T.h2.copy(color = Color(0xFFFFC978)))
        }
        if (showRW) Text("${CardDetector.LET[q.correct]}) ${q.choices.getOrElse(q.correct) { "" }}", style = T.h3.copy(color = Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.Center).clip(RoundedCornerShape(16.dp)).background(GREEN.copy(.85f)).padding(horizontal = 18.dp, vertical = 10.dp))
        camErr?.let { Text(it, style = T.body.copy(color = Color.White), textAlign = TextAlign.Center, modifier = Modifier.align(Alignment.Center).padding(32.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xCC000000)).padding(16.dp)) }
        // ---- أزرار التحكم ----
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(10.dp)) {
            Text(if (l.mark) "إخفاء الصح والخطأ" else "✓✗ أرِني الصح والخطأ (لك وحدك)", style = T.label.copy(color = Color.White, fontSize = 12.sp),
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp).clip(CircleShape).background(if (l.mark) GREEN else Color(0x99000000)).press({ l.mark = !l.mark }).padding(horizontal = 14.dp, vertical = 7.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CtlBtn("السابق", Modifier.weight(1f), enabled = l.s.cur > 0) { l.prev() }
                CtlBtn(if (l.s.reveal) "إخفاء" else "الإجابة", Modifier.weight(1f)) { l.toggleReveal() }
                CtlBtn(if (l.total - n > 0) "${l.total - n} بقي" else "سُجِّل الكل", Modifier.weight(1f)) { sheet = !sheet }
                CtlBtn(if (l.s.cur == l.s.questions.size - 1) "إنهاء ✓" else "التالي", Modifier.weight(1.3f), primary = true) { if (!l.next()) ask = true }
            }
        }
        if (sheet) Roster(l, showRW) { sheet = false }
        if (ask) Confirm("إنهاء المسح؟", "تُحفظ الإجابات، ويمكنك متابعة الجلسة لاحقًا.", if (closing) "جارٍ الحفظ…" else "إنهاء وعرض النتائج", cancel = "متابعة المسح", onDismiss = { ask = false }) { ask = false; finish() }
    }
}

@Composable
private fun CtlBtn(text: String, modifier: Modifier, enabled: Boolean = true, primary: Boolean = false, onClick: () -> Unit) {
    Box(modifier.height(48.dp).clip(RoundedCornerShape(14.dp)).background(if (primary) Color(0xFF4B40A9) else Color(0xCC1E1A4D)).press({ if (enabled) onClick() }), contentAlignment = Alignment.Center) {
        Text(text, style = T.h3.copy(color = if (enabled) Color.White else Color.White.copy(.35f), fontSize = 14.sp), maxLines = 1)
    }
}

/** إطار ملوّن واسم الطالب فوق كل بطاقة: برتقالي جارٍ القراءة · أزرق سُجِّلت · أخضر/أحمر عند إظهار الصح والخطأ */
@Composable
private fun Overlay(l: LiveSession, showRW: Boolean) {
    val tm = rememberTextMeasurer()
    var box by remember { mutableStateOf(IntSize(1, 1)) }
    val label = T.label.copy(color = Color.White, fontSize = 13.sp)
    Canvas(Modifier.fillMaxSize().onSizeChanged { box = it }) {
        val (fw, fh) = l.frame
        val sc = maxOf(size.width / fw, size.height / fh); val dx = (size.width - fw * sc) / 2; val dy = (size.height - fh * sc) / 2
        fun P(p: FloatArray) = Offset(dx + p[0] * sc, dy + p[1] * sc)
        val q = l.q
        for (h in l.hits) {
            val col = when { !h.ok -> ORANGE; showRW -> if (h.hit.ans == q.correct) GREEN else RED; else -> BLUE }
            val path = Path().apply { val c = h.hit.corners; moveTo(P(c[0]).x, P(c[0]).y); for (i in 1..3) lineTo(P(c[i]).x, P(c[i]).y); close() }
            drawPath(path, col.copy(alpha = .2f)); drawPath(path, col, style = Stroke(width = 4f))
            val top = h.hit.corners.minOf { P(it).y }; val cx = h.hit.corners.map { P(it).x }.average().toFloat()
            val mark = if (!h.ok) "" else if (showRW) (if (h.hit.ans == q.correct) "✓ " else "✗ ") else ""
            val text = if (h.wait) "⬇ ${h.name} · أنزِل البطاقة" else mark + h.name + if (h.ok) " · ${CardDetector.LET[h.hit.ans]}" else ""
            val m = tm.measure(text, label)
            val tl = Offset(cx - m.size.width / 2f - 8, top - m.size.height - 10)
            drawRect(Color(0xB3000000), topLeft = tl, size = androidx.compose.ui.geometry.Size(m.size.width + 16f, m.size.height + 6f))
            drawText(m, topLeft = Offset(tl.x + 8, tl.y + 3))
        }
    }
}

@Composable
private fun Roster(l: LiveSession, showRW: Boolean, onClose: () -> Unit) {
    val a = l.answersNow(); val q = l.q
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).press(onClose)) {
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(.75f).clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)).background(P.paper).press({}).padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(l.c.title, style = T.h2, modifier = Modifier.weight(1f))
                Text("${a.size} / ${l.total}", style = T.h3.copy(color = P.main))
            }
            Spacer(Modifier.height(10.dp))
            Column(Modifier.verticalScroll(rememberScrollState())) {
                l.c.students.chunked(3).forEach { row ->
                    Row(Modifier.padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { s ->
                            val v = a[s.n]
                            val bg = when { v == null -> P.bg; showRW -> if (v == q.correct) P.leafL else P.danger.copy(.12f); else -> P.mainL }
                            Row(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(bg).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("${s.n}", style = T.small.copy(fontSize = 10.sp), modifier = Modifier.padding(end = 4.dp))
                                Text(s.name, style = T.small.copy(color = P.ink), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                if (v != null) Text(CardDetector.LET[v], style = T.label.copy(color = P.mainD))
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

// ======================= النتائج =======================
@Composable
fun CardsResults(st: AppState, sid: Long) {
    var data by remember { mutableStateOf<Pair<CSession, CClass?>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(sid) {
        runCatching {
            val s = LiveSession.restore(st.host, CSession(st.api.quizDoc(sid)))
            data = s to runCatching { CClass(st.api.quizDoc(s.classId)) }.getOrNull()
        }.onFailure { err = it.message }
    }
    Column(Modifier.fillMaxSize()) {
        TopBar("النتائج", data?.first?.title, onBack = { st.handleBack() })
        err?.let { EmptyNote(it, Modifier.padding(16.dp)) }
        val (s, c) = data ?: run { if (err == null) Box(Modifier.padding(16.dp)) { Shimmer(Modifier.fillMaxWidth().height(160.dp)) }; return@Column }
        val R = remember(s) { CResults(s, c) }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                site.khaber.app.Stat("${kotlin.math.round(R.avg * 100).toInt()}%", "متوسط الصف", P.main, Modifier.weight(1f))
                site.khaber.app.Stat("${R.asked.size}/${s.questions.size}", "سؤالًا عُرض", P.accentInk, Modifier.weight(1f))
                site.khaber.app.Stat("${R.students.count { it.answered > 0 }}", "طالبًا شارك", P.leafInk, Modifier.weight(1f))
            }
            if (R.asked.isEmpty()) EmptyNote("لم تُسجَّل إجابات بعد في هذه الجلسة.")
            Text("الأسئلة", style = T.h3)
            R.qs.forEach { x ->
                val q = s.questions[x.i]
                KCard(Modifier.fillMaxWidth()) {
                    Row { Text("${x.i + 1}. ${q.stem}", style = T.body, modifier = Modifier.weight(1f), maxLines = 3, overflow = TextOverflow.Ellipsis); Text(if (x.n > 0) "${kotlin.math.round(x.p * 100).toInt()}%" else "—", style = T.h3.copy(color = if (x.p >= .7f) P.leafInk else if (x.p >= .4f) P.accentInk else P.danger)) }
                    if (x.n > 0) Row(Modifier.padding(top = 8.dp).fillMaxWidth().height(8.dp).clip(CircleShape)) {
                        x.dist.forEachIndexed { k, v -> if (v > 0) Box(Modifier.weight(v.toFloat()).fillMaxHeight().background(if (k == q.correct) P.leaf else P.line)) }
                    }
                    if (x.n > 0) Text(q.choices.indices.joinToString("   ") { "${CardDetector.LET[it]}: ${x.dist[it]}" }, style = T.small, modifier = Modifier.padding(top = 4.dp))
                }
            }
            if (R.students.isNotEmpty()) {
                Text("الطلاب", style = T.h3)
                Column(Modifier.clip(RoundedCornerShape(18.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(18.dp))) {
                    R.students.sortedByDescending { it.ok }.forEach { x ->
                        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("${x.n}", style = T.small, modifier = Modifier.width(26.dp))
                            Text(x.name, style = T.body, modifier = Modifier.weight(1f))
                            Text(if (x.answered == 0) "غائب" else "${x.ok} / ${R.asked.size}", style = T.label.copy(color = if (x.answered == 0) P.mute else P.mainD))
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
        Row(Modifier.background(P.paper).navigationBarsPadding().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrimaryButton("متابعة المسح", KI.target, Modifier.weight(1f), height = 50.dp) { st.stack.removeAt(st.stack.lastIndex); st.open(Screen.CardsLive(sid)) }
            PrimaryButton("التقرير والطباعة", KI.doc, Modifier.weight(1f), height = 50.dp, color = P.leafInk) { st.open(Screen.Web("/cards", "كروت الأسئلة")) }
        }
    }
}
