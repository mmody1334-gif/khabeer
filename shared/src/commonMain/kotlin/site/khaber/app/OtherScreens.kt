package site.khaber.app

import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import site.khaber.app.ui.*

// ======================= الفصل الدراسي =======================
@Composable
fun TermScreen(st: AppState) {
    val m = st.manifest
    var mine by remember { mutableStateOf(true) }
    val all = m?.courses.orEmpty().sortedWith(compareBy({ if (it.t2 > 0) 0 else 1 }, { GRADE_ORDER.indexOf(it.grade).let { i -> if (i < 0) 99 else i } }, { it.subject }))
    val ready = all.count { it.t2 > 0 }
    val pct = if (all.isEmpty()) 0 else (ready * 100 / all.size)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(12.dp))
        Text("العام الدراسي ${m?.year ?: ""}", style = T.small)
        Text("الفصل الدراسي الثاني", style = T.display)
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(P.hero).padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            val a by animateFloatAsState(pct / 100f, tween(900), label = "ring")
            Box(Modifier.size(68.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) {
                    drawArc(Color.White.copy(.15f), 0f, 360f, false, style = Stroke(10f))
                    drawArc(Color(0xFFFFA216), -90f, 360f * a, false, style = Stroke(10f, cap = StrokeCap.Round))
                }
                Text("$pct%", style = T.h3.copy(color = Color.White))
            }
            Column(Modifier.weight(1f).padding(start = 14.dp)) {
                Text(if (ready == 0) "نجهّز موادك الآن" else "$ready من ${all.size} جاهزة", style = T.h3.copy(color = Color.White))
                Text(m?.note2?.ifBlank { null } ?: "تصلك الدروس تلقائيًا فور رفعها على المنصة — بلا تحديث للتطبيق.", style = T.small.copy(color = Color(0xFFC9C4F5)))
            }
        }
        Row(Modifier.padding(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip("موادي", mine) { mine = true }
            Chip("ابدأ الفصل الثاني", false) { st.setTerm(2); st.selectTab(Tab.Lessons) }
            if (st.termPick != 0) Chip("تلقائي", false) { st.setTerm(0) }
        }
        val list = if (mine) all.filter { c -> st.courses.any { "${it.first}|${it.second}" == c.key } }.ifEmpty { all } else all
        if (list.isEmpty()) EmptyNote(if (st.syncing) "جارٍ التحميل…" else "لا توجد مواد مفعّلة لحسابك بعد.")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            list.forEach { c ->
                val (label, tone) = when {
                    c.t2 > 0 -> "جاهز" to Tone.Leaf
                    c.t2Status == "soon" -> "قريبًا" to Tone.Main
                    else -> "قيد التجهيز" to Tone.Accent
                }
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(18.dp))
                        .press({ if (c.t2 > 0) { st.pickCourse(c.key); st.setTerm(2); st.selectTab(Tab.Lessons) } }).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(toneBg(tone)), contentAlignment = Alignment.Center) {
                        Text(gradeShort(c.grade), style = T.h3.copy(color = toneFg(tone), fontFamily = KFonts.display))
                    }
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(c.subject, style = T.h3)
                        Text(if (c.t2 > 0) "${c.t2} درسًا للفصل الثاني" else "${c.t1} درسًا في الفصل الأول", style = T.small)
                    }
                    Pill(label, tone)
                }
            }
        }
        Spacer(Modifier.height(110.dp))
    }
}

// ======================= حسابي =======================
@Composable
fun AccountScreen(st: AppState) {
    val m = st.manifest
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(12.dp))
        Text("حسابي", style = T.display)
        Spacer(Modifier.height(14.dp))
        KCard(Modifier.fillMaxWidth(), pad = 16.dp, radius = 24.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(P.mainL), contentAlignment = Alignment.Center) { Text((m?.userName ?: "؟").take(1), style = T.h2.copy(color = P.main)) }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(m?.userName ?: "—", style = T.h2)
                    Text(m?.raw?.obj("user")?.s("username") ?: "", style = T.small)
                }
            }
            m?.paidUntil?.let {
                val d = ((it - st.host.nowMillis()) / 86_400_000L).toInt()
                Spacer(Modifier.height(12.dp))
                Text(if (d >= 0) "اشتراكك ساري — باقٍ $d يومًا" else "انتهى اشتراكك", style = T.body.copy(color = if (d >= 0) P.leafInk else P.danger))
            }
        }
        Spacer(Modifier.height(14.dp))
        if (st.updateAvailable) { UpdateCard(st); Spacer(Modifier.height(14.dp)) }
        Column(Modifier.clip(RoundedCornerShape(20.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(20.dp))) {
            Row1(KI.bell, "الإشعارات", if (st.unread > 0) "${st.unread} جديد" else null) { st.open(Screen.Notices) }
            Row1(KI.grid, "كل الأدوات", null) { st.open(Screen.Tools) }
            Row1(KI.reload, "مزامنة الدروس الآن", if (st.syncing) "جارٍ…" else null) { st.refresh() }
            Row1(KI.globe, "فتح المنصة كاملة", null) { st.open(Screen.Web("/app", "منصة خبير")) }
            Row1(KI.external, "سياسة الخصوصية", null) { st.open(Screen.Web("/privacy", "سياسة الخصوصية")) }
            Row1(KI.logout, "تسجيل الخروج", null, danger = true) { st.logout() }
        }
        Spacer(Modifier.height(16.dp))
        Text("خبير — الإصدار ${st.host.versionName}${st.latestVersion?.let { " · أحدث إصدار $it" } ?: ""}", style = T.small, modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Spacer(Modifier.height(110.dp))
    }
}

