package site.khaber.app.cards

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round
import kotlin.math.sqrt

/**
 * كاشف «كروت الأسئلة» — نقل حرفي لـ cardDetect/cardRead في site/server/client_cardscan.js
 * (نفس القاموس ونفس العتبات) حتى تقرأ الكاميرا الأصلية البطاقات المطبوعة من الموقع نفسها.
 * البطاقة: إطار أسود 6×6 حوله هامش أبيض، وفي الداخل 4×4 بتات. الإجابة من اتجاه البطاقة.
 */
object CardDetector {
    val CODES = intArrayOf(38450, 65217, 10134, 18845, 11673, 8669, 8566, 20266, 59372, 24004, 6730, 34104, 43726, 57713, 40301, 9467, 25620, 55857, 62409, 44215, 36704, 61877, 33174, 45256, 60518, 15480, 47243, 35295, 2605, 53146, 50322, 28505, 52728, 49972, 63693, 11209, 30059, 31354, 37761, 54791, 40854, 4747, 48449, 33109, 15790, 51548, 43507, 45447, 15657, 12569, 22280, 4464, 54391, 35819, 22590, 53664, 46287, 9001, 60873, 22841, 33710, 34188, 12852, 21014)
    val MAX get() = CODES.size
    val LET = listOf("أ", "ب", "ج", "د")
    val LET_EN = listOf("A", "B", "C", "D")

    fun rot(c: Int): Int { var o = 0; for (r in 0 until 4) for (k in 0 until 4) if ((c shr (r * 4 + k)) and 1 == 1) o = o or (1 shl (k * 4 + (3 - r))); return o }
    private val ROTS: Array<IntArray> = Array(CODES.size) { i -> val a = IntArray(4); a[0] = CODES[i]; for (j in 1..3) a[j] = rot(a[j - 1]); a }
    private fun popcnt(x: Int) = Integer_bitCount(x)
    private fun Integer_bitCount(v: Int): Int { var x = v; var c = 0; while (x != 0) { x = x and (x - 1); c++ }; return c }

    class Hit(val n: Int, val ans: Int, val corners: List<FloatArray>, val size: Float)

    private class Comp { var area = 0; var minx = Int.MAX_VALUE; var maxx = -1; var miny = Int.MAX_VALUE; var maxy = -1; val pts = ArrayList<Float>() }

    /** gray: صورة رمادية W×H (بايت لكل بكسل، 0..255). يعيد بطاقة واحدة لكل رقم (الأكبر). */
    fun detect(gray: ByteArray, W: Int, H: Int, rowStride: Int = W): List<Hit> {
        fun g(i: Int, x: Int) = gray[i * rowStride + x].toInt() and 0xFF
        val ii = IntArray((W + 1) * (H + 1))
        for (y in 0 until H) { var rs = 0; val io = (y + 1) * (W + 1); val ip = y * (W + 1); for (x in 0 until W) { rs += g(y, x); ii[io + x + 1] = ii[ip + x + 1] + rs } }
        val R = max(5, round(min(W, H) / 18.0).toInt())
        val bin = ByteArray(W * H)
        for (y in 0 until H) {
            val y0 = max(0, y - R); val y1 = min(H, y + R + 1)
            for (x in 0 until W) {
                val x0 = max(0, x - R); val x1 = min(W, x + R + 1); val area = (x1 - x0) * (y1 - y0)
                val s = ii[y1 * (W + 1) + x1] - ii[y0 * (W + 1) + x1] - ii[y1 * (W + 1) + x0] + ii[y0 * (W + 1) + x0]
                if (g(y, x).toDouble() * area < s * 0.86 - 6.0 * area) bin[y * W + x] = 1
            }
        }
        // المكوّنات المتصلة بالمقاطع الأفقية
        val rx0 = IntArrayList(); val rx1 = IntArrayList(); val ry = IntArrayList(); val par = IntArrayList()
        fun find(a0: Int): Int { var a = a0; while (par[a] != a) { par[a] = par[par[a]]; a = par[a] }; return a }
        var prevS = 0; var prevE = 0
        for (y in 0 until H) {
            val curS = rx0.size; val o2 = y * W; var p = prevS; var x = 0
            while (x < W) {
                if (bin[o2 + x].toInt() == 0) { x++; continue }
                val s0 = x; while (x < W && bin[o2 + x].toInt() != 0) x++
                val id = rx0.size; rx0.add(s0); rx1.add(x - 1); ry.add(y); par.add(id)
                while (p < prevE && rx1[p] < s0) p++
                var q = p
                while (q < prevE && rx0[q] <= x - 1) { val a = find(q); val b = find(id); if (a != b) { if (a < b) par[b] = a else par[a] = b }; q++ }
            }
            prevS = curS; prevE = rx0.size
        }
        val comp = HashMap<Int, Comp>()
        for (i in 0 until rx0.size) {
            val r = find(i); val c = comp.getOrPut(r) { Comp() }
            c.area += rx1[i] - rx0[i] + 1
            if (rx0[i] < c.minx) c.minx = rx0[i]; if (rx1[i] > c.maxx) c.maxx = rx1[i]; if (ry[i] < c.miny) c.miny = ry[i]; if (ry[i] > c.maxy) c.maxy = ry[i]
            val a = rx0[i] - 0.5f; val b = rx1[i] + 0.5f; val yy = ry[i].toFloat()
            c.pts.add(a); c.pts.add(yy - 0.5f); c.pts.add(a); c.pts.add(yy + 0.5f); c.pts.add(b); c.pts.add(yy - 0.5f); c.pts.add(b); c.pts.add(yy + 0.5f)
        }
        val best = HashMap<Int, Hit>()
        for (C in comp.values) {
            val bw = C.maxx - C.minx + 1; val bh = C.maxy - C.miny + 1
            if (bw < 11 || bh < 11 || C.area < 70 || bw > W * 0.9 || bh > H * 0.9) continue
            if (bw > bh * 4 || bh > bw * 4) continue
            if (C.area < bw * bh * 0.22) continue
            val quad = quad(C.pts) ?: continue
            val qa = polyArea(quad)
            if (qa < 100 || C.area < qa * 0.42 || C.area > qa * 1.08) continue
            val hit = read(gray, W, H, rowStride, quad) ?: continue
            val h = Hit(hit.n, hit.ans, hit.corners, sqrt(qa))
            val cur = best[h.n]; if (cur == null || cur.size < h.size) best[h.n] = h
        }
        return best.values.toList()
    }

