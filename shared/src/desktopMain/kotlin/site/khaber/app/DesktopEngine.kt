package site.khaber.app

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import kotlinx.coroutines.*
import java.io.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

actual fun decodeImage(bytes: ByteArray): ImageBitmap? = runCatching { org.jetbrains.skia.Image.makeFromEncoded(bytes).toComposeImageBitmap() }.getOrNull()

/** معاينة سطح المكتب: نفس محرّك الموقع (dist/quiz_engine.js) يعمل في node */
class NodeEngine(enginePath: String) {
    private val proc = ProcessBuilder("node", File("shared/preview/quiz-engine-runner.mjs").absolutePath.let { if (File(it).exists()) it else "../shared/preview/quiz-engine-runner.mjs" }, enginePath).redirectError(ProcessBuilder.Redirect.INHERIT).start()
    private val out = BufferedWriter(OutputStreamWriter(proc.outputStream, Charsets.UTF_8))
    private val pending = ConcurrentHashMap<Int, CompletableDeferred<String>>()
    private val seq = AtomicInteger()
    init {
        Thread {
            BufferedReader(InputStreamReader(proc.inputStream, Charsets.UTF_8)).forEachLine { l ->
                val tab = l.indexOf('\t'); if (tab > 0) pending.remove(l.substring(0, tab).toInt())?.complete(l.substring(tab + 1))
            }
        }.apply { isDaemon = true }.start()
    }
    suspend fun eval(expr: String): String {
        val id = seq.incrementAndGet(); val d = CompletableDeferred<String>(); pending[id] = d
        synchronized(out) { out.write("$id\t" + expr.replace("\n", "\\u000a") + "\n"); out.flush() }
        return d.await()
    }
}

@androidx.compose.runtime.Composable
actual fun DocPreview(host: Host, url: String, modifier: androidx.compose.ui.Modifier) {
    androidx.compose.foundation.layout.Box(modifier, contentAlignment = androidx.compose.ui.Alignment.Center) {
        androidx.compose.material3.Text("معاينة Google Drive (على الجوال فقط)", style = site.khaber.app.ui.T.body)
    }
}
