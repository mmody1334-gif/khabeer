package site.khaber.app

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.khaber.app.ui.*

@Composable
fun LessonsScreen(st: AppState) {
    var q by remember { mutableStateOf("") }
    val course = st.courseOf(st.courseKey)
    val open = remember { mutableStateMapOf<String, Boolean>() }
    val m = st.manifest
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.statusBarsPadding().padding(start = 16.dp, end = 16.dp, top = 12.dp)) {
            Text("دروسي", style = T.display)
            Spacer(Modifier.height(10.dp))
            SearchBox(q, "ابحث بعنوان الدرس أو الوحدة…") { q = it }
        }
        if (q.isBlank()) {
            val rowState = androidx.compose.foundation.lazy.rememberLazyListState()
            LaunchedEffect(course, st.courses.size) { val i = st.courses.indexOf(course); if (i > 0) rowState.animateScrollToItem(i) }
            LazyRow(state = rowState, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(st.courses) { c ->
                    val k = "${c.first}|${c.second}"
                    Chip("${c.first} ${gradeShort(c.second)}", course == c) { st.pickCourse(k) }
                }
            }
            Box(Modifier.padding(horizontal = 16.dp)) {
                TermSwitch(st.term, onDark = false, badge2 = m?.badge2 ?: "", label1 = m?.termLabel(1) ?: "الفصل الأول", label2 = m?.termLabel(2) ?: "الفصل الثاني") { st.setTerm(it) }
            }
        }
        val list = remember(q, course, st.term, st.lessons) {
            if (q.isNotBlank()) { val n = normAr(q); st.lessons.filter { normAr(it.title + " " + it.unitName).contains(n) }.take(60) }
            else course?.let { st.lessonsOf(it.first, it.second, st.term) }.orEmpty()
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 110.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (st.lessons.isEmpty()) {
                item { if (st.syncing) repeat(5) { Shimmer(Modifier.fillMaxWidth().height(58.dp).padding(bottom = 8.dp)) } else EmptyNote(st.syncError ?: "لا توجد دروس مفعّلة لحسابك بعد.") }
            } else if (q.isNotBlank()) {
                if (list.isEmpty()) item { EmptyNote("لا توجد دروس بهذا البحث — جرّب كلمة أقصر.") }
                items(list, key = { it.id }) { l -> LessonRow(st, l, showCourse = true) }
            } else if (list.isEmpty()) {
                item { EmptyNote(if (st.term == 2) (m?.note2?.ifBlank { null } ?: "دروس الفصل الثاني لهذه المادة قيد التجهيز، وتظهر هنا تلقائيًا فور رفعها.") else "لا توجد دروس للفصل الأول في هذه المادة.") }
            } else {
                list.groupBy { it.unit }.forEach { (unit, ls) ->
                    val k = "${course?.first}|${course?.second}|$unit"
                    val isOpen = open[k] ?: (ls.any { it.id == st.lastLessonId } || list.first().unit == unit)
                    item(key = "u$k") {
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(P.mainL).press({ open[k] = !isOpen }).padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(30.dp).clip(CircleShape).border(1.5.dp, P.main, CircleShape), contentAlignment = Alignment.Center) { Text(unit, style = T.label.copy(color = P.mainD)) }
                            Text(ls.first().unitName.ifBlank { "الوحدة $unit" }, style = T.h3, modifier = Modifier.weight(1f).padding(horizontal = 10.dp), maxLines = 2)
                            Text("${ls.size}", style = T.small)
                            Icon(if (isOpen) KI.up else KI.down, null, Modifier.padding(start = 6.dp).size(18.dp), tint = P.mute)
                        }
                    }
                    if (isOpen) items(ls, key = { it.id }) { l -> LessonRow(st, l, showCourse = false) }
                }
            }
        }
    }
}

@Composable
fun SearchBox(q: String, hint: String, onChange: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(14.dp)).background(P.paper).border(1.dp, P.line, RoundedCornerShape(14.dp)).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(KI.search, null, Modifier.size(18.dp), tint = P.mute)
        Box(Modifier.weight(1f).padding(horizontal = 8.dp)) {
            if (q.isEmpty()) Text(hint, style = T.body.copy(color = P.mute))
            BasicTextField(q, onChange, singleLine = true, textStyle = T.body.copy(fontSize = 15.sp), cursorBrush = SolidColor(P.main), modifier = Modifier.fillMaxWidth())
        }
        if (q.isNotEmpty()) Icon(KI.close, "مسح", Modifier.size(18.dp).press({ onChange("") }), tint = P.mute)
    }
}

@Composable
fun LessonRow(st: AppState, l: Lesson, showCourse: Boolean) {
    val sent = st.host.get("sent_${l.id}") != null
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(P.paper).border(1.dp, if (st.lastLessonId == l.id) P.main else P.line, RoundedCornerShape(16.dp))
            .press({ st.openLesson(l) }, label = l.title).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(l.title.ifBlank { "(بدون عنوان)" }, style = T.body.copy(fontSize = 14.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (showCourse) Text("${l.subject} · ${l.grade} · و ${l.unit}${if (l.term == 2) " · ف2" else ""}", style = T.small)
        }
        when {
            sent -> Pill("أُرسل ✓", Tone.Leaf)
            l.isEmpty -> Pill("فارغ", Tone.Accent)
        }
        Icon(KI.fwd, null, Modifier.padding(start = 6.dp).size(16.dp), tint = P.mute)
    }
}
