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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
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
 * Barra de nível de estoque (`src/components/ui/StockBar.jsx`).
 */
@Composable
fun StockBar(qty: Int, maxQty: Int = 30) {
    val tokens = LocalMediCareTokens.current
    val fraction = (qty.toFloat() / maxQty.coerceAtLeast(1)).coerceIn(0f, 1f)
    val barColor = when {
        qty <= 5 -> MediCareColors.Red
        qty <= 10 -> MediCareColors.Amber
        else -> MediCareColors.Green
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(99.dp))
            .background(tokens.bg3)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction)
                .fillMaxHeight()
                .clip(RoundedCornerShape(99.dp))
                .background(barColor)
        )
    }
}

/**
 * Badge de tipo de tratamento (`src/components/ui/TreatmentBadge.jsx`).
 */
@Composable
fun TreatmentTypeBadge(type: TreatmentType, status: String = "ativo") {
    val isFinished = status == "finalizado"
    val badgeColor = if (isFinished) Color(0xFF64748B) else Color(type.colorHex)
    val label = if (isFinished) "✓ Finalizado" else "${type.icon} ${type.shortLabel}"

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(badgeColor.copy(alpha = 0.14f))
            .border(1.dp, badgeColor.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = label,
            color = badgeColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Barra de progresso de tratamento temporário (`src/components/ui/TreatmentBadge.jsx`).
 */
@Composable
fun TreatmentProgressBar(med: Medication) {
    val tokens = LocalMediCareTokens.current
    val progress = DoseCalculator.getTreatmentProgress(med) ?: return
    val isFinished = med.status == "finalizado" || progress.isExpired
    val barColor = if (isFinished) MediCareColors.Green else MediCareColors.Amber

    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (isFinished) "Tratamento concluído (${progress.totalDays} dias)"
                else "Dia ${progress.dayNumber} de ${progress.totalDays}",
                color = barColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
            if (!med.endDate.isNullOrBlank()) {
                Text(
                    text = "Término: ${med.endDate.split("-").reversed().joinToString("/")}",
                    color = tokens.muted,
                    fontSize = 11.sp
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(99.dp))
                .background(tokens.bg3)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth((progress.percent / 100f).coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(99.dp))
                    .background(barColor)
            )
        }
    }
}

/**
 * Badge de confirmação por cuidador (`src/components/ui/CaregiverBadge.jsx`).
 */
