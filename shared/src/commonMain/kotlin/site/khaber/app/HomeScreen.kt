package site.khaber.app

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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.khaber.app.ui.*

@Composable
fun HomeScreen(st: AppState) {
    val m = st.manifest
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        // ---- الرأس النيلي ----
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp)).background(P.hero)
                .statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 72.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Logo(42.dp, 12.dp)
                Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                    Text(if (st.host.hour() < 12) "صباح الخير" else "مساء الخير", style = T.small.copy(color = Color(0xFFC9C4F5)))
                    Text(m?.userName?.ifBlank { null } ?: "أهلًا بك", style = T.h2.copy(color = Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box {
                    SquareButton(KI.bell, "الإشعارات", size = 44.dp, bg = Color.White.copy(.08f), fg = Color.White) { st.open(Screen.Notices) }
                    if (st.unread > 0) Box(Modifier.align(Alignment.TopEnd).padding(9.dp).size(8.dp).clip(CircleShape).background(P.owl))
                }
            }
            Spacer(Modifier.height(18.dp))
            TermSwitch(st.term, onDark = true, badge2 = m?.badge2 ?: "", label1 = m?.termLabel(1) ?: "الفصل الأول", label2 = m?.termLabel(2) ?: "الفصل الثاني") { st.setTerm(it) }
        }
        // ---- درسك القادم ----
        val next = st.nextLesson?.takeIf { it.term == st.term } ?: st.courseOf(st.courseKey)?.let { c -> st.lessonsOf(c.first, c.second, st.term).firstOrNull { !it.isEmpty } }
            ?: st.courses.firstNotNullOfOrNull { c -> st.lessonsOf(c.first, c.second, st.term).firstOrNull { !it.isEmpty } }
        Box(Modifier.padding(horizontal = 16.dp).offset(y = (-52).dp)) {
            Column(Modifier.fillMaxWidth().shadow(16.dp, RoundedCornerShape(24.dp), spotColor = Color(0x331E1A4D)).clip(RoundedCornerShape(24.dp)).background(P.paper).padding(16.dp)) {
                if (next == null) {
                    if (st.lessons.isEmpty() && st.syncing) { Shimmer(Modifier.fillMaxWidth().height(20.dp)); Spacer(Modifier.height(10.dp)); Shimmer(Modifier.fillMaxWidth(.6f).height(16.dp)); Spacer(Modifier.height(14.dp)); Shimmer(Modifier.fillMaxWidth().height(48.dp)) }
                    else {
                        Text(if (st.term == 2) "دروس الفصل الثاني قيد التجهيز" else "لا توجد دروس بعد", style = T.h3)
                        Text(m?.note2?.takeIf { st.term == 2 } ?: "تظهر دروس موادك هنا فور تفعيلها على المنصة.", style = T.small)
                        Spacer(Modifier.height(12.dp))
                        PrimaryButton("عرض حالة المواد", KI.calendar, Modifier.fillMaxWidth()) { st.selectTab(Tab.Term) }
                    }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (st.lastLessonId == next.id) "آخر درس فتحته" else "درسك القادم", style = T.small, modifier = Modifier.weight(1f))
                        if (next.isEmpty) Pill("فارغ", Tone.Accent) else Pill("جاهز للإرسال", Tone.Leaf)
                    }
                    Text(next.title, style = T.h2.copy(fontSize = 19.sp, lineHeight = 30.sp), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                    Text("${next.subject} · الصف ${next.grade} · الوحدة ${next.unit}", style = T.small)
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrimaryButton("أرسل إلى نور", KI.send, Modifier.weight(1f), height = 48.dp) { st.sendPrep(next) }
                        SquareButton(KI.fwd, "فتح الدرس", size = 48.dp) { st.openLesson(next) }
                    }
                }
            }
        }
        Column(Modifier.offset(y = (-38).dp).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            st.syncError?.let { EmptyNote(it) }
            if (!m?.banner.isNullOrBlank()) KCard(Modifier.fillMaxWidth(), bg = P.accentL, border = false) { Text(m!!.banner, style = T.body) }
            if (st.updateAvailable) UpdateCard(st)
            // ---- الأرقام ----
            val days = m?.paidUntil?.let { ((it - st.host.nowMillis()) / 86_400_000L).toInt().coerceAtLeast(0) }
            val termCount = st.lessons.count { it.term == st.term }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("${st.sentPrep}", "تحضير أرسلته", P.main, Modifier.weight(1f))
                Stat("$termCount", "درسًا في ${if (st.term == 2) "الفصل الثاني" else "الفصل الأول"}", P.accentInk, Modifier.weight(1f))
                if (days != null) Stat("$days", "يومًا في اشتراكك", P.leafInk, Modifier.weight(1f))
                else Stat("${st.courses.size}", if (st.courses.size == 1) "مادة لك" else "مواد لك", P.leafInk, Modifier.weight(1f))
            }
            // ---- الأدوات ----
            Row(verticalAlignment = Alignment.Bottom) {
                Text("أدواتك", style = T.h2.copy(fontSize = 16.sp), modifier = Modifier.weight(1f))
                Text("الكل (${m?.tools?.size ?: 0})", style = T.label.copy(color = P.main), modifier = Modifier.press({ st.open(Screen.Tools) }).padding(6.dp))
            }
            val tools = m?.let { mm -> mm.homeTools.mapNotNull { k -> mm.tools.firstOrNull { it.key == k } } }.orEmpty()
            tools.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { t -> ToolTile(t, Modifier.weight(1f)) { st.openTool(t) } }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            Spacer(Modifier.height(80.dp))
        }
    }
}

@Composable
fun Stat(n: String, label: String, color: Color, modifier: Modifier) {
    KCard(modifier, pad = 12.dp, radius = 18.dp) {
        Text(n, style = T.num.copy(color = color))
        Text(label, style = T.small.copy(fontSize = 11.sp), maxLines = 2)
    }
}

@Composable
fun ToolTile(t: Tool, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(18.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(18.dp)).press(onClick, label = t.title).padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        IconBox(KI.byName(t.icon), toneOf(t.tone))
        Spacer(Modifier.height(6.dp))
        Text(t.title, style = T.label.copy(fontSize = 12.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun UpdateCard(st: AppState) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(P.mainL).press({ st.host.openExternal(st.manifest?.updateUrl?.ifBlank { null } ?: (st.api.base + "/download/khaber.apk")) }).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconBox(KI.update, Tone.Main, 38.dp, 20.dp)
        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
            Text("إصدار جديد من التطبيق", style = T.h3)
            Text("حمّله ويُثبَّت فوق الحالي بلا فقد لأي شيء", style = T.small)
        }
        Icon(KI.fwd, null, Modifier.size(18.dp), tint = P.main)
    }
}
