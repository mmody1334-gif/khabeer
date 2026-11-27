package om.khabeer.app

import android.graphics.Color
import android.os.Bundle
import android.webkit.CookieManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import site.khaber.app.AndroidHost
import site.khaber.app.AppState
import site.khaber.app.KhabeerApp

/** خبير — غلاف أندرويد. كل الواجهة في الوحدة المشتركة (shared). */
class MainActivity : ComponentActivity() {
    private var state: AppState? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT), navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        val host = AndroidHost(applicationContext, { window }, BuildConfig.SITE_URL, BuildConfig.VERSION_CODE, BuildConfig.VERSION_NAME)
        host.refreshTool()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (state?.handleBack() != true) { isEnabled = false; onBackPressedDispatcher.onBackPressed(); isEnabled = true }
            }
        })
        setContent { KhabeerApp(host) { state = it } }
    }

    override fun onPause() { super.onPause(); CookieManager.getInstance().flush() }
}
