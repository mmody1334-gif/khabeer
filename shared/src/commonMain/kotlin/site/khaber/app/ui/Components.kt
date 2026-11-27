package site.khaber.app.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** زر بضغطة مرنة (يصغر قليلًا عند اللمس) */
@Composable
fun Modifier.press(onClick: () -> Unit, role: Role = Role.Button, label: String? = null): Modifier {
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed) 0.96f else 1f, spring(stiffness = Spring.StiffnessMedium), label = "press")
    return this.scale(s).clickable(interactionSource = src, indication = null, role = role, onClickLabel = label, onClick = onClick)
}

@Composable
fun KCard(modifier: Modifier = Modifier, pad: Dp = 14.dp, radius: Dp = 20.dp, bg: Color = P.paper, border: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(radius)).background(bg)
            .then(if (border) Modifier.border(1.dp, P.line, RoundedCornerShape(radius)) else Modifier)
            .padding(pad),
        content = content,
    )
}

enum class Tone { Main, Accent, Leaf }
fun toneOf(s: String) = when (s) { "accent" -> Tone.Accent; "leaf" -> Tone.Leaf; else -> Tone.Main }
@Composable fun toneBg(t: Tone) = when (t) { Tone.Main -> P.mainL; Tone.Accent -> P.accentL; Tone.Leaf -> P.leafL }
@Composable fun toneFg(t: Tone) = when (t) { Tone.Main -> P.main; Tone.Accent -> P.accentInk; Tone.Leaf -> P.leafInk }

@Composable
fun IconBox(icon: ImageVector, tone: Tone, size: Dp = 42.dp, iconSize: Dp = 22.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(size * 0.31f)).background(toneBg(tone)), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(iconSize), tint = toneFg(tone))
    }
}

@Composable
fun Pill(text: String, tone: Tone = Tone.Main, solid: Boolean = false) {
    Text(
        text, style = T.small.copy(color = if (solid) P.onMain else toneFg(tone), fontSize = 11.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
        modifier = Modifier.clip(CircleShape).background(if (solid) toneFg(tone) else toneBg(tone)).padding(horizontal = 10.dp, vertical = 2.dp),
    )
}

@Composable
fun PrimaryButton(text: String, icon: ImageVector? = null, modifier: Modifier = Modifier, height: Dp = 52.dp, color: Color = P.main, onClick: () -> Unit) {
    Row(
        modifier.height(height).clip(RoundedCornerShape(16.dp)).background(color).press(onClick).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { Icon(icon, null, Modifier.size(20.dp), tint = P.onMain); Spacer(Modifier.width(8.dp)) }
        Text(text, style = T.h3.copy(color = P.onMain, fontSize = 16.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun SquareButton(icon: ImageVector, label: String, modifier: Modifier = Modifier, size: Dp = 52.dp, bg: Color = P.mainL, fg: Color = P.mainD, onClick: () -> Unit) {
    Box(modifier.size(size).clip(RoundedCornerShape(16.dp)).background(bg).press(onClick, label = label), contentAlignment = Alignment.Center) {
        Icon(icon, label, Modifier.size(20.dp), tint = fg)
    }
}

@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.height(38.dp).clip(RoundedCornerShape(12.dp))
            .background(if (selected) P.dock else P.paper)
            .then(if (selected) Modifier else Modifier.border(1.dp, P.line, RoundedCornerShape(12.dp)))
            .press(onClick, role = Role.Tab).padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, style = T.label.copy(color = if (selected) Color.White else P.ink, fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.SemiBold)) }
}

/** مفتاح الفصل الدراسي — على خلفية داكنة (onDark) أو فاتحة */
@Composable
fun TermSwitch(term: Int, onDark: Boolean, badge2: String, label1: String, label2: String, onPick: (Int) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (onDark) Color.White.copy(alpha = .10f) else P.mainL).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        listOf(1 to label1, 2 to label2).forEach { (n, label) ->
            val on = term == n
            Row(
                Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(11.dp))
                    .background(if (on) (if (onDark) Color.White else P.main) else Color.Transparent)
                    .press({ onPick(n) }, role = Role.Tab),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                val fg = if (on) (if (onDark) P.mainD.let { if (P.dark) Color(0xFF2E2775) else it } else P.onMain) else (if (onDark) Color(0xFFC9C4F5) else P.mainD)
                Text(label, style = T.label.copy(color = fg, fontSize = 14.sp, fontWeight = if (on) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.SemiBold))
                if (n == 2 && badge2.isNotBlank()) {
                    Spacer(Modifier.width(6.dp))
                    Text(badge2, style = T.small.copy(color = Color(0xFF2E2775), fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                        modifier = Modifier.clip(CircleShape).background(P.owl).padding(horizontal = 7.dp, vertical = 0.dp))
                }
            }
        }
    }
}

@Composable
fun TopBar(title: String, sub: String? = null, onBack: (() -> Unit)?, actions: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) SquareButton(KI.back, "رجوع", size = 44.dp, bg = P.paper, fg = P.ink, onClick = onBack)
        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
            Text(title, style = T.h3.copy(fontSize = 16.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!sub.isNullOrBlank()) Text(sub, style = T.small, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        actions()
    }
}

@Composable
fun Shimmer(modifier: Modifier) {
    val t = rememberInfiniteTransition(label = "sh")
    val a by t.animateFloat(0.35f, 0.75f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
    Box(modifier.clip(RoundedCornerShape(14.dp)).background(P.line.copy(alpha = a)))
}

@Composable
fun EmptyNote(text: String, modifier: Modifier = Modifier) {
    KCard(modifier.fillMaxWidth(), bg = P.paper) {
        Text(text, style = T.body.copy(color = P.mute), modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp))
    }
}
