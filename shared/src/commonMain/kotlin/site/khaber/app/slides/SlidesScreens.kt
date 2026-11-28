package site.khaber.app.slides

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import site.khaber.app.*
import site.khaber.app.ui.*

/** عرض تقديمي: ملف PowerPoint عام على Google Drive */
data class Slide(val id: String, val name: String, val subject: String, val grade: String, val drive: String, val unit: String)

private val GN = mapOf("الأول" to 1, "الثاني" to 2, "الثالث" to 3, "الرابع" to 4, "الخامس" to 5, "السادس" to 6, "السابع" to 7, "الثامن" to 8, "التاسع" to 9, "العاشر" to 10, "الحادي عشر" to 11, "الثاني عشر" to 12)
private fun gnum(g: String) = GN[g.removePrefix("الصف ").trim()] ?: 99
private fun unitNum(u: String) = Regex("^(\\d+)\\s*-").find(u)?.groupValues?.get(1)?.toInt() ?: 999
private fun unitTitle(u: String) = u.replace(Regex("^\\d+\\s*-\\s*"), "")
private data class LessonNo(val u: Int, val l: Int, val t: String)
private fun lessonOf(n: String) = Regex("^(\\d+)-(\\d+)\\s*(.*)$").find(n)?.let { LessonNo(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].ifBlank { n }) }
/** بحث عربي يتجاهل التشكيل والهمزات والتاء المربوطة */
private fun norm(s: String) = s.replace(Regex("[\\u064b-\\u065f\\u0670]"), "").replace(Regex("[أإآ]"), "ا").replace('ى', 'ي').replace('ة', 'ه').lowercase()

fun slideUrls(d: String) = Triple(
    "https://drive.google.com/file/d/$d/preview",
    "https://drive.usercontent.google.com/download?id=$d&export=download",
    "https://drive.google.com/file/d/$d/view",
)

