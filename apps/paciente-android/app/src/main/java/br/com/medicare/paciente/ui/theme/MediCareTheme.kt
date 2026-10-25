package br.com.medicare.paciente.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color

/**
 * Paleta semântica e tokens visuais fiéis ao `src/lib/theme.js` do MediCare.
 */
object MediCareColors {
    val Green = Color(0xFF22C55E)
    val GreenBg = Color(0xFF052E16)
    val Amber = Color(0xFFF59E0B)
    val AmberBg = Color(0xFF1C1200)
    val Red = Color(0xFFEF4444)
    val RedBg = Color(0xFF1C0505)
    val Blue = Color(0xFF3B82F6)
    val BlueBg = Color(0xFF0A1628)
    val Purple = Color(0xFF8B5CF6)
    val PurpleBg = Color(0xFF2E1065)

    val PillPalette = listOf(
        "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
        "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#06b6d4", "#6366f1"
    )

    fun parseHex(hex: String, fallback: Color = Blue): Color {
        return runCatching {
            Color(android.graphics.Color.parseColor(hex))
        }.getOrDefault(fallback)
    }
}

@Immutable
data class MediCareTokens(
    val bg0: Color,
    val bg1: Color,
    val bg2: Color,
    val bg3: Color,
    val txt: Color,
    val sub: Color,
    val muted: Color,
    val bdr: Color,
    val nav: Color,
    val inp: Color,
    val inpB: Color,
    val fontScale: Float = 1.0f
)

fun buildMediCareTokens(dark: Boolean, highContrast: Boolean, fontScale: Float = 1.0f): MediCareTokens {
    if (highContrast) {
        return MediCareTokens(
            bg0 = if (dark) Color(0xFF000000) else Color(0xFFFFFFFF),
            bg1 = if (dark) Color(0xFF111111) else Color(0xFFF9F9F9),
            bg2 = if (dark) Color(0xFF222222) else Color(0xFFEEEEEE),
            bg3 = if (dark) Color(0xFF444444) else Color(0xFFDDDDDD),
            txt = if (dark) Color(0xFFFFFFFF) else Color(0xFF000000),
            sub = if (dark) Color(0xFFDDDDDD) else Color(0xFF222222),
            muted = if (dark) Color(0xFFAAAAAA) else Color(0xFF555555),
            bdr = if (dark) Color(0xFF444444) else Color(0xFFCCCCCC),
            nav = if (dark) Color(0xFF000000) else Color(0xFFFFFFFF),
            inp = if (dark) Color(0xFF111111) else Color(0xFFFFFFFF),
            inpB = if (dark) Color(0xFF666666) else Color(0xFF999999),
            fontScale = fontScale
        )
    }
    return MediCareTokens(
        bg0 = if (dark) Color(0xFF0F172A) else Color(0xFFF8FAFC),
        bg1 = if (dark) Color(0xFF1E293B) else Color(0xFFFFFFFF),
        bg2 = if (dark) Color(0xFF334155) else Color(0xFFF1F5F9),
        bg3 = if (dark) Color(0xFF475569) else Color(0xFFE2E8F0),
        txt = if (dark) Color(0xFFF8FAFC) else Color(0xFF0F172A),
        sub = if (dark) Color(0xFFCBD5E1) else Color(0xFF475569),
        muted = if (dark) Color(0xFF64748B) else Color(0xFF94A3B8),
        bdr = if (dark) Color(0xFF334155) else Color(0xFFE2E8F0),
        nav = if (dark) Color(0xFF0F172A) else Color(0xFFFFFFFF),
        inp = if (dark) Color(0xFF1E293B) else Color(0xFFFFFFFF),
        inpB = if (dark) Color(0xFF475569) else Color(0xFFCBD5E1),
        fontScale = fontScale
    )
}

val LocalMediCareTokens = staticCompositionLocalOf {
    buildMediCareTokens(dark = true, highContrast = false, fontScale = 1.0f)
}

@Composable
fun MediCareTheme(
    darkTheme: Boolean = true,
    highContrast: Boolean = false,
    fontScale: Float = 1.0f,
    content: @Composable () -> Unit
) {
    val tokens = remember(darkTheme, highContrast, fontScale) {
        buildMediCareTokens(darkTheme, highContrast, fontScale)
    }

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = MediCareColors.Blue,
            secondary = MediCareColors.Purple,
            tertiary = MediCareColors.Green,
            background = tokens.bg0,
            surface = tokens.bg1,
            onPrimary = Color.White,
            onBackground = tokens.txt,
            onSurface = tokens.txt
        )
    } else {
        lightColorScheme(
            primary = MediCareColors.Blue,
            secondary = MediCareColors.Purple,
            tertiary = MediCareColors.Green,
            background = tokens.bg0,
            surface = tokens.bg1,
            onPrimary = Color.White,
            onBackground = tokens.txt,
            onSurface = tokens.txt
        )
    }

    CompositionLocalProvider(LocalMediCareTokens provides tokens) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}
