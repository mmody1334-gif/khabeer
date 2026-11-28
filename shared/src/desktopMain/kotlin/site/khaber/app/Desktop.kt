package site.khaber.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import site.khaber.app.ui.T

actual fun createHttpClient(): HttpClient = HttpClient(CIO) { expectSuccess = false }

@Composable
actual fun WebModuleScreen(host: Host, url: String, webCss: String, onOpenNour: (String?) -> Unit, onTitle: (String) -> Unit, onAction: (String, String) -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xFFF1F0F8)), contentAlignment = Alignment.Center) { Text("صفحة الموقع: $url", style = T.small) }
}

@Composable
actual fun NourScreen(host: Host, job: NourJob?, onProgress: (NourProgress) -> Unit, onJobTaken: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp())) {
        Text("صفحة نور (تظهر كما هي داخل المتصفح المدمج)", style = T.small)
        repeat(4) { Box(Modifier.padding(top = 14.dp()).fillMaxWidth().height(40.dp()).background(Color(0xFFEDEFF4))) }
    }
}
private fun Int.dp() = androidx.compose.ui.unit.Dp(this.toFloat())

@Composable
actual fun CardCamera(modifier: Modifier, onFrame: (List<site.khaber.app.cards.CardDetector.Hit>, Int, Int) -> Unit, onError: (String) -> Unit) {
    Box(modifier.background(Color(0xFF333333)))
}
