package site.khaber.app

import androidx.compose.runtime.Composable
import io.ktor.client.HttpClient

/** ما يوفّره نظام التشغيل للتطبيق (أندرويد الآن، وآيفون لاحقًا). */
interface Host {
    val siteUrl: String
    val versionCode: Int
    val versionName: String
    /** «نوع الجهاز · الموديل» يظهر للمعلم في قائمة أجهزته على المنصة */
    val deviceModel: String
    /** بصمة ثابتة للجهاز (تُرسل مع الدخول ليتعرّف الخادم على الجهاز نفسه) */
    val deviceFp: String
    val userAgent: String
    fun get(key: String): String?
    fun put(key: String, value: String?)
    fun readCache(name: String): String?
    fun writeCache(name: String, text: String)
    /** كوكي محفوظ مسبقًا في متصفح التطبيق (جلسة النسخة السابقة من التطبيق) */
    fun cookie(name: String): String?
    /** يضع الجلسة في متصفح التطبيق فتفتح صفحات الموقع ونور بنفس الدخول */
    fun setSessionCookies(sid: String?, did: String?)
    fun copyText(text: String)
    fun openExternal(url: String)
    fun toast(text: String)
    fun nowMillis(): Long
    /** الساعة الآن بتوقيت الجهاز (للتحية) */
    fun hour(): Int
    /** أيقونات شريط الحالة داكنة (للشاشات الفاتحة) أو فاتحة (للرؤوس النيلية) */
    fun setDarkStatusIcons(dark: Boolean) {}
}

expect fun createHttpClient(): HttpClient

/** صفحة من موقع خبير داخل شاشة أصلية (الأدوات الكبيرة: الاختبارات، الألعاب…) */
@Composable
expect fun WebModuleScreen(host: Host, url: String, webCss: String, onOpenNour: (String?) -> Unit, onTitle: (String) -> Unit)

/** متصفح نور المدمج: يحقن أداة نور ويعرض تقدّم التعبئة */
@Composable
expect fun NourScreen(host: Host, job: NourJob?, onProgress: (NourProgress) -> Unit, onJobTaken: () -> Unit)

/** مهمة إرسال إلى نور: النص الجاهز (JSON) بنفس صيغة الموقع */
data class NourJob(val kind: String, val json: String, val title: String, val id: Long)

data class NourProgress(
    val page: String = "",
    val onPrep: Boolean = false,
    val title: Boolean = false,
    val editors: Int = 0,
    val editorsTotal: Int = 0,
    val level: Boolean = false,
    val strategies: Boolean = false,
    val resources: Boolean = false,
    val outcomes: Boolean = false,
    val loggedOut: Boolean = false,
)