@Composable
private fun Row1(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, badge: String?, danger: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().press(onClick, label = title).padding(horizontal = 14.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(22.dp), tint = if (danger) P.danger else P.main)
        Text(title, style = T.h3.copy(color = if (danger) P.danger else P.ink), modifier = Modifier.weight(1f).padding(horizontal = 12.dp))
        badge?.let { Pill(it, Tone.Accent) }
        Icon(KI.fwd, null, Modifier.padding(start = 6.dp).size(16.dp), tint = P.mute)
    }
}

// ======================= كل الأدوات =======================
@Composable
fun ToolsScreen(st: AppState) {
    val m = st.manifest
    Column(Modifier.fillMaxSize()) {
        TopBar("كل الأدوات", "مرتبة حسب يومك الدراسي", onBack = { st.handleBack() })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            m?.flow.orEmpty().forEach { f ->
                val ts = f.keys.mapNotNull { k -> m!!.tools.firstOrNull { it.key == k } }
                if (ts.isEmpty()) return@forEach
                Column {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(f.name, style = T.h2.copy(fontSize = 16.sp))
                        Text(" · ${f.sub}", style = T.small)
                    }
                    Spacer(Modifier.height(8.dp))
                    Column(Modifier.clip(RoundedCornerShape(20.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(20.dp))) {
                        ts.forEach { t ->
                            Row(Modifier.fillMaxWidth().press({ st.openTool(t) }, label = t.title).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                IconBox(KI.byName(t.icon), toneOf(t.tone), 40.dp, 20.dp)
                                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                    Text(t.title, style = T.h3)
                                    Text(t.sub, style = T.small, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                Icon(KI.fwd, null, Modifier.size(16.dp), tint = P.mute)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(30.dp))
        }
    }
}

// ======================= الإشعارات =======================
@Composable
fun NoticesScreen(st: AppState) {
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { runCatching { st.notices = st.api.notices() } }
    Column(Modifier.fillMaxSize()) {
        TopBar("الإشعارات", onBack = { st.handleBack() })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (st.notices.isEmpty()) EmptyNote("لا توجد إشعارات.")
            st.notices.forEach { n ->
                KCard(Modifier.fillMaxWidth().press({
                    if (!n.read) { st.notices = st.notices.map { if (it.id == n.id) it.copy(read = true) else it }; scope.launch { st.api.markRead(n.id) } }
                    if (n.url.isNotBlank()) { if (n.url.startsWith("/")) st.open(Screen.Web(n.url, n.title)) else st.host.openExternal(n.url) }
                }), bg = if (n.read) P.paper else P.mainL) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (!n.read) Box(Modifier.size(8.dp).clip(CircleShape).background(P.owl))
                        Text(n.title, style = T.h3, modifier = Modifier.padding(start = if (n.read) 0.dp else 8.dp))
                    }
                    if (n.body.isNotBlank()) Text(n.body, style = T.body.copy(color = P.mute), modifier = Modifier.padding(top = 4.dp))
                }
            }
            Spacer(Modifier.height(30.dp))
        }
    }
}


// ======================= صفحة ويب داخل شاشة أصلية =======================
@Composable
fun WebPage(st: AppState, path: String, title: String) {
    var t by remember { mutableStateOf(title) }
    Column(Modifier.fillMaxSize()) {
        TopBar(t, onBack = { st.handleBack() })
        Box(Modifier.weight(1f)) {
            WebModuleScreen(st.host, st.api.base + path, st.manifest?.webCss ?: "", onOpenNour = { st.openNourUrl(it) }, onTitle = { if (it.isNotBlank()) t = it.substringBefore(" · ") })
        }
    }
}

// ======================= نور =======================
@Composable
fun NourPage(st: AppState, visible: Boolean) {
    var hidden by remember(st.nourJob) { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(P.dock)) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                SquareButton(KI.close, "إغلاق نور", size = 44.dp, bg = Color.White.copy(.08f), fg = Color.White) { st.closeNour() }
                Row(Modifier.weight(1f).padding(horizontal = 8.dp).height(44.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(.1f)).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(KI.lock, null, Modifier.size(14.dp), tint = Color(0xFF4ADE9E))
                    Text("lms.moe.gov.om", style = T.small.copy(color = Color.White), modifier = Modifier.padding(start = 8.dp))
                }
                SquareButton(KI.reload, "تحديث", size = 44.dp, bg = Color.White.copy(.08f), fg = Color.White) { st.nourProgress = NourProgress(); NourControl.reload?.invoke() }
            }
            Box(Modifier.weight(1f).clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)).background(Color.White)) {
                NourScreen(st.host, st.nourJob, onProgress = { st.nourProgress = it }, onJobTaken = { })
            }
        }
        val job = st.nourJob
        if (job != null && job.kind == "prep" && !hidden) Box(Modifier.align(Alignment.BottomCenter)) {
            if (st.nourProgress.loggedOut) LoginHint { hidden = true } else NourSheet(st, job) { hidden = true }
        }
    }
}

