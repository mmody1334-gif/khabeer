package site.khaber.app

import android.Manifest
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.view.WindowManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import site.khaber.app.cards.CardDetector
import java.util.concurrent.Executors

/**
 * الكاميرا الخلفية + الكاشف على كل إطار (~10 إطارات في الثانية كما في الموقع).
 * أثناء المسح: الشاشة بالعرض (يرى صفًّا أعرض من الطلاب) وتبقى مضاءة.
 */
@Composable
actual fun CardCamera(modifier: Modifier, onFrame: (List<CardDetector.Hit>, Int, Int) -> Unit, onError: (String) -> Unit) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    var granted by remember { mutableStateOf(ctx.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> granted = ok; if (!ok) onError("اسمح للتطبيق باستخدام الكاميرا لمسح بطاقات الطلاب (من إعدادات الجهاز ← التطبيقات ← خبير ← الأذونات).") }
    val frameCb = rememberUpdatedState(onFrame)
    DisposableEffect(Unit) {
        val act = ctx.activity()
        val old = act?.requestedOrientation
        act?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        act?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (!granted) ask.launch(Manifest.permission.CAMERA)
        onDispose {
            act?.requestedOrientation = old ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            act?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
    if (!granted) return
    val exec = remember { Executors.newSingleThreadExecutor() }
    val preview = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER; implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
    DisposableEffect(owner) {
        val fut = ProcessCameraProvider.getInstance(ctx)
        var provider: ProcessCameraProvider? = null
        fut.addListener({
            runCatching {
                val p = fut.get(); provider = p
                val sel = ResolutionSelector.Builder()
                    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                    .setResolutionStrategy(ResolutionStrategy(android.util.Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
                    .build()
                val pv = Preview.Builder().setResolutionSelector(sel).build().also { it.surfaceProvider = preview.surfaceProvider }
                val an = ImageAnalysis.Builder().setResolutionSelector(sel).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                var last = 0L
                an.setAnalyzer(exec) { img ->
                    try {
                        val now = System.currentTimeMillis()
                        if (now - last >= 90) {
                            last = now
                            val pl = img.planes[0]; val buf = pl.buffer; val w = img.width; val h = img.height; val rs = pl.rowStride
                            val bytes = ByteArray(buf.remaining()); buf.get(bytes)
                            val raw = runCatching { CardDetector.detect(bytes, w, h, rs) }.getOrDefault(emptyList())
                            val rot = img.imageInfo.rotationDegrees
                            val (hits, ow, oh) = upright(raw, w, h, rot)
                            preview.post { frameCb.value(hits, ow, oh) }
                        }
                    } finally { img.close() }
                }
                p.unbindAll()
                p.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, pv, an)
            }.onFailure { onError("تعذّر تشغيل الكاميرا: ${it.message ?: ""}") }
        }, ContextCompat.getMainExecutor(ctx))
        onDispose { runCatching { provider?.unbindAll() } }
    }
    DisposableEffect(Unit) { onDispose { exec.shutdown() } }
    AndroidView({ preview }, modifier)
}

/**
 * الإطار يأتي باتجاه الحساس؛ ندير النقاط والإجابة لتطابق ما يراه المعلم على الشاشة.
 * الإجابة = اتجاه أعلى البطاقة (0 أعلى، 1 يسار، 2 أسفل، 3 يمين — عكس عقارب الساعة)،
 * فإدارة الصورة 90° مع عقارب الساعة تُنقص الاتجاه واحدًا.
 */
private fun upright(hits: List<CardDetector.Hit>, w: Int, h: Int, rot: Int): Triple<List<CardDetector.Hit>, Int, Int> {
    if (rot % 360 == 0) return Triple(hits, w, h)
    val steps = (rot / 90) % 4
    fun tp(p: FloatArray): FloatArray = when (steps) {
        1 -> floatArrayOf(h - p[1], p[0])
        2 -> floatArrayOf(w - p[0], h - p[1])
        else -> floatArrayOf(p[1], w - p[0])
    }
    val out = hits.map { CardDetector.Hit(it.n, ((it.ans - steps) % 4 + 4) % 4, it.corners.map(::tp), it.size) }
    return if (steps % 2 == 1) Triple(out, h, w) else Triple(out, w, h)
}
