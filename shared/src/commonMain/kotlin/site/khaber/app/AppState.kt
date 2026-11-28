package site.khaber.app

import androidx.compose.runtime.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

enum class Phase { Splash, Login, Main }
enum class Tab { Home, Lessons, Nour, Term, Account }

sealed class Screen {
    data class LessonPage(val id: Long) : Screen()
    data class Web(val path: String, val title: String) : Screen()
    data object Tools : Screen()
    data object Notices : Screen()
    data object Cards : Screen()
    data class CardsGen(val classId: Long) : Screen()
    data class CardsStart(val sid: Long) : Screen()
    data class CardsLive(val sid: Long) : Screen()
    data class CardsResults(val sid: Long) : Screen()
    data class Quiz(val hw: Boolean) : Screen()
    data object QuizDoc : Screen()
    data object Slides : Screen()
    data class SlideView(val drive: String, val name: String) : Screen()
}

/** الأدوات المبنية أصليًا في هذا الإصدار (الباقي يفتح صفحة الموقع داخل التطبيق) */
val NATIVE_TOOLS = setOf("cards", "quiz", "homework", "slides")

/** ما تفعله أزرار «رجوع» داخل صفحات الويب (يضبطه متصفح الشاشة الظاهرة) */
object WebBack { var handler: (() -> Boolean)? = null }

class AppState(val host: Host, private val scope: CoroutineScope) {
    val api = Api(host)
    var phase by mutableStateOf(Phase.Splash)
    var manifest by mutableStateOf(api.cachedManifest())
    var lessons by mutableStateOf<List<Lesson>>(emptyList())
    var syncing by mutableStateOf(false)
    var syncError by mutableStateOf<String?>(null)
    var tab by mutableStateOf(Tab.Home)
    val stack = mutableStateListOf<Screen>()
    var nourOpened by mutableStateOf(false)
    var nourJob by mutableStateOf<NourJob?>(null)
    var nourProgress by mutableStateOf(NourProgress())
    var notices by mutableStateOf<List<Notice>>(emptyList())
    var latestVersion by mutableStateOf<Int?>(null)
    private var prevTab = Tab.Home
    /** محرّك الاختبارات (كود الموقع في متصفح مخفي) والورقة المفتوحة */
    val quizEngine by lazy { site.khaber.app.quiz.QuizEngine(this) }
    var quizCur by mutableStateOf<site.khaber.app.quiz.QuizCur?>(null)
    val quizTab = HashMap<Boolean, Int>()

    /** 0 = حسب المنصة (التاريخ)، 1 أو 2 = اختيار المعلم */
    var termPick by mutableStateOf(host.get("term")?.toIntOrNull() ?: 0)
    val term: Int get() = if (termPick == 1 || termPick == 2) termPick else (manifest?.currentTerm ?: 1)
    fun setTerm(t: Int) {
        termPick = t; host.put("term", t.toString())
        // المادة المختارة بلا دروس في هذا الفصل: ننتقل لأول مادة فيها دروس له
        val c = courseOf(courseKey)
        if (c != null && lessonsOf(c.first, c.second, term).isEmpty()) {
            courses.firstOrNull { lessonsOf(it.first, it.second, term).isNotEmpty() }?.let { pickCourse("${it.first}|${it.second}") }
        }
    }

    var courseKey by mutableStateOf(host.get("course"))
    fun pickCourse(k: String) { courseKey = k; host.put("course", k) }

    var sentPrep by mutableStateOf(host.get("sent_prep")?.toIntOrNull() ?: 0)
    var sentHw by mutableStateOf(host.get("sent_hw")?.toIntOrNull() ?: 0)
    var lastLessonId by mutableStateOf(host.get("last_lesson")?.toLongOrNull())

    fun start() {
        if (api.sid.isNullOrBlank()) { phase = Phase.Login; return }
        scope.launch {
            api.cachedLessons()?.let { lessons = it }
            phase = Phase.Main
            refresh()
        }
    }

    fun refresh() = scope.launch {
        if (syncing) return@launch
        syncing = true; syncError = null
        try {
            manifest = api.manifest()
            if (manifest?.pending != true) lessons = api.lessons()
            runCatching { notices = api.notices() }
            latestVersion = api.latestVersion()
        } catch (e: ApiError) {
            if (e.code == 401) { api.sid = null; phase = Phase.Login }
            else syncError = e.message
        } catch (e: Exception) {
            syncError = if (lessons.isEmpty()) "تعذّر الاتصال بالمنصة. تأكد من الإنترنت ثم اسحب للتحديث." else "أنت تتصفح نسخة محفوظة على جهازك (بلا إنترنت)."
        } finally { syncing = false }
    }

    suspend fun login(u: String, p: String): String? = try {
        api.login(u, p); phase = Phase.Main; lessons = emptyList(); refresh(); null
    } catch (e: ApiError) { e.message } catch (e: Exception) { "تعذّر الاتصال بالمنصة. تأكد من الإنترنت." }

