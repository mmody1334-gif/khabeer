package site.khaber.app

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import kotlinx.coroutines.runBlocking
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

/** معاينة: العروض الأصلية ومنتقي المادة في الاختبارات */
fun main(args: Array<String>) {
    val out = File(args.getOrElse(0) { "/tmp/slides_prev" }).apply { mkdirs() }
    val host = PreviewHost("http://localhost:8787").apply { node = NodeEngine("/home/claude/khabeer/site/dist/quiz_engine.js") }
    var st: AppState? = null
    val scene = ImageComposeScene(390 * 3, 844 * 3, Density(3f)) { KhabeerApp(host) { st = it } }
    fun pump(ms: Long) { val end = System.currentTimeMillis() + ms; while (System.currentTimeMillis() < end) { scene.render(System.nanoTime()); Thread.sleep(40) } }
    fun shot(n: String) { pump(500); File(out, "$n.png").writeBytes(scene.render(System.nanoTime()).encodeToData(EncodedImageFormat.PNG)!!.bytes); println("shot $n") }
    pump(500)
    runBlocking { println("login: " + (st!!.login("mohamed", "Bio@2026x") ?: "ok")) }
    val end = System.currentTimeMillis() + 20000; while ((st!!.syncing || st!!.lessons.isEmpty()) && System.currentTimeMillis() < end) pump(150)
    val s = st!!
    s.open(Screen.Slides); pump(3000); shot("s1-home")
    s.stack.clear(); s.open(Screen.Quiz(false)); pump(3000); shot("s2-quiz-picker")
    scene.close(); kotlin.system.exitProcess(0)
}
