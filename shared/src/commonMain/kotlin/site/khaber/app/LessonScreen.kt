package site.khaber.app

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
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
fun LessonScreen(st: AppState, id: Long) {
    val l = st.lesson(id)
    if (l == null) { Column { TopBar("الدرس", onBack = { st.handleBack() }); EmptyNote("هذا الدرس لم يعد متاحًا.", Modifier.padding(16.dp)) }; return }
    var tab by remember { mutableStateOf(0) }
    val siblings = remember(l, st.lessons) { st.lessonsOf(l.subject, l.grade, l.term).filter { it.unit == l.unit } }
    val idx = siblings.indexOfFirst { it.id == l.id }
    val hw = remember(l) { Payload.hwItems(l) }
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(Modifier.statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                SquareButton(KI.back, "رجوع", size = 44.dp, bg = P.paper, fg = P.ink) { st.handleBack() }
                Text("${l.subject} · الصف ${l.grade} · ${if (l.term == 2) "ف2" else "ف1"}", style = T.small, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                SquareButton(KI.copy, "نسخ التحضير كاملًا", size = 44.dp, bg = P.paper, fg = P.accentInk) { st.host.copyText(Payload.copyAll(l, st.manifest)); st.host.toast("نُسخ التحضير كاملًا") }
            }
            Column(Modifier.padding(horizontal = 20.dp)) {
                Pill("الوحدة ${l.unit}${if (idx >= 0) " · الدرس ${idx + 1} من ${siblings.size}" else ""}", Tone.Main)
                Text(l.title, style = T.display, modifier = Modifier.padding(top = 10.dp))
                if (l.unitName.isNotBlank()) Text(l.unitName, style = T.small)
                if (siblings.size > 1) Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    siblings.forEachIndexed { i, s ->
                        Box(Modifier.weight(1f).height(6.dp).clip(CircleShape).background(if (i <= idx) P.main else P.line).press({ if (s.id != l.id) { st.stack.removeAt(st.stack.lastIndex); st.openLesson(s) } }))
                    }
                }
            }
            Row(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Chip("التحضير", tab == 0) { tab = 0 }
                Chip("الواجب (${hw.size})", tab == 1) { tab = 1 }
                Chip("الملخص", false) { st.open(Screen.Web("/summaries", "ملخصات الدروس")) }
            }
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (l.isEmpty) KCard(Modifier.fillMaxWidth(), bg = P.accentL, border = false) { Text("هذا الدرس فارغ حاليًا — يُستكمل على المنصة ويصلك تلقائيًا.", style = T.body) }
                if (tab == 0) {
                    var first = true
                    Payload.SECTIONS.forEach { (k, label) ->
                        val v = l.f(k)
                        if (v.isNotBlank()) { Section(label, v, k, startOpen = first) { st.host.copyText(v); st.host.toast("نُسخ: $label") }; first = false }
                    }
                } else {
                    if (hw.isEmpty()) EmptyNote("لا توجد أسئلة واجب لهذا الدرس.")
                    hw.forEachIndexed { i, h ->
                        KCard(Modifier.fillMaxWidth()) {
                            Text("السؤال ${i + 1}${if (h.choices.isNotEmpty()) " · اختيار من متعدد" else ""}", style = T.small)
                            SelectionContainer { Text(h.text, style = T.h3, modifier = Modifier.padding(vertical = 4.dp)) }
                            if (h.choices.isNotEmpty()) h.choices.forEach { c ->
                                Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (c == h.answer) P.leaf else P.line))
                                    Text(c, style = T.body.copy(color = if (c == h.answer) P.leafInk else P.ink), modifier = Modifier.padding(start = 8.dp))
                                }
                            } else if (h.answer.isNotBlank()) Text("الإجابة: ${h.answer}", style = T.body.copy(color = P.leafInk))
                        }
                    }
                }
                Spacer(Modifier.height(150.dp))
            }
        }
        // ---- شريط الإرسال ----
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().shadow(20.dp, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp), spotColor = Color(0x331E1A4D))
                .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(P.paper).navigationBarsPadding().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(P.leaf))
                Text(
                    if (tab == 0) "يُعبَّأ في نور: العنوان والنصوص والمخرجات والمستوى والاستراتيجيات والمصادر" else "يُنشأ الواجب في نور بأسئلته ودرجاته",
                    style = T.small, modifier = Modifier.padding(start = 8.dp), maxLines = 2,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (tab == 0) PrimaryButton("إرسال التحضير إلى نور", KI.send, Modifier.weight(1f), height = 54.dp) { st.sendPrep(l) }
                else PrimaryButton("إرسال الواجب إلى نور", KI.send, Modifier.weight(1f), height = 54.dp, color = if (hw.isEmpty()) P.mute else P.main) {
                    if (hw.isEmpty()) st.host.toast("لا توجد أسئلة في هذا الواجب") else st.sendHw(l)
                }
                if (idx >= 0 && idx + 1 < siblings.size) SquareButton(KI.fwd, "الدرس التالي", size = 54.dp, bg = P.bg) { st.stack.removeAt(st.stack.lastIndex); st.openLesson(siblings[idx + 1]) }
            }
        }
    }
}

@Composable
private fun Section(label: String, text: String, key: String, startOpen: Boolean, onCopy: () -> Unit) {
    var open by remember { mutableStateOf(startOpen) }
    val tone = when (key) { "outcomes", "formative", "closing" -> Tone.Main; "concepts", "pre_learning", "homework" -> Tone.Leaf; else -> Tone.Accent }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(18.dp))) {
        Row(Modifier.fillMaxWidth().press({ open = !open }).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(toneBg(tone)), contentAlignment = Alignment.Center) {
                Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(toneFg(tone)))
            }
            Text(label, style = T.h3.copy(fontSize = 14.sp), modifier = Modifier.weight(1f).padding(horizontal = 10.dp))
            Icon(if (open) KI.up else KI.down, null, Modifier.size(18.dp), tint = P.mute)
        }
        AnimatedVisibility(open) {
            Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 12.dp)) {
                SelectionContainer { Text(text.trim(), style = T.body.copy(color = P.ink.copy(alpha = .9f))) }
                Text("نسخ", style = T.label.copy(color = P.main), modifier = Modifier.padding(top = 6.dp).clip(RoundedCornerShape(10.dp)).background(P.mainL).press(onCopy).padding(horizontal = 14.dp, vertical = 6.dp))
            }
        }
    }
}