    fun logout() = scope.launch {
        api.logout(); host.put("lessons_etag", null); host.writeCache("lessons.json", ""); host.writeCache("manifest.json", "")
        lessons = emptyList(); manifest = null; stack.clear(); tab = Tab.Home; phase = Phase.Login
    }

    // ---------- المقررات والدروس ----------
    val courses: List<Pair<String, String>> by derivedStateOf {
        lessons.map { it.subject to it.grade }.distinct()
            .sortedWith(compareBy({ GRADE_ORDER.indexOf(it.second).let { i -> if (i < 0) 99 else i } }, { it.first }))
    }
    fun courseOf(k: String?) = courses.firstOrNull { "${it.first}|${it.second}" == k } ?: courses.firstOrNull()
    fun lessonsOf(subject: String, grade: String, term: Int) =
        lessons.filter { it.subject == subject && it.grade == grade && it.term == term }
            .sortedWith(compareBy({ it.unitNum }, { it.unit }, { if (it.lessonNoRaw > 0) it.lessonNoRaw else 0 }, { it.order }))
    fun lesson(id: Long) = lessons.firstOrNull { it.id == id }

    /** «درسك القادم»: آخر درس فتحه المعلم، وإلا أول درس غير فارغ في مقرره للفصل الحالي */
    val nextLesson: Lesson? by derivedStateOf {
        lastLessonId?.let { id -> lessons.firstOrNull { it.id == id } }?.let { last ->
            val list = lessonsOf(last.subject, last.grade, last.term)
            val i = list.indexOfFirst { it.id == last.id }
            if (host.get("sent_${last.id}") != null && i >= 0 && i + 1 < list.size) list[i + 1] else last
        } ?: courseOf(courseKey)?.let { c -> lessonsOf(c.first, c.second, term).firstOrNull { !it.isEmpty } }
    }

    // ---------- التنقل ----------
    fun open(s: Screen) { stack.add(s) }
    fun openLesson(l: Lesson) { lastLessonId = l.id; host.put("last_lesson", l.id.toString()); open(Screen.LessonPage(l.id)); scope.launch { api.event("view", l.id) } }
    fun openTool(t: Tool) {
        when {
            t.route == "native:lessons" -> { stack.clear(); tab = Tab.Lessons }
            t.key == "cards" -> open(Screen.Cards)
            t.key == "quiz" -> open(Screen.Quiz(false))
            t.key == "homework" -> open(Screen.Quiz(true))
            t.key == "slides" -> open(Screen.Slides)
            else -> open(Screen.Web(t.route, t.title))
        }
    }
    fun selectTab(t: Tab) { if (t == Tab.Nour) { prevTab = if (tab == Tab.Nour) prevTab else tab; nourOpened = true }; stack.clear(); tab = t }
    fun closeNour() { tab = prevTab }

    fun handleBack(): Boolean {
        WebBack.handler?.let { if (it()) return true }
        if (stack.lastOrNull() == Screen.QuizDoc) quizCur?.let { c -> if (c.dirty && c.items.isNotEmpty()) { c.askLeave = true; return true } }
        if (stack.isNotEmpty()) { stack.removeAt(stack.lastIndex); return true }
        if (tab == Tab.Nour) { if (NourControl.back?.invoke() == true) return true; closeNour(); return true }
        if (tab != Tab.Home) { tab = Tab.Home; return true }
        return false
    }

    // ---------- الإرسال إلى نور ----------
    fun sendPrep(l: Lesson) = send(NourJob("prep", Payload.prep(l, lessons, manifest), l.title, l.id)).also {
        sentPrep++; host.put("sent_prep", sentPrep.toString()); host.put("sent_${l.id}", "1"); scope.launch { api.event("send_prep", l.id, "app") }
    }
    fun sendHw(l: Lesson) = send(NourJob("homework", Payload.homework(l, lessons), l.title, l.id)).also {
        sentHw++; host.put("sent_hw", sentHw.toString()); scope.launch { api.event("send_hw", l.id, "app") }
    }
    /** من صفحات الويب: الأداة طلبت فتح نور على رابط معيّن (المهمة محفوظة في تخزين الأداة) */
    /** صفحة الكروت على الموقع طلبت المسح بالكاميرا: نفتح الماسح الأصلي */
    fun openCardsScan(id: Long) { open(Screen.CardsLive(id)) }
    fun openNourUrl(url: String?) { nourJob = NourJob("url", url ?: "", "", 0); nourProgress = NourProgress(); selectTab(Tab.Nour) }
    private fun send(job: NourJob) { nourJob = job; nourProgress = NourProgress(); selectTab(Tab.Nour) }

    val updateAvailable: Boolean get() = (latestVersion ?: 0) > host.versionCode
    val mustUpdate: Boolean get() = (manifest?.minVersion ?: 0) > host.versionCode
    val unread: Int get() = notices.count { !it.read }
}
