package site.khaber.app

import site.khaber.app.cards.CardDetector
import java.io.File

/** يقارن كاشف كوتلن بكاشف الموقع على نفس الصور (ملفات gray الخام في المجلد المعطى) */
fun main(args: Array<String>) {
    val dir = File(args.getOrElse(0) { "/tmp/cardtest" })
    val meta = site.khaber.app.J.parseToJsonElement(File(dir, "meta.json").readText()) as kotlinx.serialization.json.JsonArray
    val sb = StringBuilder("{")
    meta.forEachIndexed { i, e ->
        val o = e as kotlinx.serialization.json.JsonObject
        val f = o.s("f"); val w = o.i("W"); val h = o.i("H")
        val t0 = System.nanoTime()
        val hits = CardDetector.detect(File(dir, "$f.gray").readBytes(), w, h).sortedBy { it.n }
        val ms = (System.nanoTime() - t0) / 1_000_000
        if (i > 0) sb.append(",")
        sb.append("\"$f\":[" + hits.joinToString(",") { "[${it.n},${it.ans}]" } + "]")
        System.err.println("$f ${ms}ms")
    }
    sb.append("}")
    File(dir, "kt.json").writeText(sb.toString())
    println(sb)
}
