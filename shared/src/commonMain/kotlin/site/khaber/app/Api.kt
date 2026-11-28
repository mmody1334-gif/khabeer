package site.khaber.app

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

class ApiError(val code: Int, message: String) : Exception(message)

/** الاتصال بمنصة خبير. نفس الجلسة (sid) ومعرّف الجهاز (did) يستعملهما متصفح التطبيق. */
class Api(private val plat: Host) {
    private val client = createHttpClient()
    val base = plat.siteUrl.trimEnd('/')

    var sid: String?
        get() = plat.get("sid")
        set(v) { plat.put("sid", v); plat.setSessionCookies(v, did) }
    var did: String?
        get() = plat.get("did")
        set(v) { plat.put("did", v) }

    init {
        // ترقية من التطبيق السابق (متصفح فقط): جلسته محفوظة في كوكيز المتصفح، فلا يُطلب الدخول من جديد
        if (plat.get("sid").isNullOrBlank()) plat.cookie("sid")?.takeIf { it.isNotBlank() }?.let { plat.put("sid", it) }
        if (plat.get("did").isNullOrBlank()) plat.cookie("did")?.takeIf { it.isNotBlank() }?.let { plat.put("did", it) }
    }

    private fun HttpRequestBuilder.auth() {
        val c = buildList { sid?.let { add("sid=$it") }; did?.let { add("did=$it") } }
        if (c.isNotEmpty()) header(HttpHeaders.Cookie, c.joinToString("; "))
        sid?.let { header("X-Tahdir-Sid", it) }
        did?.let { header("X-Tahdir-Did", it) }
        header(HttpHeaders.UserAgent, plat.userAgent)
    }

    private suspend fun fail(r: HttpResponse): Nothing {
        val t = runCatching { r.bodyAsText() }.getOrDefault("")
        val msg = runCatching { J.parseToJsonElement(t).jsonObject.s("error") }.getOrDefault("").ifBlank {
            when (r.status.value) { 401 -> "انتهت الجلسة. سجّل الدخول مرة أخرى."; 402 -> "حسابك بانتظار التفعيل."; else -> "تعذّر الاتصال بالمنصة (${r.status.value})." }
        }
        throw ApiError(r.status.value, msg)
    }

