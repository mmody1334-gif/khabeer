package site.khaber.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** أيقونات خطية بأسلوب واحد (24×24، خط 1.8) — مرسومة هنا بلا مكتبة أيقونات */
object KI {
    private val cache = HashMap<String, ImageVector>()
    private fun mk(name: String, vararg d: String): ImageVector = cache.getOrPut(name) {
        val b = ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        d.forEach { b.addPath(addPathNodes(it), stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, fill = null) }
        b.build()
    }
    val home get() = mk("home", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z")
    val book get() = mk("book", "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2", "M6 21h14")
    val globe get() = mk("globe", "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M3 12h18", "M12 3c3 3 3 15 0 18", "M12 3c-3 3-3 15 0 18")
    val calendar get() = mk("calendar", "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M3 10h18", "M8 3v4", "M16 3v4")
    val user get() = mk("user", "M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M4 21c1-4 4-6 8-6s7 2 8 6")
    val bell get() = mk("bell", "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8", "M10 20a2 2 0 0 0 4 0")
    val send get() = mk("send", "M22 2 11 13", "M22 2 15 22l-4-9-9-4z")
    val back get() = mk("back", "M9 18l6-6-6-6")
    val fwd get() = mk("fwd", "M15 18l-6-6 6-6")
    val close get() = mk("close", "M6 6l12 12", "M18 6L6 18")
    val reload get() = mk("reload", "M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5")
    val copy get() = mk("copy", "M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3")
    val down get() = mk("down", "M6 9l6 6 6-6")
    val up get() = mk("up", "M6 15l6-6 6 6")
    val search get() = mk("search", "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z", "M20 20l-4-4")
    val check get() = mk("check", "M9 11l3 3 8-8", "M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11")
    val tick get() = mk("tick", "M5 12l5 5L20 7")
    val doc get() = mk("doc", "M4 4h12l4 4v12H4z", "M8 12h8", "M8 16h5")
    val pen get() = mk("pen", "M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z")
    val game get() = mk("game", "M6 7h12a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z", "M7 11v4", "M5 13h4", "M15 12h.01", "M18 14h.01")
    val screen get() = mk("screen", "M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M12 16v4", "M8 20h8")
    val cap get() = mk("cap", "M12 3l9 5-9 5-9-5z", "M6 10v5c3 2 9 2 12 0v-5")
    val card get() = mk("card", "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M7 9h4v4H7z", "M14 9h3", "M14 13h3")
    val plan get() = mk("plan", "M9 4h6v3H9z", "M7 5H5v16h14V5h-2", "M8 12h8", "M8 16h5")
    val flask get() = mk("flask", "M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3", "M7.5 15h9")
    val target get() = mk("target", "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M12 11.5v1")
    val chart get() = mk("chart", "M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2")
    val users get() = mk("users", "M9 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M2 21c1-4 3.5-6 7-6s6 2 7 6", "M16 4.5a4 4 0 0 1 0 7", "M18 15c2 .8 3.4 2.8 4 6")
    val folder get() = mk("folder", "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z")
    val grid get() = mk("grid", "M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z")
    val logout get() = mk("logout", "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4", "M10 17l-5-5 5-5", "M5 12h11")
    val update get() = mk("update", "M12 3v12", "M7 10l5 5 5-5", "M5 21h14")
    val sparkle get() = mk("sparkle", "M12 3l1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1z")
    val lock get() = mk("lock", "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z", "M8 11V7a4 4 0 0 1 8 0v4")
    val external get() = mk("external", "M14 4h6v6", "M20 4l-9 9", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5")

    fun byName(n: String): ImageVector = when (n) {
        "doc" -> doc; "check" -> check; "pen" -> pen; "card" -> card; "game" -> game; "screen" -> screen; "cap" -> cap
        "plan" -> plan; "book" -> book; "flask" -> flask; "target" -> target; "chart" -> chart; "users" -> users; "folder" -> folder
        else -> grid
    }
}