    private fun polyArea(p: List<FloatArray>): Float { var s = 0f; for (i in 0 until 4) { val j = (i + 1) % 4; s += p[i][0] * p[j][1] - p[j][0] * p[i][1] }; return s / 2 }

    private fun quad(flat: List<Float>): List<FloatArray>? {
        val P = ArrayList<FloatArray>(flat.size / 2)
        var i = 0; while (i < flat.size) { P.add(floatArrayOf(flat[i], flat[i + 1])); i += 2 }
        P.sortWith(compareBy<FloatArray>({ it[0] }, { it[1] }))
        fun cr(o: FloatArray, a: FloatArray, b: FloatArray) = (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
        val lo = ArrayList<FloatArray>(); val up = ArrayList<FloatArray>()
        for (p in P) { while (lo.size >= 2 && cr(lo[lo.size - 2], lo[lo.size - 1], p) <= 0) lo.removeAt(lo.size - 1); lo.add(p) }
        for (k in P.indices.reversed()) { val p = P[k]; while (up.size >= 2 && cr(up[up.size - 2], up[up.size - 1], p) <= 0) up.removeAt(up.size - 1); up.add(p) }
        lo.removeAt(lo.size - 1); up.removeAt(up.size - 1)
        val h = lo + up; if (h.size < 4) return null
        var a = 0; var b = 0; var dm = -1f
        for (x in h.indices) for (y in x + 1 until h.size) { val dx = h[x][0] - h[y][0]; val dy = h[x][1] - h[y][1]; val d = dx * dx + dy * dy; if (d > dm) { dm = d; a = x; b = y } }
        val A = h[a]; val Bq = h[b]; var c1: FloatArray? = null; var c2: FloatArray? = null; var m1 = 0f; var m2 = 0f
        for (p in h) { val v = cr(A, Bq, p); if (v > m1) { m1 = v; c1 = p }; if (-v > m2) { m2 = -v; c2 = p } }
        if (c1 == null || c2 == null) return null
        var q = listOf(A, c1, Bq, c2); if (polyArea(q) < 0) q = listOf(A, c2, Bq, c1)
        var ha = 0f; for (x in h.indices) { val y = (x + 1) % h.size; ha += h[x][0] * h[y][1] - h[y][0] * h[x][1] }; ha = abs(ha / 2)
        if (abs(polyArea(q)) < ha * 0.8f) return null
        val L = (0 until 4).map { x -> val y = (x + 1) % 4; hypot(q[x][0] - q[y][0], q[x][1] - q[y][1]) }
        val mn = L.min(); val mx = L.max(); if (mn < 9 || mx > mn * 3) return null
        return q
    }

    private fun homography(p: List<FloatArray>): (Double, Double) -> DoubleArray {
        val x0 = p[0][0].toDouble(); val y0 = p[0][1].toDouble(); val x1 = p[1][0].toDouble(); val y1 = p[1][1].toDouble()
        val x2 = p[2][0].toDouble(); val y2 = p[2][1].toDouble(); val x3 = p[3][0].toDouble(); val y3 = p[3][1].toDouble()
        val dx1 = x1 - x2; val dx2 = x3 - x2; val dy1 = y1 - y2; val dy2 = y3 - y2; val sx = x0 - x1 + x2 - x3; val sy = y0 - y1 + y2 - y3; val den = dx1 * dy2 - dx2 * dy1
        val g = if (den != 0.0) (sx * dy2 - dx2 * sy) / den else 0.0; val h = if (den != 0.0) (dx1 * sy - sx * dy1) / den else 0.0
        val a = x1 - x0 + g * x1; val b = x3 - x0 + h * x3; val d = y1 - y0 + g * y1; val e = y3 - y0 + h * y3
        return { u, v -> val w = g * u + h * v + 1; doubleArrayOf((a * u + b * v + x0) / w, (d * u + e * v + y0) / w) }
    }

    private fun read(gray: ByteArray, W: Int, H: Int, rs: Int, quad: List<FloatArray>): Hit? {
        val M = homography(quad)
        fun px(u: Double, v: Double): Double {
            val p = M(u / 6, v / 6); val x = p[0] - 0.5; val y = p[1] - 0.5
            if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return -1.0
            val xi = x.toInt(); val yi = y.toInt(); val fx = x - xi; val fy = y - yi; val o = yi * rs + xi
            fun at(k: Int) = (gray[k].toInt() and 0xFF).toDouble()
            return at(o) * (1 - fx) * (1 - fy) + at(o + 1) * fx * (1 - fy) + at(o + rs) * (1 - fx) * fy + at(o + rs + 1) * fx * fy
        }
        val dd = arrayOf(doubleArrayOf(0.0, 0.0), doubleArrayOf(-.2, -.2), doubleArrayOf(.2, -.2), doubleArrayOf(-.2, .2), doubleArrayOf(.2, .2))
        fun cell(r: Int, c: Int): Double { var s = 0.0; for (d in dd) { val v = px(c + .5 + d[0], r + .5 + d[1]); if (v < 0) return -1.0; s += v }; return s / 5 }
        val ring = ArrayList<Double>(); val quiet = ArrayList<Double>(); val cells = ArrayList<Double>()
        for (r in 0 until 6) for (c in 0 until 6) { val v = cell(r, c); if (v < 0) return null; if (r == 0 || c == 0 || r == 5 || c == 5) ring.add(v) else cells.add(v) }
        var t = 0.5
        while (t < 6) { for (q in arrayOf(doubleArrayOf(t, -0.3), doubleArrayOf(t, 6.3), doubleArrayOf(-0.3, t), doubleArrayOf(6.3, t))) { val z = px(q[0], q[1]); if (z >= 0) quiet.add(z) }; t += 1.0 }
        if (quiet.size < 8) return null
        fun med(a: List<Double>) = a.sorted()[a.size shr 1]
        val b = med(ring); val w = med(quiet); if (w - b < 28) return null
        val thr = (w + b) / 2; if (ring.count { it > thr } > 2) return null
        var bits = 0; for (i in 0 until 16) if (cells[i] < thr) bits = bits or (1 shl i)
        var bn = -1; var bk = 0; var bd = 99; var sd = 99
        for (n in ROTS.indices) for (k in 0 until 4) { val d = popcnt(bits xor ROTS[n][k]); if (d < bd) { sd = bd; bd = d; bn = n; bk = k } else if (d < sd) sd = d }
        if (bd > 0 || sd < 3) return null
        val up = arrayOf(intArrayOf(0, -1), intArrayOf(1, 0), intArrayOf(0, 1), intArrayOf(-1, 0))[bk]
        val ce = M(0.5, 0.5); val tp = M(0.5 + up[0] * 0.3, 0.5 + up[1] * 0.3); val vx = tp[0] - ce[0]; val vy = tp[1] - ce[1]
        val ans = if (abs(vy) >= abs(vx)) (if (vy < 0) 0 else 2) else (if (vx > 0) 3 else 1)
        return Hit(bn + 1, ans, quad, 0f)
    }

    /** مصفوفة أعداد صحيحة قابلة للنمو بلا تغليف (أسرع من ArrayList<Int> في حلقة الإطار) */
    private class IntArrayList { var a = IntArray(1024); var size = 0
        fun add(v: Int) { if (size == a.size) a = a.copyOf(size * 2); a[size++] = v }
        operator fun get(i: Int) = a[i]; operator fun set(i: Int, v: Int) { a[i] = v } }
}