@Composable
fun SlidesHome(st: AppState) {
    var all by remember { mutableStateOf<List<Slide>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    fun parse(o: JsonObject) = o.arr("slides").map { Slide(it.s("id"), it.s("name"), it.s("subject"), it.s("grade"), it.s("drive"), it.s("unit")) }
    LaunchedEffect(reload) {
        err = null
        // القائمة المحفوظة أولًا (تفتح فورًا وبلا إنترنت)، ثم تُحدَّث من المنصة
        if (all == null) st.host.get("slides_cache")?.let { c -> runCatching { all = parse(J.parseToJsonElement(c).jsonObject) } }
        runCatching { st.api.getJson("/api/slides") }
            .onSuccess { o -> all = parse(o); st.host.put("slides_cache", o.toString()) }
            .onFailure { if (all == null) err = it.message ?: "تعذّر التحميل" }
    }
    val subjects = all?.map { it.subject }?.distinct()?.sorted().orEmpty()
    val mySubj = st.courseKey?.substringBefore("|")
    var subj by remember { mutableStateOf(st.host.get("slides_subj")) }
    val curSubj = subj?.takeIf { it in subjects } ?: mySubj?.takeIf { it in subjects } ?: subjects.firstOrNull()
    val grades = all?.filter { it.subject == curSubj }?.map { it.grade }?.distinct()?.sortedBy { gnum(it) }.orEmpty()
    var grade by remember { mutableStateOf(st.host.get("slides_grade")) }
    val myGrade = st.courseKey?.substringAfter("|")
    val curGrade = grade?.takeIf { it in grades } ?: myGrade?.takeIf { it in grades } ?: grades.firstOrNull()
    var q by remember { mutableStateOf("") }
    val open = remember { mutableStateMapOf<String, Boolean>() }

    Column(Modifier.fillMaxSize()) {
        TopBar("العروض التقديمية", "عروض البوربوينت حسب المادة والصف", onBack = { st.handleBack() })
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            err?.let { e -> item { EmptyNote(e); Spacer(Modifier.height(8.dp)); PrimaryButton("إعادة المحاولة", KI.reload, Modifier.fillMaxWidth()) { reload++ } } }
            if (all == null && err == null) item { repeat(4) { Shimmer(Modifier.fillMaxWidth().height(64.dp).padding(bottom = 10.dp)) } }
            if (all?.isEmpty() == true) item { EmptyNote("لا توجد عروض تقديمية بعد. تُضاف تباعًا حسب المادة والصف.") }
            if (!all.isNullOrEmpty()) {
                if (subjects.size > 1) item {
                    val rs = rememberLazyListState()
                    LaunchedEffect(curSubj) { subjects.indexOf(curSubj).takeIf { it >= 0 }?.let { rs.scrollToItem(it) } }
                    LazyRow(state = rs, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(subjects) { s -> Chip(s, s == curSubj) { subj = s; st.host.put("slides_subj", s); q = "" } }
                    }
                }
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(grades) { g ->
                            val n = all!!.count { it.subject == curSubj && it.grade == g }
                            Chip("${g.removePrefix("الصف ")} · $n", g == curGrade) { grade = g; st.host.put("slides_grade", g) }
                        }
                    }
                }
                item { SearchBox(q, "ابحث عن درس") { q = it } }
                val list = all!!.filter { it.subject == curSubj && it.grade == curGrade }
                    .filter { q.isBlank() || norm(it.name + " " + it.unit).contains(norm(q).trim()) }
                if (list.isEmpty()) item { EmptyNote(if (q.isBlank()) "لا توجد عروض لهذا الصف بعد." else "لا توجد نتائج") }
                val units = list.groupBy { it.unit.ifBlank { "أخرى" } }.toList().sortedWith(compareBy({ unitNum(it.first) }, { it.first }))
                units.forEach { (u, items) ->
                    val n = unitNum(u)
                    val expanded = q.isNotBlank() || open[u] == true || units.size == 1
                    item(key = "$curSubj|$curGrade|$u") {
                        KCard(Modifier.fillMaxWidth(), pad = 0.dp) {
                            Row(Modifier.fillMaxWidth().press({ open[u] = !(open[u] ?: false) }).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(P.mainL), contentAlignment = Alignment.Center) {
                                    Text(if (n < 999) "$n" else "…", style = T.label.copy(color = P.mainD, fontWeight = FontWeight.Bold))
                                }
                                Text(if (n < 999) unitTitle(u) else u, style = T.h3, modifier = Modifier.weight(1f).padding(horizontal = 10.dp))
                                Text("${items.size}", style = T.small)
                                Icon(if (expanded) KI.up else KI.down, null, Modifier.padding(start = 6.dp).size(18.dp), tint = P.mute)
                            }
                            AnimatedVisibility(expanded) {
                                Column {
                                    val les = items.mapNotNull { s -> lessonOf(s.name)?.let { s to it } }.sortedWith(compareBy({ it.second.u }, { it.second.l }))
                                    val extra = items.filter { lessonOf(it.name) == null }.sortedBy { it.name }
                                    les.forEach { (s, l) -> SlideRow(st, s, "${l.u}-${l.l}", l.t) }
                                    if (extra.isNotEmpty()) {
                                        Text("أسئلة ومراجعة وملفات أخرى", style = T.small.copy(fontWeight = FontWeight.Bold), modifier = Modifier.fillMaxWidth().background(P.bg).padding(horizontal = 14.dp, vertical = 8.dp))
                                        extra.forEach { s -> SlideRow(st, s, "", s.name) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SlideRow(st: AppState, s: Slide, num: String, title: String) {
    Row(
        Modifier.fillMaxWidth().border(0.5.dp, P.line).press({ st.open(Screen.SlideView(s.drive, s.name)) }, label = title).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(num, style = T.label.copy(color = P.main, fontWeight = FontWeight.Bold), textAlign = TextAlign.Center, modifier = Modifier.width(40.dp))
        Text(title, style = T.body, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(horizontal = 8.dp))
        Icon(KI.fwd, null, Modifier.size(14.dp), tint = P.mute)
    }
}

@Composable
fun SlideViewScreen(st: AppState, drive: String, name: String) {
    val (preview, download, view) = slideUrls(drive)
    LaunchedEffect(drive) { runCatching { st.api.postJson("/api/event", buildJsonObject { put("type", "slides_open"); put("detail", name); put("title", "") }) } }
    Column(Modifier.fillMaxSize()) {
        TopBar(name, "عرض تقديمي", onBack = { st.handleBack() })
        DocPreview(st.host, preview, Modifier.weight(1f).fillMaxWidth())
        Row(Modifier.fillMaxWidth().background(P.bg).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrimaryButton("تحميل", KI.folder, Modifier.weight(1f)) { st.host.download(download, name.take(80) + ".pptx") }
            PrimaryButton("فتح في Drive", null, Modifier.weight(1f), color = P.dock) { st.host.openExternal(view) }
        }
    }
}
