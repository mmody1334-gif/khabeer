package site.khaber.app

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.painterResource
import site.khaber.app.res.Res
import site.khaber.app.res.logo
import site.khaber.app.ui.*

@Composable
fun Logo(size: androidx.compose.ui.unit.Dp, radius: androidx.compose.ui.unit.Dp = size * 0.29f) {
    Box(Modifier.size(size).clip(RoundedCornerShape(radius)).background(Color.White), contentAlignment = Alignment.Center) {
        Image(painterResource(Res.drawable.logo), "شعار خبير", Modifier.fillMaxSize(0.8f))
    }
}

@Composable
fun SplashScreen(st: AppState) {
    val t = rememberInfiniteTransition(label = "s")
    val s by t.animateFloat(1f, 1.04f, infiniteRepeatable(tween(1400, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "b")
    Box(Modifier.fillMaxSize().background(Color(0xFF2E2775)), contentAlignment = Alignment.Center) {
        Box(Modifier.size(380.dp).clip(CircleShape).border(1.dp, Color.White.copy(.12f), CircleShape))
        Box(Modifier.size(520.dp).clip(CircleShape).border(1.dp, Color.White.copy(.07f), CircleShape))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.scale(s)) { Logo(150.dp) }
            Spacer(Modifier.height(24.dp))
            Text("خبير", style = T.display.copy(color = Color.White, fontSize = 42.sp, lineHeight = 52.sp))
            Text("منصة المعلمين", style = T.body.copy(color = Color(0xFFC9C4F5), fontSize = 16.sp))
        }
    }
}

@Composable
fun LoginScreen(st: AppState) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    var web by remember { mutableStateOf<Pair<String, String>?>(null) }
    val scope = rememberCoroutineScope()
    web?.let { (path, title) ->
        Column(Modifier.fillMaxSize().background(P.bg)) {
            TopBar(title, onBack = { web = null })
            Box(Modifier.weight(1f)) { WebModuleScreen(st.host, st.api.base + path, "", onOpenNour = {}, onTitle = {}) }
        }
        return
    }
    fun go() {
        if (busy) return
        if (user.isBlank() || pass.isBlank()) { err = "اكتب البريد الإلكتروني (أو اسم المستخدم) وكلمة المرور."; return }
        busy = true; err = null
        scope.launch { err = st.login(user, pass); busy = false }
    }
    Column(Modifier.fillMaxSize().background(P.bg).verticalScroll(rememberScrollState()).imePadding()) {
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp)).background(P.hero).statusBarsPadding().padding(top = 36.dp, bottom = 54.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Logo(104.dp)
                Spacer(Modifier.height(14.dp))
                Text("أهلًا بك في خبير", style = T.display.copy(color = Color.White))
                Text("كل ما تحتاجه لحصتك في مكان واحد", style = T.body.copy(color = Color(0xFFC9C4F5)))
            }
        }
        KCard(Modifier.padding(horizontal = 16.dp).offset(y = (-30).dp).fillMaxWidth(), pad = 18.dp, radius = 24.dp) {
            Text("تسجيل الدخول", style = T.h2)
            Spacer(Modifier.height(12.dp))
            Field("البريد الإلكتروني أو اسم المستخدم", user, { user = it }, KeyboardType.Email, ImeAction.Next)
            Spacer(Modifier.height(10.dp))
            Field("كلمة المرور", pass, { pass = it }, KeyboardType.Password, ImeAction.Done, secret = !show, onDone = ::go,
                trailing = { Text(if (show) "إخفاء" else "إظهار", style = T.label.copy(color = P.main), modifier = Modifier.padding(end = 12.dp).press({ show = !show })) })
            err?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, style = T.body.copy(color = P.danger, fontSize = 13.sp), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(P.danger.copy(.08f)).padding(10.dp))
            }
            Spacer(Modifier.height(16.dp))
            PrimaryButton(if (busy) "جارٍ الدخول…" else "دخول", modifier = Modifier.fillMaxWidth()) { go() }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("نسيت كلمة المرور؟", style = T.label.copy(color = P.main), modifier = Modifier.press({ web = "/forgot" to "استعادة كلمة المرور" }).padding(6.dp))
                Text("إنشاء حساب جديد", style = T.label.copy(color = P.accentInk), modifier = Modifier.press({ web = "/register" to "إنشاء حساب" }).padding(6.dp))
            }
        }
        Text("الإصدار ${st.host.versionName}", style = T.small, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp))
    }
}

@Composable
fun Field(label: String, value: String, onChange: (String) -> Unit, kb: KeyboardType, ime: ImeAction, secret: Boolean = false, onDone: () -> Unit = {}, trailing: (@Composable () -> Unit)? = null) {
    OutlinedTextField(
        value, onChange, Modifier.fillMaxWidth(), label = { Text(label, style = T.small) }, singleLine = true,
        textStyle = T.body.copy(fontSize = 16.sp),
        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = kb, imeAction = ime), keyboardActions = KeyboardActions(onDone = { onDone() }),
        shape = RoundedCornerShape(14.dp), trailingIcon = trailing,
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = P.main, unfocusedBorderColor = P.line, focusedContainerColor = P.bg, unfocusedContainerColor = P.bg, cursorColor = P.main, focusedLabelColor = P.main),
    )
}

/** حساب لم يُفعَّل بعد (أو انتهى اشتراكه): صفحة الاشتراك من المنصة نفسها (التحويل ورفع الإيصال) */
@Composable
fun PendingScreen(st: AppState) {
    Column(Modifier.fillMaxSize().background(P.bg)) {
        TopBar("تفعيل الاشتراك", "أكمل التحويل وارفع الإيصال، ويُفعَّل حسابك بعد المراجعة", onBack = null) {
            SquareButton(KI.reload, "تحديث", size = 44.dp, bg = P.paper, fg = P.ink) { st.refresh() }
            Spacer(Modifier.width(8.dp))
            SquareButton(KI.logout, "خروج", size = 44.dp, bg = P.paper, fg = P.danger) { st.logout() }
        }
        Box(Modifier.weight(1f)) { WebModuleScreen(st.host, st.api.base + "/pending", st.manifest?.webCss ?: "", onOpenNour = {}, onTitle = {}) }
    }
}