@Composable
fun CaregiverBadge(record: DoseHistoryRecord) {
    if (record.confirmedByName.isNullOrBlank()) return
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MediCareColors.Purple.copy(alpha = 0.14f))
            .padding(horizontal = 7.dp, vertical = 2.dp)
    ) {
        Text(
            text = "🤝 Por ${record.confirmedByName}",
            color = MediCareColors.Purple,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Hero Card da Próxima Dose (`NextDoseHero` em `src/components/Dashboard.jsx`).
 */
@Composable
fun NextDoseHero(
    dose: ScheduledDose?,
    onConfirm: (ScheduledDose) -> Unit,
    onRemind: (ScheduledDose) -> Unit
) {
    val tokens = LocalMediCareTokens.current

    if (dose == null) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.linearGradient(
                        listOf(MediCareColors.Green.copy(alpha = 0.16f), MediCareColors.Green.copy(alpha = 0.05f))
                    )
                )
                .border(1.5.dp, MediCareColors.Green.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "🎉", fontSize = 40.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Todas as doses de hoje confirmadas!",
                color = MediCareColors.Green,
                fontSize = 17.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Excelente! Continue cuidando da sua saúde.",
                color = tokens.sub,
                fontSize = 14.sp
            )
        }
        return
    }

    val pillColor = MediCareColors.parseHex(dose.cor)
    val isLate = dose.status == DoseStatus.LATE || dose.status == DoseStatus.MISSED
    val statusColor = Color(dose.status.colorHex)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.linearGradient(
                    listOf(pillColor.copy(alpha = 0.18f), pillColor.copy(alpha = 0.04f))
                )
            )
            .border(1.5.dp, pillColor.copy(alpha = 0.45f), RoundedCornerShape(22.dp))
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "PRÓXIMO MEDICAMENTO",
                color = tokens.sub,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(99.dp))
                    .background(statusColor.copy(alpha = 0.18f))
                    .padding(horizontal = 10.dp, vertical = 3.dp)
            ) {
                Text(
                    text = if (isLate) "⚠️ ${dose.status.label}" else dose.status.label,
                    color = statusColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(pillColor.copy(alpha = 0.2f))
                    .border(2.dp, pillColor.copy(alpha = 0.55f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "💊", fontSize = 26.sp)
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = dose.nome,
                    color = tokens.txt,
                    fontSize = (20 * tokens.fontScale).sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${dose.dosagem} · 1 ${dose.unidade}",
                    color = tokens.sub,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = dose.hora,
                    color = pillColor,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = DoseCalculator.timeLabel(dose.hora),
                    color = if (isLate) MediCareColors.Red else tokens.sub,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { onConfirm(dose) },
            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            Text(
                text = "✓  Já tomei",
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = { onRemind(dose) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(44.dp)
        ) {
            Text(
                text = "⏰  Lembrar em 15 minutos",
                color = tokens.sub,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * Barra e contadores de Progresso do Dia (`DayProgress` em `src/components/Dashboard.jsx`).
 */
@Composable
fun DayProgress(doses: List<ScheduledDose>) {
    val tokens = LocalMediCareTokens.current
    val total = doses.size
    val done = doses.count { it.status == DoseStatus.CONFIRMED }
    val missed = doses.count { it.status == DoseStatus.MISSED || it.status == DoseStatus.LATE }
    val pending = (total - done - missed).coerceAtLeast(0)
    val pct = if (total > 0) ((done * 100f) / total).toInt() else 0

    val barColor = when {
        pct == 100 -> MediCareColors.Green
        pct >= 60 -> MediCareColors.Blue
        else -> MediCareColors.Amber
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(tokens.bg1)
            .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
            .padding(18.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Progresso do dia",
                color = tokens.txt,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "$done/$total doses ($pct%)",
                color = if (pct == 100) MediCareColors.Green else tokens.sub,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(99.dp))
                .background(tokens.bg3)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth((pct / 100f).coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(99.dp))
                    .background(barColor)
            )
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            DayStatCol("Tomadas", done, MediCareColors.Green)
            DayStatCol("Pendentes", pending, MediCareColors.Amber)
            DayStatCol("Perdidas", missed, MediCareColors.Red)
            DayStatCol("Total", total, MediCareColors.Blue)
        }
    }
}

@Composable
private fun DayStatCol(label: String, value: Int, color: Color) {
    val tokens = LocalMediCareTokens.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value.toString(),
            color = color,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black
        )
        Text(
            text = label,
            color = tokens.muted,
            fontSize = 11.sp
        )
    }
}

/**
 * Linha do Tempo Vertical do Dia (`Timeline` em `src/components/Dashboard.jsx`).
 */
@Composable
fun DailyTimeline(
    doses: List<ScheduledDose>,
    onSelectDose: (ScheduledDose) -> Unit,
    onUndoRequest: (ScheduledDose) -> Unit
) {
    val tokens = LocalMediCareTokens.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(tokens.bg1)
            .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
            .padding(18.dp)
    ) {
        Text(
            text = "📅 Linha do dia",
            color = tokens.txt,
            fontSize = 15.sp,
            fontWeight = FontWeight.ExtraBold
        )
        Spacer(modifier = Modifier.height(14.dp))

        if (doses.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Nenhuma dose programada para hoje.",
                    color = tokens.muted,
                    fontSize = 14.sp
                )
            }
            return
        }

        doses.forEachIndexed { idx, d ->
            val done = d.status == DoseStatus.CONFIRMED
            val missed = d.status == DoseStatus.MISSED
            val late = d.status == DoseStatus.LATE
            val active = d.status == DoseStatus.PENDING || d.status == DoseStatus.UPCOMING || late
            val pillColor = MediCareColors.parseHex(d.cor)
            val statusColor = Color(d.status.colorHex)

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Conector vertical + Nó circular
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(34.dp)
                ) {
                    val nodeBg = when {
                        done -> MediCareColors.Green
                        missed -> MediCareColors.Red.copy(alpha = 0.2f)
                        late -> MediCareColors.Amber
                        else -> pillColor.copy(alpha = 0.2f)
                    }
                    val nodeBorder = when {
                        done -> MediCareColors.Green
                        missed -> MediCareColors.Red
                        late -> MediCareColors.Amber
                        else -> pillColor
                    }
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(nodeBg)
                            .border(2.dp, nodeBorder, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = when {
                                done -> "✓"
                                missed -> "✕"
                                late -> "!"
                                else -> "💊"
                            },
                            color = if (done || late) Color.White else nodeBorder,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    if (idx < doses.lastIndex) {
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(36.dp)
                                .background(if (done) MediCareColors.Green.copy(alpha = 0.5f) else tokens.bdr)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(10.dp))

                // Card da dose na timeline
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(bottom = if (idx < doses.lastIndex) 10.dp else 0.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (active) pillColor.copy(alpha = 0.10f) else tokens.bg2)
                        .border(
                            1.5.dp,
                            if (active) pillColor.copy(alpha = 0.45f) else tokens.bdr,
                            RoundedCornerShape(14.dp)
                        )
                        .clickable { if (!done) onSelectDose(d) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = d.hora,
                                color = pillColor,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = d.nome,
                                color = if (done) tokens.muted else tokens.txt,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                textDecoration = if (done) TextDecoration.LineThrough else TextDecoration.None,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${d.dosagem} · ${DoseCalculator.timeLabel(d.hora)}",
                            color = tokens.muted,
                            fontSize = 12.sp
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(99.dp))
                                .background(statusColor.copy(alpha = 0.16f))
                                .padding(horizontal = 9.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = d.status.label,
                                color = statusColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (active) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Toque →",
                                color = pillColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (done && d.histId != null) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(tokens.bg3)
                                    .border(1.dp, tokens.bdr, RoundedCornerShape(8.dp))
                                    .clickable { onUndoRequest(d) }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "Desfazer",
                                    color = tokens.sub,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Modal de Aviso de Horário Antecipado (>60 min antes do horário programado).
 */
@Composable
fun TimeWarningModal(
    dose: ScheduledDose,
    minutesEarly: Long,
    onConfirmAnyway: () -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val hours = minutesEarly / 60
    val mins = minutesEarly % 60
    val timeStr = if (hours > 0) "${hours}h ${mins}min" else "${mins} minutos"

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "⏳", fontSize = 42.sp)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Dose muito adiantada",
                color = tokens.txt,
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Esta dose de ${dose.nome} (${dose.dosagem}) está programada para as ${dose.hora} (faltam $timeStr). Deseja confirmar mesmo assim?",
                color = tokens.sub,
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Cancelar", color = tokens.sub, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = onConfirmAnyway,
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Amber),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Confirmar", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}

/**
 * Modal de Confirmação para Desfazer Dose (`UndoConfirmModal` em `src/screens/HomeScreen.jsx`).
 */
@Composable
fun UndoConfirmModal(
    dose: ScheduledDose,
    onConfirmUndo: () -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "↩️", fontSize = 40.sp)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Desfazer confirmação?",
                color = tokens.txt,
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "A dose das ${dose.hora} de ${dose.nome} voltará para pendente e 1 ${dose.unidade} será devolvido ao estoque.",
                color = tokens.sub,
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Voltar", color = tokens.sub, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = onConfirmUndo,
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Sim, desfazer", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
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
 * Barra de navegação inferior idêntica ao `src/components/BottomNav.jsx` (5 abas principais + badge de estoque crítico).
 */
enum class PatientTab(val route: String, val label: String, val icon: String, val visibleInBottomBar: Boolean = true) {
    HOME("home", "Início", "🏠", true),
    MEDS("meds", "Medicamentos", "💊", true),
    CALENDAR("calendar", "Calendário", "📅", true),
    AI("ai", "Assistente", "🩺", true),
    PROFILE("profile", "Perfil", "👤", true),
    STATS("stats", "Saúde", "📊", false),
    STOCK_HISTORY("stock_history", "Estoque", "📦", false)
}

@Composable
fun MediCareBottomNav(
    currentTab: PatientTab,
    criticalStockCount: Int,
    onSelectTab: (PatientTab) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val mainTabs = remember { PatientTab.entries.filter { it.visibleInBottomBar } }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(tokens.nav)
            .border(1.dp, tokens.bdr)
            .padding(top = 8.dp, bottom = 10.dp, start = 4.dp, end = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        mainTabs.forEach { tab ->
            val selected = tab == currentTab ||
                (tab == PatientTab.HOME && currentTab == PatientTab.STATS) ||
                (tab == PatientTab.PROFILE && currentTab == PatientTab.STOCK_HISTORY)

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onSelectTab(tab) }
                    .padding(vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box {
                        Text(text = tab.icon, fontSize = 21.sp)
                        if (tab == PatientTab.MEDS && criticalStockCount > 0) {
                            Box(
                                modifier = Modifier
                                    .offset(x = 8.dp, y = (-4).dp)
                                    .size(16.dp)
                                    .clip(CircleShape)
                                    .background(MediCareColors.Red),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = criticalStockCount.toString(),
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = tab.label,
                        color = if (selected) MediCareColors.Blue else tokens.muted,
                        fontSize = 10.sp,
                        fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Medium,
                        maxLines = 1
                    )
                    if (selected) {
                        Spacer(modifier = Modifier.height(3.dp))
                        Box(
                            modifier = Modifier
                                .width(20.dp)
                                .height(3.dp)
                                .clip(RoundedCornerShape(99.dp))
                                .background(MediCareColors.Blue)
                        )
                    }
                }
            }
        }
    }
}
