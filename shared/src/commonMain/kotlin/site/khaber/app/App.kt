package site.khaber.app

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import site.khaber.app.ui.*

@Composable
fun KhabeerApp(host: Host, onState: (AppState) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    val st = remember { AppState(host, scope).also(onState) }
    LaunchedEffect(Unit) { st.start() }
    KhabeerTheme {
        Box(Modifier.fillMaxSize().background(P.bg)) {
            AnimatedContent(st.phase, transitionSpec = { fadeIn(tween(350)) togetherWith fadeOut(tween(250)) }, label = "phase") { ph ->
                if (ph != Phase.Main) LaunchedEffect(ph) { st.host.setDarkStatusIcons(false) }
                when (ph) {
                    Phase.Splash -> SplashScreen(st)
                    Phase.Login -> LoginScreen(st)
                    Phase.Main -> MainScreen(st)
                }
            }
        }
    }
}

@Composable
private fun MainScreen(st: AppState) {
    val m = st.manifest
    if (m?.pending == true) { PendingScreen(st); return }
    val lightTop = st.stack.isEmpty() && (st.tab == Tab.Home || st.tab == Tab.Nour)
    val darkMode = P.dark
    LaunchedEffect(lightTop, darkMode) { st.host.setDarkStatusIcons(!lightTop && !darkMode) }
    Box(Modifier.fillMaxSize()) {
        // الشاشات الرئيسية
        Box(Modifier.fillMaxSize()) {
            when (st.tab) {
                Tab.Home -> HomeScreen(st)
                Tab.Lessons -> LessonsScreen(st)
                Tab.Term -> TermScreen(st)
                Tab.Account -> AccountScreen(st)
                Tab.Nour -> {}
            }
        }
        // نور: يبقى حيًّا بعد أول فتح (الجلسة والصفحة لا تضيعان عند التنقل)
        if (st.nourOpened) {
            val on = st.tab == Tab.Nour && st.stack.isEmpty()
            Box(Modifier.fillMaxSize().zIndex(if (on) 2f else -1f).alpha(if (on) 1f else 0f)) { NourPage(st, visible = on) }
        }
        // الشاشات المفتوحة فوق التبويبات
        st.stack.lastOrNull()?.let { s ->
            Box(Modifier.fillMaxSize().zIndex(3f).background(P.bg)) {
                key(s) {
                    when (s) {
                        is Screen.LessonPage -> LessonScreen(st, s.id)
                        is Screen.Web -> WebPage(st, s.path, s.title)
                        Screen.Tools -> ToolsScreen(st)
                        Screen.Notices -> NoticesScreen(st)
                    }
                }
            }
        }
        if (st.stack.isEmpty() && st.tab != Tab.Nour) Box(Modifier.align(Alignment.BottomCenter).zIndex(4f)) { Dock(st) }
        if (st.mustUpdate) Box(Modifier.zIndex(9f)) { UpdateWall(st) }
    }
}

/** شريط التنقل العائم: الرئيسية · دروسي · نور (في المنتصف) · الفصل · حسابي */
@Composable
private fun Dock(st: AppState) {
    Row(
        Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp).fillMaxWidth().height(68.dp)
            .shadow(18.dp, RoundedCornerShape(24.dp), ambientColor = P.dock, spotColor = P.dock)
            .clip(RoundedCornerShape(24.dp)).background(P.dock),
        horizontalArrangement = Arrangement.SpaceAround, verticalAlignment = Alignment.CenterVertically,
    ) {
        DockItem(KI.home, "الرئيسية", st.tab == Tab.Home) { st.selectTab(Tab.Home) }
        DockItem(KI.book, "دروسي", st.tab == Tab.Lessons) { st.selectTab(Tab.Lessons) }
        Box(
            Modifier.size(54.dp).clip(CircleShape).background(P.owl).press({ st.selectTab(Tab.Nour) }, label = "منصة نور"),
            contentAlignment = Alignment.Center,
        ) { Icon(KI.globe, "منصة نور", Modifier.size(24.dp), tint = Color(0xFF1E1A4D)) }
        DockItem(KI.calendar, "الفصل", st.tab == Tab.Term) { st.selectTab(Tab.Term) }
        DockItem(KI.user, "حسابي", st.tab == Tab.Account, dot = st.updateAvailable) { st.selectTab(Tab.Account) }
    }
}

@Composable
private fun DockItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, on: Boolean, dot: Boolean = false, onClick: () -> Unit) {
    val bg by animateColorAsState(if (on) Color(0xFF4B40A9) else Color.Transparent, label = "dock")
    Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(bg).press(onClick, label = label), contentAlignment = Alignment.Center) {
        Icon(icon, label, Modifier.size(22.dp), tint = if (on) Color.White else Color(0xFFA8A4CF))
        if (dot) Box(Modifier.align(Alignment.TopEnd).padding(9.dp).size(8.dp).clip(CircleShape).background(P.owl))
    }
}

@Composable
private fun UpdateWall(st: AppState) {
    Box(Modifier.fillMaxSize().background(Color(0xCC0B0A24)), contentAlignment = Alignment.Center) {
        KCard(Modifier.padding(24.dp), pad = 20.dp) {
            Text("تحديث مطلوب", style = T.h2)
            Spacer(Modifier.height(6.dp))
            Text("هذا الإصدار من التطبيق قديم ولم يعد يعمل مع المنصة. حمّل الإصدار الجديد — يُثبَّت فوق الحالي ولا تفقد شيئًا.", style = T.body.copy(color = P.mute))
            Spacer(Modifier.height(14.dp))
            PrimaryButton("تحميل التحديث", KI.update, Modifier.fillMaxWidth()) { st.host.openExternal(st.manifest?.updateUrl ?: (st.api.base + "/download/khaber.apk")) }
        }
    }
}