@Composable
private fun LoginHint(onHide: () -> Unit) {
    Row(
        Modifier.navigationBarsPadding().padding(12.dp).fillMaxWidth().shadow(20.dp, RoundedCornerShape(20.dp)).clip(RoundedCornerShape(20.dp)).background(P.dock).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Logo(30.dp, 8.dp)
        Text("سجّل الدخول إلى نور — بعده يكمل خبير التعبئة تلقائيًا", style = T.small.copy(color = Color.White), modifier = Modifier.weight(1f).padding(horizontal = 10.dp))
        Text("إخفاء", style = T.label.copy(color = Color(0xFFC9C4F5)), modifier = Modifier.press(onHide).padding(6.dp))
    }
}

/** زر التحديث في شريط نور (يضبطه المتصفح) */
object NourControl { var reload: (() -> Unit)? = null; var back: (() -> Boolean)? = null }

@Composable
private fun NourSheet(st: AppState, job: NourJob, onHide: () -> Unit) {
    val p = st.nourProgress
    val steps = listOf(
        "صفحة الصف" to p.onPrep, "العنوان" to p.title,
        "النصوص${if (p.editorsTotal > 0) " ${p.editors}/${p.editorsTotal}" else ""}" to (p.editorsTotal > 0 && p.editors >= minOf(p.editorsTotal, 6)),
        "المخرجات" to p.outcomes, "المستوى" to p.level, "الاستراتيجيات" to p.strategies, "المصادر" to p.resources,
    )
    val done = steps.count { it.second }
    val running = steps.indexOfFirst { !it.second }
    Column(
        Modifier.navigationBarsPadding().padding(12.dp).fillMaxWidth().shadow(30.dp, RoundedCornerShape(26.dp)).clip(RoundedCornerShape(26.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(26.dp)).padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Logo(38.dp, 10.dp)
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text(when { p.loggedOut -> "سجّل الدخول إلى نور أولًا"; done == steps.size -> "اكتملت التعبئة — راجع واحفظ"; else -> "خبير يعبّئ التحضير…" }, style = T.h3.copy(fontFamily = KFonts.display, fontSize = 16.sp))
                Text(if (p.loggedOut) "بعد الدخول يكمل خبير التعبئة تلقائيًا" else "$done من ${steps.size} خطوات · ${job.title}", style = T.small, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text("إخفاء", style = T.label, modifier = Modifier.clip(RoundedCornerShape(12.dp)).border(1.dp, P.line, RoundedCornerShape(12.dp)).press(onHide).padding(horizontal = 12.dp, vertical = 8.dp))
        }
        val a by animateFloatAsState(done / steps.size.toFloat(), tween(500), label = "p")
        Box(Modifier.padding(vertical = 12.dp).fillMaxWidth().height(6.dp).clip(CircleShape).background(P.mainL)) {
            Box(Modifier.fillMaxWidth(a).fillMaxHeight().clip(CircleShape).background(P.main))
        }
        steps.chunked(2).forEachIndexed { r, row ->
            Row(Modifier.padding(vertical = 4.dp)) {
                row.forEachIndexed { c, (label, ok) ->
                    val i = r * 2 + c
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                        StepDot(ok, running == i && !p.loggedOut)
                        Text(label, style = T.label.copy(color = if (ok || running == i) P.ink else P.mute), modifier = Modifier.padding(start = 8.dp))
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        Text("الحفظ والنشر يبقيان بيدك — خبير لا يضغط «حفظ» في نور أبدًا.", style = T.small.copy(color = P.accentInk),
            modifier = Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(P.accentL).padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

@Composable
private fun StepDot(ok: Boolean, run: Boolean) {
    if (ok) Box(Modifier.size(22.dp).clip(CircleShape).background(P.leaf), contentAlignment = Alignment.Center) { Icon(KI.tick, null, Modifier.size(13.dp), tint = Color.White) }
    else if (run) {
        val t = rememberInfiniteTransition(label = "r"); val rot by t.animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "rot")
        Canvas(Modifier.size(22.dp)) { drawArc(Color(0xFFFFA216), rot, 270f, false, style = Stroke(5f, cap = StrokeCap.Round)) }
    } else Box(Modifier.size(22.dp).clip(CircleShape).border(2.dp, P.line, CircleShape))
}