    suspend fun login(username: String, password: String): JsonObject = withContext(Dispatchers.IO) {
        val r = client.post("$base/api/login") {
            auth(); contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("username", username.trim()); put("password", password)
                put("fp", plat.deviceFp); put("screen", "تطبيق خبير")
            }.toString())
        }
        if (!r.status.isSuccess()) fail(r)
        val o = J.parseToJsonElement(r.bodyAsText()).jsonObject
        did = o.s("did").ifBlank { did }
        sid = o.s("sid")
        o
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        runCatching { client.post("$base/api/logout") { auth(); contentType(ContentType.Application.Json); setBody("{}") } }
        sid = null
    }

    suspend fun manifest(): Manifest = withContext(Dispatchers.IO) {
        val r = client.get("$base/api/app/manifest") { auth() }
        if (!r.status.isSuccess()) fail(r)
        val t = r.bodyAsText()
        plat.writeCache("manifest.json", t)
        Manifest(J.parseToJsonElement(t).jsonObject)
    }

    fun cachedManifest(): Manifest? = plat.readCache("manifest.json")?.let { runCatching { Manifest(J.parseToJsonElement(it).jsonObject) }.getOrNull() }

    /** الدروس: تُحفظ على الجهاز وتُطلب بـ ETag، فلا تُنزَّل من جديد إلا إذا تغيّرت على المنصة */
    suspend fun lessons(): List<Lesson> = withContext(Dispatchers.IO) {
        val etag = plat.get("lessons_etag")
        val cached = plat.readCache("lessons.json")
        val r = client.get("$base/api/lessons") {
            auth()
            if (etag != null && cached != null) header(HttpHeaders.IfNoneMatch, etag)
        }
        val text = when {
            r.status == HttpStatusCode.NotModified && cached != null -> cached
            r.status.isSuccess() -> r.bodyAsText().also { t ->
                plat.writeCache("lessons.json", t); plat.put("lessons_etag", r.headers[HttpHeaders.ETag])
            }
            else -> fail(r)
        }
        withContext(Dispatchers.Default) { parseLessons(text) }
    }

    suspend fun cachedLessons(): List<Lesson>? = withContext(Dispatchers.IO) {
        plat.readCache("lessons.json")?.let { t -> runCatching { withContext(Dispatchers.Default) { parseLessons(t) } }.getOrNull() }
    }

    private fun parseLessons(t: String): List<Lesson> =
        J.parseToJsonElement(t).jsonObject["lessons"]!!.jsonArray.mapIndexedNotNull { i, e -> (e as? JsonObject)?.let { Lesson(it, i) } }

    suspend fun notices(): List<Notice> = withContext(Dispatchers.IO) {
        val r = client.get("$base/api/notices?b=k") { auth() }
        if (!r.status.isSuccess()) fail(r)
        J.parseToJsonElement(r.bodyAsText()).jsonObject.arr("notices").map {
            Notice(it.i("id").toLong(), it.s("title"), it.s("body"), it.s("url"), it.s("created_at").toDoubleOrNull()?.toLong() ?: 0, it.b("read"))
        }
    }

    suspend fun markRead(id: Long) = withContext(Dispatchers.IO) {
        runCatching { client.post("$base/api/notices/read") { auth(); contentType(ContentType.Application.Json); setBody("{\"id\":$id}") } }
    }

    /** إحصاء استخدام (نفس أحداث الموقع: send_prep / send_hw / view) */
    suspend fun event(type: String, lessonId: Long?, detail: String = "") = withContext(Dispatchers.IO) {
        runCatching {
            client.post("$base/api/event") {
                auth(); contentType(ContentType.Application.Json)
                setBody(buildJsonObject { put("type", type); lessonId?.let { put("lesson_id", it) }; put("detail", detail) }.toString())
            }
        }
    }

    // ---------- طلبات JSON عامة (أدوات المنصة: كروت الأسئلة، الاختبارات، الواجبات) ----------
    suspend fun getJson(path: String): JsonObject = withContext(Dispatchers.IO) {
        val r = client.get(base + path) { auth() }
        if (!r.status.isSuccess()) fail(r)
        J.parseToJsonElement(r.bodyAsText()).jsonObject
    }
    suspend fun postJson(path: String, body: JsonElement, method: HttpMethod = HttpMethod.Post): JsonObject = withContext(Dispatchers.IO) {
        val r = client.request(base + path) { this.method = method; auth(); contentType(ContentType.Application.Json); setBody(body.toString()) }
        if (!r.status.isSuccess()) fail(r)
        runCatching { J.parseToJsonElement(r.bodyAsText()).jsonObject }.getOrDefault(JsonObject(emptyMap()))
    }
    /** ملف محفوظ للمعلم (صف، جلسة، اختبار، واجب): بياناته + المعرّف ووقت التحديث */
    suspend fun quizDoc(id: Long): JsonObject {
        val q = getJson("/api/quizzes/$id").obj("quiz")
        return JsonObject(q.obj("data") + mapOf("id" to JsonPrimitive(id), "updated_at" to (q["updated_at"] ?: JsonNull)))
    }
    /** حفظ ملف (إنشاء أو تحديث) بنفس صيغة الموقع؛ يعيد المعرّف ووقت التحديث */
    suspend fun saveDoc(kind: String, doc: JsonObject): Pair<Long, Long> {
        val id = (doc["id"] as? JsonPrimitive)?.content?.toLongOrNull()
        val r = postJson("/api/quizzes", buildJsonObject {
            if (id != null) put("id", id)
            put("title", doc.s("title")); put("grade", doc.s("grade")); put("subject", doc.s("subject")); put("kind", kind)
            put("data", JsonObject(doc - "updated_at"))
        })
        return (r.s("id").toDoubleOrNull()?.toLong() ?: id ?: 0L) to (r.s("updated_at").toDoubleOrNull()?.toLong() ?: 0L)
    }
    /** بايتات ملف من الموقع (صور الأسئلة) */
    suspend fun bytes(path: String): ByteArray? = withContext(Dispatchers.IO) {
        runCatching { val r = client.get(if (path.startsWith("http")) path else base + path) { auth() }; if (r.status.isSuccess()) r.readRawBytes() else null }.getOrNull()
    }
    suspend fun deleteDoc(id: Long) { postJson("/api/quizzes/$id", JsonObject(emptyMap()), HttpMethod.Delete) }

    /** رقم أحدث إصدار من التطبيق المنشور (يكتبه سير عمل البناء في /dl/version.json) */
    suspend fun latestVersion(): Int? = withContext(Dispatchers.IO) {
        runCatching {
            val r = client.get("$base/dl/version.json")
            if (r.status.isSuccess()) J.parseToJsonElement(r.bodyAsText()).jsonObject.i("version") else null
        }.getOrNull()
    }
}
