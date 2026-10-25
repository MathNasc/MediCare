package br.com.medicare.paciente.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.DoseStatus
import br.com.medicare.paciente.domain.model.ScheduledDose
import br.com.medicare.paciente.domain.model.TreatmentType
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors

/**
 * Anel de progresso circular equivalente ao `src/components/ui/Ring.jsx`.
 */
@Composable
fun AdhesionRing(
    percent: Int,
    size: Dp = 84.dp,
    strokeWidth: Dp = 9.dp,
    color: Color = MediCareColors.Green
) {
    val tokens = LocalMediCareTokens.current
    val animatedProgress by animateFloatAsState(
        targetValue = (percent.coerceIn(0, 100)) / 100f,
        animationSpec = tween(durationMillis = 650),
        label = "ringProgress"
    )

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(size)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawArc(
                color = tokens.bg3,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
            )
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = 360f * animatedProgress,
                useCenter = false,
                style = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
            )
        }
        Text(
            text = "$percent%",
            color = tokens.txt,
            fontSize = (18 * tokens.fontScale).sp,
            fontWeight = FontWeight.Black
        )
    }
}

/**
 * Badge de tipo de tratamento equivalente ao `src/components/ui/TreatmentBadge.jsx`.
 */
@Composable
fun TreatmentTypeBadge(type: TreatmentType) {
    val badgeColor = Color(type.colorHex)
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(badgeColor.copy(alpha = 0.14f))
            .border(1.dp, badgeColor.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = "${type.icon} ${type.shortLabel}",
            color = badgeColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Card de Dose Diária preservando o layout, cores e status do MediCare Web.
 */
@Composable
fun DoseCard(
    dose: ScheduledDose,
    onClick: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val pillColor = MediCareColors.parseHex(dose.cor)
    val statusColor = Color(dose.status.colorHex)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(tokens.bg1)
            .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Ícone colorido da pílula
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(pillColor.copy(alpha = 0.18f))
                .border(1.5.dp, pillColor.copy(alpha = 0.5f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (dose.status == DoseStatus.CONFIRMED) "✓" else "💊",
                fontSize = 22.sp,
                color = if (dose.status == DoseStatus.CONFIRMED) MediCareColors.Green else pillColor,
                fontWeight = FontWeight.Black
            )
        }

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = dose.nome,
                    color = tokens.txt,
                    fontSize = (16 * tokens.fontScale).sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(modifier = Modifier.width(8.dp))
                TreatmentTypeBadge(type = dose.treatmentType)
            }
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = "${dose.dosagem} (${dose.unidade}) · ${DoseCalculator.timeLabel(dose.hora)}",
                color = tokens.sub,
                fontSize = (13 * tokens.fontScale).sp
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = dose.hora,
                color = tokens.txt,
                fontSize = (17 * tokens.fontScale).sp,
                fontWeight = FontWeight.Black
            )
            Spacer(modifier = Modifier.height(4.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(statusColor.copy(alpha = dose.status.bgAlpha))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text(
                    text = dose.status.label,
                    color = statusColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

/**
 * Modal de Confirmação Rápida de Dose (`src/components/modals/QuickConfirm.jsx`).
 */
@Composable
fun QuickConfirmDialog(
    dose: ScheduledDose,
    onConfirm: (ScheduledDose) -> Unit,
    onSnooze15Min: (ScheduledDose) -> Unit,
    onUndo: (ScheduledDose) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val pillColor = MediCareColors.parseHex(dose.cor)

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(28.dp))
                .padding(26.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(pillColor.copy(alpha = 0.2f))
                    .border(2.dp, pillColor.copy(alpha = 0.6f), RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "💊", fontSize = 28.sp)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = if (dose.status == DoseStatus.CONFIRMED) "DOSE CONFIRMADA" else "HORA DO MEDICAMENTO",
                color = tokens.sub,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = dose.nome,
                color = tokens.txt,
                fontSize = (22 * tokens.fontScale).sp,
                fontWeight = FontWeight.Black
            )

            Text(
                text = "${dose.dosagem} · ${dose.hora}",
                color = tokens.sub,
                fontSize = 15.sp
            )

            Spacer(modifier = Modifier.height(22.dp))

            if (dose.status == DoseStatus.CONFIRMED) {
                Button(
                    onClick = {
                        onUndo(dose)
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(54.dp)
                ) {
                    Text(
                        text = "↩️ Desfazer confirmação",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            } else {
                Button(
                    onClick = {
                        onConfirm(dose)
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text(
                        text = "✓ Já tomei",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedButton(
                    onClick = {
                        onSnooze15Min(dose)
                        onDismiss()
                    },
                    shape = RoundedCornerShape(13.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(
                        text = "⏰ Lembrar em 15 minutos",
                        color = tokens.sub,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            TextButton(onClick = onDismiss) {
                Text(text = "Fechar", color = tokens.muted, fontSize = 13.sp)
            }
        }
    }
}

/**
 * Barra de navegação inferior idêntica ao `src/components/BottomNav.jsx`.
 */
enum class PatientTab(val route: String, val label: String, val icon: String) {
    HOME("home", "Início", "🏠"),
    MEDS("meds", "Remédios", "💊"),
    CALENDAR("calendar", "Agenda", "📅"),
    STATS("stats", "Saúde", "📊"),
    AI("ai", "Assistente", "✨"),
    PROFILE("profile", "Perfil", "👤")
}

@Composable
fun MediCareBottomNav(
    currentTab: PatientTab,
    pendingDosesCount: Int,
    onSelectTab: (PatientTab) -> Unit
) {
    val tokens = LocalMediCareTokens.current

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(tokens.nav)
            .border(1.dp, tokens.bdr)
            .padding(vertical = 8.dp, horizontal = 6.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        PatientTab.entries.forEach { tab ->
            val selected = tab == currentTab
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (selected) MediCareColors.Blue.copy(alpha = 0.16f) else Color.Transparent)
                    .clickable { onSelectTab(tab) }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box {
                    Text(text = tab.icon, fontSize = 19.sp)
                    if (tab == PatientTab.HOME && pendingDosesCount > 0) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MediCareColors.Amber)
                                .align(Alignment.TopEnd)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = tab.label,
                    color = if (selected) MediCareColors.Blue else tokens.muted,
                    fontSize = 11.sp,
                    fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Medium
                )
            }
        }
    }
}
