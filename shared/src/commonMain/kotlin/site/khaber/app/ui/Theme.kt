package site.khaber.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.sp
import org.jetbrains.compose.resources.Font
import site.khaber.app.res.Res
import site.khaber.app.res.*

/** ألوان «خبير» كما في الموقع (site/data/theme.json): النيلي من البومة والبرتقالي من عينيها */
@Immutable
data class Palette(
    val bg: Color, val paper: Color, val ink: Color, val mute: Color, val line: Color,
    val main: Color, val mainD: Color, val mainL: Color, val onMain: Color,
    val accent: Color, val accentL: Color, val accentInk: Color, val owl: Color,
    val leaf: Color, val leafL: Color, val leafInk: Color,
    val danger: Color, val hero: Color, val dock: Color, val dark: Boolean,
)

val LightPalette = Palette(
    bg = Color(0xFFF6F5FC), paper = Color.White, ink = Color(0xFF1E1A4D), mute = Color(0xFF625E8A), line = Color(0xFFE1DEF3),
    main = Color(0xFF4B40A9), mainD = Color(0xFF2E2775), mainL = Color(0xFFECEAFB), onMain = Color.White,
    accent = Color(0xFFE8890C), accentL = Color(0xFFFFF1D6), accentInk = Color(0xFFA35C00), owl = Color(0xFFFFA216),
    leaf = Color(0xFF0E9F6E), leafL = Color(0xFFE3F6EE), leafInk = Color(0xFF0E7A55),
    danger = Color(0xFFB23A2B), hero = Color(0xFF2E2775), dock = Color(0xFF1E1A4D), dark = false,
)
val DarkPalette = Palette(
    bg = Color(0xFF121031), paper = Color(0xFF1C1945), ink = Color(0xFFECEAFB), mute = Color(0xFFA8A4CF), line = Color(0xFF2E2A66),
    main = Color(0xFFA79FFF), mainD = Color(0xFFD3CEFF), mainL = Color(0xFF2A2560), onMain = Color(0xFF1E1A4D),
    accent = Color(0xFFFFB547), accentL = Color(0xFF3A2C12), accentInk = Color(0xFFFFC978), owl = Color(0xFFFFA216),
    leaf = Color(0xFF4ADE9E), leafL = Color(0xFF123A2C), leafInk = Color(0xFF6FE8B2),
    danger = Color(0xFFEE7A69), hero = Color(0xFF1C1945), dock = Color(0xFF0B0A24), dark = true,
)

val LocalPalette = staticCompositionLocalOf { LightPalette }
val P: Palette @Composable @ReadOnlyComposable get() = LocalPalette.current

object KFonts {
    lateinit var body: FontFamily
    lateinit var display: FontFamily
}

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
@Composable
fun KhabeerTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val pal = if (dark) DarkPalette else LightPalette
    val body = FontFamily(
        Font(Res.font.plex_regular, FontWeight.Normal),
        Font(Res.font.plex_medium, FontWeight.Medium),
        Font(Res.font.plex_semibold, FontWeight.SemiBold),
        Font(Res.font.plex_bold, FontWeight.Bold),
    )
    val display = FontFamily(
        Font(Res.font.readex, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
        Font(Res.font.readex, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
        Font(Res.font.readex, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
    )
    KFonts.body = body; KFonts.display = display
    val scheme = if (dark) darkColorScheme(primary = pal.main, onPrimary = pal.onMain, background = pal.bg, surface = pal.paper, onSurface = pal.ink, onBackground = pal.ink, secondary = pal.accent, error = pal.danger)
    else lightColorScheme(primary = pal.main, onPrimary = pal.onMain, background = pal.bg, surface = pal.paper, onSurface = pal.ink, onBackground = pal.ink, secondary = pal.accent, error = pal.danger)
    val base = TextStyle(fontFamily = body, color = pal.ink, fontSize = 15.sp, lineHeight = 24.sp)
    MaterialTheme(colorScheme = scheme, typography = androidx.compose.material3.Typography(
        bodyLarge = base, bodyMedium = base.copy(fontSize = 14.sp, lineHeight = 22.sp), bodySmall = base.copy(fontSize = 12.sp, lineHeight = 18.sp),
        labelLarge = base.copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), titleLarge = base.copy(fontFamily = display, fontWeight = FontWeight.Bold, fontSize = 22.sp),
    )) {
        CompositionLocalProvider(LocalPalette provides pal, LocalLayoutDirection provides LayoutDirection.Rtl) { content() }
    }
}

/** أنماط النص المستعملة في الشاشات */
object T {
    val display @Composable get() = TextStyle(fontFamily = KFonts.display, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 38.sp, color = P.ink)
    val h2 @Composable get() = TextStyle(fontFamily = KFonts.display, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 30.sp, color = P.ink)
    val h3 @Composable get() = TextStyle(fontFamily = KFonts.body, fontWeight = FontWeight.Bold, fontSize = 15.sp, lineHeight = 22.sp, color = P.ink)
    val body @Composable get() = TextStyle(fontFamily = KFonts.body, fontSize = 14.sp, lineHeight = 23.sp, color = P.ink)
    val small @Composable get() = TextStyle(fontFamily = KFonts.body, fontSize = 12.sp, lineHeight = 18.sp, color = P.mute)
    val label @Composable get() = TextStyle(fontFamily = KFonts.body, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 18.sp, color = P.ink)
    val num @Composable get() = TextStyle(fontFamily = KFonts.display, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp)
}
