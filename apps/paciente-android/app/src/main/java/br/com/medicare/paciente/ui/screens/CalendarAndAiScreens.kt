package br.com.medicare.paciente.ui.screens

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.ui.components.CaregiverBadge
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors
import br.com.medicare.paciente.ui.viewmodel.PatientUiState
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID

private val MONTH_NAMES_PT = listOf(
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
)
private val WEEKDAY_SHORT_PT = listOf("Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb")

/**
 * Tela de Calendário Completa (`src/screens/CalendarScreen.jsx` + `RetroactiveConfirmModal.jsx`).
 */
@Composable
fun PatientCalendarScreen(
    state: PatientUiState,
    onSaveEvent: (HealthEvent) -> Unit,
    onDeleteEvent: (String) -> Unit,
    onSaveNote: (CalendarNote) -> Unit,
    onDeleteNote: (String) -> Unit,
    onSaveDoseObs: (String, String) -> Unit,
    onConfirmRetroactive: (medId: String, hora: String, dateIso: String, reason: String) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val today = remember { LocalDate.now() }
    var currentMonth by remember { mutableStateOf(YearMonth.now()) }
    var selectedDateIso by remember { mutableStateOf<String?>(null) }

    var showSearch by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }

    var showNoteModalForDate by remember { mutableStateOf<String?>(null) }
    var editingNote by remember { mutableStateOf<CalendarNote?>(null) }

    var showEventModalForDate by remember { mutableStateOf<String?>(null) }
    var editingEvent by remember { mutableStateOf<HealthEvent?>(null) }

    var retroactiveTarget by remember { mutableStateOf<Triple<Medication, String, String>?>(null) }
    var obsTarget by remember { mutableStateOf<Triple<String, String, String>?>(null) } // doseKey, medLabel, currentObs

    val hasCalendarModal = showNoteModalForDate != null || editingNote != null ||
            showEventModalForDate != null || editingEvent != null ||
            retroactiveTarget != null || obsTarget != null ||
            selectedDateIso != null || showSearch

    BackHandler(enabled = hasCalendarModal) {
        when {
            showNoteModalForDate != null || editingNote != null -> {
                showNoteModalForDate = null
                editingNote = null
            }
            showEventModalForDate != null || editingEvent != null -> {
                showEventModalForDate = null
                editingEvent = null
            }
            retroactiveTarget != null -> retroactiveTarget = null
            obsTarget != null -> obsTarget = null
            selectedDateIso != null -> selectedDateIso = null
            showSearch -> {
                showSearch = false
                searchQuery = ""
            }
        }
    }

    val activeMeds = remember(state.medications) {
        state.medications.filter { it.ativo && it.treatmentType != "sos" }
    }
    val expectedPerDay = remember(activeMeds) {
        activeMeds.sumOf { it.horarios.size.coerceAtLeast(1) }
    }

    val monthPrefix = "%04d-%02d".format(currentMonth.year, currentMonth.monthValue)
    val monthHist = remember(state.history, monthPrefix) {
        state.history.filter { it.createdAt.startsWith(monthPrefix) && it.status == "confirmed" }
    }
    val monthNotes = remember(state.calendarNotes, monthPrefix) {
        state.calendarNotes.filter { it.date.startsWith(monthPrefix) }
    }
    val monthEvents = remember(state.healthEvents, monthPrefix) {
        state.healthEvents.filter { it.date.startsWith(monthPrefix) }
    }

    val upcomingEvents = remember(state.healthEvents, today) {
        state.healthEvents
            .filter { it.date >= today.toString() && it.type != "estoque" }
            .sortedBy { it.date }
            .take(4)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        // Header + Busca
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Calendário",
                    color = tokens.txt,
                    fontSize = (24 * tokens.fontScale).sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Histórico, consultas e anotações",
                    color = tokens.sub,
                    fontSize = 14.sp
                )
            }
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (showSearch) MediCareColors.Blue else tokens.bg1)
                    .border(1.dp, if (showSearch) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(12.dp))
                    .clickable {
                        showSearch = !showSearch
                        if (!showSearch) searchQuery = ""
                    },
                contentAlignment = Alignment.Center
            ) {
                Text("🔍", fontSize = 18.sp)
            }
        }

        if (showSearch) {
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Buscar anotações, consultas, medicamentos...") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            if (searchQuery.trim().length >= 2) {
                val q = searchQuery.trim().lowercase()
                val matchedNotes = state.calendarNotes.filter { it.content.lowercase().contains(q) }
                val matchedEvents = state.healthEvents.filter {
                    it.type != "estoque" && (it.title.lowercase().contains(q) || (it.doctor?.lowercase()?.contains(q) == true))
                }
                val matchedStock = state.stockMovements.filter { sm ->
                    val medName = state.medications.find { it.id == sm.medicationId }?.nome ?: ""
                    medName.lowercase().contains(q) || (sm.notes?.lowercase()?.contains(q) == true) || (sm.purchaseLocation?.lowercase()?.contains(q) == true)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                        .padding(12.dp)
                ) {
                    if (matchedNotes.isEmpty() && matchedEvents.isEmpty() && matchedStock.isEmpty()) {
                        Text("Nenhum resultado para \"$searchQuery\".", color = tokens.muted, fontSize = 13.sp)
                    } else {
                        matchedEvents.forEach { ev ->
                            Text(
                                text = "📅 ${ev.date.split("-").reversed().joinToString("/")} — ${ev.title}",
                                color = tokens.txt,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedDateIso = ev.date }
                                    .padding(vertical = 4.dp)
                            )
                        }
                        matchedStock.forEach { sm ->
                            val dIso = sm.createdAt.take(10)
                            val medName = state.medications.find { it.id == sm.medicationId }?.nome ?: "Medicamento"
                            val sign = if (sm.quantityDelta >= 0) "+${sm.quantityDelta}" else "${sm.quantityDelta}"
                            Text(
                                text = "📦 ${dIso.split("-").reversed().joinToString("/")} — Reposição: $medName ($sign)",
                                color = Color(0xFF34D399),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedDateIso = dIso }
                                    .padding(vertical = 4.dp)
                            )
                        }
                        matchedNotes.forEach { n ->
                            Text(
                                text = "📝 ${n.date.split("-").reversed().joinToString("/")} — ${n.content}",
                                color = tokens.sub,
                                fontSize = 13.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedDateIso = n.date }
                                    .padding(vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Mini-Calendário Mensal Interativo
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(20.dp))
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(tokens.bg2)
                        .clickable { currentMonth = currentMonth.minusMonths(1) },
                    contentAlignment = Alignment.Center
                ) { Text("‹", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Bold) }

                Text(
                    text = "${MONTH_NAMES_PT[currentMonth.monthValue - 1]} ${currentMonth.year}",
                    color = tokens.txt,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )

                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(tokens.bg2)
                        .clickable { currentMonth = currentMonth.plusMonths(1) },
                    contentAlignment = Alignment.Center
                ) { Text("›", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Cabeçalho dias da semana
            Row(modifier = Modifier.fillMaxWidth()) {
                WEEKDAY_SHORT_PT.forEach { wd ->
                    Text(
                        text = wd,
                        color = tokens.muted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            val firstDayOfWeek = currentMonth.atDay(1).dayOfWeek.value % 7 // Dom = 0
            val daysInMonth = currentMonth.lengthOfMonth()
            val totalCells = ((firstDayOfWeek + daysInMonth + 6) / 7) * 7

            for (week in 0 until (totalCells / 7)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    for (dow in 0..6) {
                        val cellIndex = week * 7 + dow
                        val dayNum = cellIndex - firstDayOfWeek + 1
                        if (dayNum < 1 || dayNum > daysInMonth) {
                            Spacer(modifier = Modifier.weight(1f).height(44.dp))
                        } else {
                            val dateObj = currentMonth.atDay(dayNum)
                            val dateIso = dateObj.toString()
                            val isToday = dateObj == today
                            val isPast = dateObj.isBefore(today)
                            val isSelected = selectedDateIso == dateIso

                            val dayConfirmed = state.history.count {
                                it.createdAt.startsWith(dateIso) && it.status == "confirmed"
                            }
                            val hasNote = state.calendarNotes.any { it.date == dateIso }
                            val hasConsult = state.healthEvents.any { it.date == dateIso && it.type != "estoque" }
                            val hasStock = state.stockMovements.any { it.createdAt.startsWith(dateIso) && it.movementType != "consumption" } ||
                                    state.healthEvents.any { it.date == dateIso && it.type == "estoque" }

                            val statusBg = when {
                                expectedPerDay > 0 && dayConfirmed >= expectedPerDay -> MediCareColors.Green.copy(alpha = 0.22f)
                                dayConfirmed > 0 -> MediCareColors.Amber.copy(alpha = 0.22f)
                                isPast && expectedPerDay > 0 -> MediCareColors.Red.copy(alpha = 0.14f)
                                else -> tokens.bg2
                            }

                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(statusBg)
                                    .border(
                                        width = if (isSelected || isToday) 2.dp else 0.dp,
                                        color = when {
                                            isSelected -> MediCareColors.Purple
                                            isToday -> MediCareColors.Blue
                                            else -> Color.Transparent
                                        },
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    .clickable { selectedDateIso = dateIso },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = dayNum.toString(),
                                    color = if (isToday) MediCareColors.Blue else tokens.txt,
                                    fontSize = 13.sp,
                                    fontWeight = if (isToday || isSelected) FontWeight.Black else FontWeight.SemiBold
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                    if (dayConfirmed > 0) {
                                        DotIndicator(if (dayConfirmed >= expectedPerDay) MediCareColors.Green else MediCareColors.Amber)
                                    }
                                    if (hasNote) DotIndicator(MediCareColors.Blue)
                                    if (hasConsult) DotIndicator(MediCareColors.Purple)
                                    if (hasStock) DotIndicator(Color(0xFF06B6D4))
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            // Legenda
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                LegendItem(MediCareColors.Green, "Tomado")
                LegendItem(MediCareColors.Amber, "Parcial")
                LegendItem(MediCareColors.Red, "Perdido")
                LegendItem(MediCareColors.Blue, "Nota")
                LegendItem(MediCareColors.Purple, "Evento")
                LegendItem(Color(0xFF34D399), "Estoque")
            }
        }

        // Próximos Eventos
        if (upcomingEvents.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(16.dp)
            ) {
                Text("📅 Próximos eventos", color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(modifier = Modifier.height(10.dp))
                upcomingEvents.forEach { ev ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(tokens.bg2)
                            .clickable { selectedDateIso = ev.date }
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(ev.title, color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text(
                                text = listOfNotNull(
                                    ev.date.split("-").reversed().joinToString("/"),
                                    ev.time,
                                    ev.doctor
                                ).joinToString(" · "),
                                color = tokens.sub,
                                fontSize = 12.sp
                            )
                        }
                        Text("Ver →", color = MediCareColors.Purple, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Botões Rápidos: Nova anotação / Novo evento
        Spacer(modifier = Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    editingNote = null
                    showNoteModalForDate = today.toString()
                },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.weight(1f).height(48.dp)
            ) {
                Text("📝 Nova anotação", color = MediCareColors.Blue, fontWeight = FontWeight.Bold)
            }
            OutlinedButton(
                onClick = {
                    editingEvent = null
                    showEventModalForDate = today.toString()
                },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.weight(1f).height(48.dp)
            ) {
                Text("📅 Novo evento", color = MediCareColors.Purple, fontWeight = FontWeight.Bold)
            }
        }

        // Resumo Mensal de 8 Cards
        Spacer(modifier = Modifier.height(16.dp))
        val passedDays = if (currentMonth == YearMonth.now()) today.dayOfMonth else currentMonth.lengthOfMonth()
        val expectedMonthTotal = (passedDays * expectedPerDay).coerceAtLeast(1)
        val adhesionMonthPct = ((monthHist.size * 100f) / expectedMonthTotal).toInt().coerceIn(0, 100)
        val lateMonthCount = monthHist.count { it.atrasoMinutos > 15 }
        val missedMonthCount = (expectedMonthTotal - monthHist.size).coerceAtLeast(0)
        val consultMonthCount = monthEvents.count { it.type != "estoque" }
        val stockMonthCount = state.stockMovements.count { it.createdAt.startsWith(monthPrefix) && it.quantityDelta > 0 } +
                monthEvents.count { it.type == "estoque" }
        val sosMonthCount = monthHist.count { rec ->
            state.medications.find { it.id == rec.medId }?.treatmentType == "sos"
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                .padding(16.dp)
        ) {
            Text(
                text = "📊 Resumo — ${MONTH_NAMES_PT[currentMonth.monthValue - 1]} ${currentMonth.year}",
                color = tokens.txt,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonthStatMiniCard("Adesão", "$adhesionMonthPct%", MediCareColors.Green, Modifier.weight(1f))
                MonthStatMiniCard("Tomadas", "${monthHist.size}", MediCareColors.Blue, Modifier.weight(1f))
                MonthStatMiniCard("Atrasos", "$lateMonthCount", MediCareColors.Amber, Modifier.weight(1f))
                MonthStatMiniCard("Perdidas", "$missedMonthCount", MediCareColors.Red, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonthStatMiniCard("Anotações", "${monthNotes.size}", MediCareColors.Blue, Modifier.weight(1f))
                MonthStatMiniCard("Consultas", "$consultMonthCount", MediCareColors.Purple, Modifier.weight(1f))
                MonthStatMiniCard("Uso SOS", "$sosMonthCount", Color(0xFFEC4899), Modifier.weight(1f))
                MonthStatMiniCard("Reposições", "$stockMonthCount", Color(0xFF06B6D4), Modifier.weight(1f))
            }
        }
    }

    // DayPanel Modal ao clicar em um dia do calendário
    selectedDateIso?.let { dateIso ->
        DayPanelDialog(
            dateIso = dateIso,
            state = state,
            onAddNote = {
                editingNote = null
                showNoteModalForDate = dateIso
            },
            onEditNote = { n ->
                editingNote = n
                showNoteModalForDate = dateIso
            },
            onDeleteNote = onDeleteNote,
            onAddEvent = {
                editingEvent = null
                showEventModalForDate = dateIso
            },
            onEditEvent = { ev ->
                editingEvent = ev
                showEventModalForDate = dateIso
            },
            onDeleteEvent = onDeleteEvent,
            onRequestRetroactive = { med, hora ->
                retroactiveTarget = Triple(med, hora, dateIso)
            },
            onRequestDoseObs = { doseKey, label, existing ->
                obsTarget = Triple(doseKey, label, existing)
            },
            onDismiss = { selectedDateIso = null }
        )
    }

    // Modal de Nota
    showNoteModalForDate?.let { dateIso ->
        NoteModalDialog(
            userId = state.user?.id ?: "user-local",
            dateIso = dateIso,
            existing = editingNote,
            onSave = onSaveNote,
            onDismiss = { showNoteModalForDate = null }
        )
    }

    // Modal de Evento / Consulta
    showEventModalForDate?.let { dateIso ->
        EventModalDialog(
            userId = state.user?.id ?: "user-local",
            dateIso = dateIso,
            existing = editingEvent,
            onSave = onSaveEvent,
            onDismiss = { showEventModalForDate = null }
        )
    }

    // Modal de Confirmação Retroativa com Auditoria
    retroactiveTarget?.let { (med, hora, dateIso) ->
        RetroactiveConfirmModal(
            med = med,
            hora = hora,
            dateIso = dateIso,
            userRole = state.user?.role ?: "independente",
            onConfirm = { reason ->
                onConfirmRetroactive(med.id, hora, dateIso, reason)
                retroactiveTarget = null
            },
            onDismiss = { retroactiveTarget = null }
        )
    }

    // Modal de Observação por Dose
    obsTarget?.let { (doseKey, label, current) ->
        var text by remember { mutableStateOf(current) }
        val tokensModal = LocalMediCareTokens.current
        Dialog(onDismissRequest = { obsTarget = null }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokensModal.bg1)
                    .border(1.dp, tokensModal.bdr, RoundedCornerShape(22.dp))
                    .padding(20.dp)
            ) {
                Text("💬 Observação da Dose", color = tokensModal.txt, fontSize = 17.sp, fontWeight = FontWeight.Black)
                Text(label, color = tokensModal.sub, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("Ex: Tomei após o almoço, senti leve tontura...") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { obsTarget = null }, modifier = Modifier.weight(1f)) {
                        Text("Cancelar", color = tokensModal.sub)
                    }
                    Button(
                        onClick = {
                            onSaveDoseObs(doseKey, text)
                            obsTarget = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Salvar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun DotIndicator(color: Color) {
    Box(
        modifier = Modifier
            .size(4.dp)
            .clip(CircleShape)
            .background(color)
    )
}

@Composable
private fun LegendItem(color: Color, label: String) {
    val tokens = LocalMediCareTokens.current
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color))
        Text(label, color = tokens.muted, fontSize = 10.sp)
    }
}

@Composable
private fun MonthStatMiniCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    val tokens = LocalMediCareTokens.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(tokens.bg2)
            .padding(vertical = 10.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, color = color, fontSize = 16.sp, fontWeight = FontWeight.Black)
        Text(label, color = tokens.muted, fontSize = 10.sp, maxLines = 1)
    }
}

/**
 * Painel de Detalhes do Dia (`DayPanel` em `src/screens/CalendarScreen.jsx`).
 */
@Composable
private fun DayPanelDialog(
    dateIso: String,
    state: PatientUiState,
    onAddNote: () -> Unit,
    onEditNote: (CalendarNote) -> Unit,
    onDeleteNote: (String) -> Unit,
    onAddEvent: () -> Unit,
    onEditEvent: (HealthEvent) -> Unit,
    onDeleteEvent: (String) -> Unit,
    onRequestRetroactive: (Medication, String) -> Unit,
    onRequestDoseObs: (String, String, String) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var filter by remember { mutableStateOf("all") }
    val dayHist = remember(state.history, dateIso) {
        state.history.filter { it.createdAt.startsWith(dateIso) && it.status == "confirmed" }
    }
    val dayNotes = remember(state.calendarNotes, dateIso) {
        state.calendarNotes.filter { it.date == dateIso }
    }
    val dayEvents = remember(state.healthEvents, dateIso) {
        state.healthEvents.filter { it.date == dateIso && it.type != "estoque" && !it.title.startsWith("Reposição:") }
    }
    val dayStockMovements = remember(state.stockMovements, dateIso) {
        state.stockMovements
            .filter { it.createdAt.startsWith(dateIso) && it.movementType != "consumption" }
            .distinctBy { sm ->
                val hm = if (sm.createdAt.length >= 16 && sm.createdAt[10] == 'T') sm.createdAt.substring(11, 16) else ""
                "${sm.medicationId}|${sm.quantityDelta}|$hm"
            }
    }
    val dayLegacyStockEvents = remember(state.healthEvents, dayStockMovements, dateIso) {
        state.healthEvents.filter { ev ->
            ev.date == dateIso && (ev.type == "estoque" || ev.title.startsWith("Reposição:")) &&
                dayStockMovements.none { sm ->
                    val smHm = if (sm.createdAt.length >= 16 && sm.createdAt[10] == 'T') sm.createdAt.substring(11, 16) else ""
                    val evHm = ev.time?.take(5) ?: ""
                    evHm.isEmpty() || smHm.isEmpty() || evHm == smHm
                }
        }
    }
    val activeScheduledMeds = remember(state.medications) {
        state.medications.filter { it.ativo && it.treatmentType != "sos" }
    }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 640.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
        ) {
            Column(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .padding(horizontal = 20.dp, vertical = 18.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "📅 Dia ${dateIso.split("-").reversed().joinToString("/")}",
                        color = tokens.txt,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(17.dp))
                            .background(tokens.bg2)
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("✕", color = tokens.muted, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        "all" to "Todos",
                        "meds" to "💊 Medicamentos",
                        "notes" to "📝 Notas",
                        "events" to "📅 Consultas",
                        "stock" to "📦 Estoque"
                    ).forEach { (id, label) ->
                        val sel = filter == id
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(99.dp))
                                .background(if (sel) MediCareColors.Blue else tokens.bg2)
                                .clickable { filter = id }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(label, color = if (sel) Color.White else tokens.sub, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (filter == "all" || filter == "meds") {
                    Text("💊 Doses do dia", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    activeScheduledMeds.forEach { med ->
                        med.horarios.forEach { hora ->
                            val rec = dayHist.firstOrNull { it.medId == med.id && it.hora == hora }
                            val confirmed = rec != null
                            val doseKey = "${dateIso}_${med.id}_$hora"
                            val obsText = state.doseObservations.firstOrNull { it.doseKey == doseKey }?.content

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${med.nome} (${med.dosagem})", color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                        Text("Horário: $hora", color = tokens.sub, fontSize = 12.sp)
                                        if (rec != null) {
                                            CaregiverBadge(rec)
                                        }
                                    }
                                    if (confirmed) {
                                        Text(
                                            text = if (rec?.isRetroactive == true) "✓ Retroativa" else "✓ Tomada",
                                            color = MediCareColors.Green,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.ExtraBold
                                        )
                                    } else {
                                        Text(
                                            text = "🕐 Confirmar retroativamente",
                                            color = MediCareColors.Amber,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.clickable { onRequestRetroactive(med, hora) }
                                        )
                                    }
                                }
                                if (!obsText.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("💬 $obsText", color = MediCareColors.Blue, fontSize = 12.sp)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = if (obsText.isNullOrBlank()) "+ Adicionar observação" else "✏️ Editar observação",
                                    color = tokens.muted,
                                    fontSize = 11.sp,
                                    modifier = Modifier.clickable {
                                        onRequestDoseObs(doseKey, "${med.nome} às $hora", obsText ?: "")
                                    }
                                )
                            }
                        }
                    }
                }

                if (filter == "all" || filter == "events") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("📅 Consultas e Eventos", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("+ Adicionar", color = MediCareColors.Purple, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onAddEvent() })
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    if (dayEvents.isEmpty()) {
                        Text("Nenhum evento registrado neste dia.", color = tokens.muted, fontSize = 12.sp)
                    } else {
                        dayEvents.forEach { ev ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(ev.title, color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    Text(
                                        text = listOfNotNull(ev.type.uppercase(), ev.time, ev.doctor, ev.location).joinToString(" · "),
                                        color = tokens.sub,
                                        fontSize = 11.sp
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("✏️", modifier = Modifier.clickable { onEditEvent(ev) })
                                    Text("🗑️", modifier = Modifier.clickable { onDeleteEvent(ev.id) })
                                }
                            }
                        }
                    }
                }

                if (filter == "all" || filter == "notes") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("📝 Anotações do dia", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("+ Nova nota", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onAddNote() })
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    if (dayNotes.isEmpty()) {
                        Text("Nenhuma anotação neste dia.", color = tokens.muted, fontSize = 12.sp)
                    } else {
                        dayNotes.forEach { n ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(n.content, color = tokens.txt, fontSize = 13.sp, modifier = Modifier.weight(1f))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("✏️", modifier = Modifier.clickable { onEditNote(n) })
                                    Text("🗑️", modifier = Modifier.clickable { onDeleteNote(n.id) })
                                }
                            }
                        }
                    }
                }

                if (filter == "all" || filter == "stock") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("📦 Estoque", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    if (dayStockMovements.isEmpty() && dayLegacyStockEvents.isEmpty()) {
                        Text("Nenhuma movimentação de estoque neste dia.", color = tokens.muted, fontSize = 12.sp)
                    } else {
                        dayStockMovements.forEach { sm ->
                            val medName = state.medications.find { it.id == sm.medicationId }?.nome ?: "Medicamento"
                            val sign = if (sm.quantityDelta >= 0) "+${sm.quantityDelta}" else "${sm.quantityDelta}"
                            val label = if (sm.quantityDelta >= 0) "Reposição: $medName ($sign)" else "Ajuste: $medName ($sign)"
                            val timeStr = if (sm.createdAt.length >= 16 && sm.createdAt[10] == 'T') " às ${sm.createdAt.substring(11, 16)}" else ""
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(12.dp)
                            ) {
                                Text("📦 $label$timeStr", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                val detail = listOfNotNull(sm.purchaseLocation, sm.notes).filter { it.isNotBlank() }.joinToString(" · ")
                                if (detail.isNotBlank()) {
                                    Text(detail, color = tokens.sub, fontSize = 12.sp)
                                }
                            }
                        }
                        dayLegacyStockEvents.forEach { st ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("📦 ${st.title}", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    if (!st.description.isNullOrBlank()) {
                                        Text(st.description, color = tokens.sub, fontSize = 12.sp)
                                    }
                                }
                                Text("🗑️", modifier = Modifier.clickable { onDeleteEvent(st.id) })
                            }
                        }
                    }
                }
            }

            Spacer(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(tokens.bdr)
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(tokens.bg2)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                    .clickable { onDismiss() }
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Fechar",
                    color = tokens.txt,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun NoteModalDialog(
    userId: String,
    dateIso: String,
    existing: CalendarNote?,
    onSave: (CalendarNote) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var content by remember { mutableStateOf(existing?.content ?: "") }
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                .padding(20.dp)
        ) {
            Text(if (existing == null) "📝 Nova Anotação" else "✏️ Editar Anotação", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("Data: ${dateIso.split("-").reversed().joinToString("/")}", color = tokens.sub, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(10.dp))
            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                label = { Text("Como você se sentiu hoje?") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp)
            )
            Spacer(modifier = Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancelar", color = tokens.sub) }
                Button(
                    onClick = {
                        if (content.isNotBlank()) {
                            onSave(
                                CalendarNote(
                                    id = existing?.id ?: "note-${UUID.randomUUID().toString().take(8)}",
                                    userId = userId,
                                    date = dateIso,
                                    content = content.trim(),
                                    createdAt = existing?.createdAt ?: Instant.now().toString()
                                )
                            )
                            onDismiss()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    modifier = Modifier.weight(1f)
                ) { Text("Salvar", color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun EventModalDialog(
    userId: String,
    dateIso: String,
    existing: HealthEvent?,
    onSave: (HealthEvent) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var type by remember { mutableStateOf(existing?.type ?: "consulta") }
    var title by remember { mutableStateOf(existing?.title ?: "") }
    var date by remember { mutableStateOf(existing?.date ?: dateIso) }
    var time by remember { mutableStateOf(existing?.time ?: "14:00") }
    var doctor by remember { mutableStateOf(existing?.doctor ?: "") }
    var location by remember { mutableStateOf(existing?.location ?: "") }
    var description by remember { mutableStateOf(existing?.description ?: "") }

    val types = listOf("consulta" to "🩺 Consulta", "exame" to "🔬 Exame", "procedimento" to "🏥 Procedimento", "outro" to "📌 Outro")

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                .padding(20.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(if (existing == null) "📅 Novo Evento / Consulta" else "✏️ Editar Evento", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                types.forEach { (code, label) ->
                    val sel = type == code
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(99.dp))
                            .background(if (sel) MediCareColors.Purple else tokens.bg2)
                            .clickable { type = code }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(label, color = if (sel) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Data (AAAA-MM-DD)") }, singleLine = true, modifier = Modifier.weight(1.3f))
                OutlinedTextField(value = time, onValueChange = { time = it }, label = { Text("Hora") }, singleLine = true, modifier = Modifier.weight(0.7f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = doctor, onValueChange = { doctor = it }, label = { Text("Médico / Profissional") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Local / Clínica") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Observações / Preparo") }, modifier = Modifier.fillMaxWidth())

            Spacer(modifier = Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancelar", color = tokens.sub) }
                Button(
                    onClick = {
                        if (title.isNotBlank()) {
                            onSave(
                                HealthEvent(
                                    id = existing?.id ?: "ev-${UUID.randomUUID().toString().take(8)}",
                                    userId = userId,
                                    type = type,
                                    title = title.trim(),
                                    description = description.takeIf { it.isNotBlank() },
                                    date = date,
                                    time = time.takeIf { it.isNotBlank() },
                                    doctor = doctor.takeIf { it.isNotBlank() },
                                    location = location.takeIf { it.isNotBlank() },
                                    createdAt = existing?.createdAt ?: Instant.now().toString()
                                )
                            )
                            onDismiss()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Purple),
                    modifier = Modifier.weight(1f)
                ) { Text("Salvar", color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

/**
 * Modal de Confirmação Retroativa (`src/components/modals/RetroactiveConfirmModal.jsx`).
 */
@Composable
fun RetroactiveConfirmModal(
    med: Medication,
    hora: String,
    dateIso: String,
    userRole: String,
    onConfirm: (reason: String) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var selectedReason by remember { mutableStateOf("Tomei, mas esqueci de marcar no app") }
    var customReason by remember { mutableStateOf("") }

    val reasons = listOf(
        "Tomei, mas esqueci de marcar no app",
        "Estava sem celular no momento",
        "Confirmado pelo familiar / cuidador"
    )

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
                .padding(22.dp)
        ) {
            Text("🕐 Confirmação Retroativa", color = MediCareColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Text("${med.nome} (${med.dosagem})", color = tokens.txt, fontSize = 19.sp, fontWeight = FontWeight.Black)
            Text("Dia ${dateIso.split("-").reversed().joinToString("/")} às $hora", color = tokens.sub, fontSize = 13.sp)

            if (userRole == "paciente") {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "🔒 Perfil Paciente Supervisionado: permitido apenas para doses das últimas 24h.",
                    color = MediCareColors.Amber,
                    fontSize = 11.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text("Motivo do registro retroativo:", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            reasons.forEach { r ->
                val sel = selectedReason == r && customReason.isBlank()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (sel) MediCareColors.Amber.copy(alpha = 0.16f) else tokens.bg2)
                        .border(1.dp, if (sel) MediCareColors.Amber else tokens.bdr, RoundedCornerShape(10.dp))
                        .clickable {
                            selectedReason = r
                            customReason = ""
                        }
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(if (sel) "●" else "○", color = if (sel) MediCareColors.Amber else tokens.muted)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(r, color = tokens.txt, fontSize = 13.sp)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = customReason,
                onValueChange = { customReason = it },
                label = { Text("Outro motivo (opcional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                    Text("Cancelar", color = tokens.sub)
                }
                Button(
                    onClick = {
                        onConfirm(customReason.takeIf { it.isNotBlank() } ?: selectedReason)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("✓ Confirmar", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * Tela do Assistente de Saúde Completa (`src/screens/AIScreen.jsx` — 5 subviews: main, meds, attention, stock, consult, chat).
 */
@Composable
fun PatientAiScreen(
    state: PatientUiState,
    onSendQuestion: (String) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val context = LocalContext.current
    var view by remember { mutableStateOf("main") } // main, meds, attention, stock, consult, chat
    var questionInput by remember { mutableStateOf("") }

    BackHandler(enabled = view != "main") {
        view = "main"
    }

    val pendingDoses = remember(state.dailyDoses) {
        state.dailyDoses.filter { it.status != DoseStatus.CONFIRMED }
    }
    val lateDoses = remember(state.dailyDoses) {
        state.dailyDoses.filter { it.status == DoseStatus.LATE || it.status == DoseStatus.MISSED }
    }
    val lowStockMeds = remember(state.medications) {
        state.medications.filter { it.ativo && it.quantidade <= 5 }
    }

    val isAllGood = lateDoses.isEmpty() && lowStockMeds.isEmpty()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(20.dp)
    ) {
        if (view != "main") {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(tokens.bg2)
                    .clickable { view = "main" }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("← Voltar ao Assistente", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(14.dp))
        }

        when (view) {
            "main" -> {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    // Header
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(
                                    Brush.linearGradient(listOf(MediCareColors.Blue, MediCareColors.Purple))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🩺", fontSize = 24.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Assistente de Saúde",
                                color = tokens.txt,
                                fontSize = (22 * tokens.fontScale).sp,
                                fontWeight = FontWeight.Black
                            )
                            Text("Seu guia simples e seguro", color = tokens.sub, fontSize = 14.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Card "Como estou hoje?"
                    val statusColor = if (isAllGood) MediCareColors.Green else MediCareColors.Amber
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(statusColor.copy(alpha = 0.12f))
                            .border(2.dp, statusColor.copy(alpha = 0.45f), RoundedCornerShape(22.dp))
                            .padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(if (isAllGood) "✅" else "⚠️", fontSize = 28.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Como estou hoje?", color = tokens.txt, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = when {
                                lateDoses.isNotEmpty() -> "Você tem ${lateDoses.size} dose(s) atrasada(s) hoje. Verifique seus horários."
                                lowStockMeds.isNotEmpty() -> "Seus horários estão em dia, mas ${lowStockMeds.size} medicamento(s) estão acabando."
                                else -> "Tudo em ordem! Você está seguindo seu tratamento direitinho hoje."
                            },
                            color = tokens.txt,
                            fontSize = 15.sp
                        )
                        if (pendingDoses.isNotEmpty()) {
                            val next = pendingDoses.first()
                            Spacer(modifier = Modifier.height(12.dp))
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(tokens.bg1)
                                    .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                                    .padding(12.dp)
                            ) {
                                Text("PRÓXIMA DOSE HOJE:", color = tokens.muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text(
                                    text = "⏰ ${next.hora} — ${next.nome} (${next.dosagem})",
                                    color = MediCareColors.Blue,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))
                    Text("O que você gostaria de ver?", color = tokens.sub, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))

                    // Grid 2x2 BigAction
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AiBigActionCard(
                            icon = "💊",
                            title = "Explicar meus medicamentos",
                            subtitle = "Para que servem e cuidados",
                            color = MediCareColors.Blue,
                            modifier = Modifier.weight(1f)
                        ) { view = "meds" }

                        AiBigActionCard(
                            icon = "⚠️",
                            title = "O que merece atenção?",
                            subtitle = "Atrasos e esquecimentos",
                            color = MediCareColors.Amber,
                            modifier = Modifier.weight(1f)
                        ) { view = "attention" }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AiBigActionCard(
                            icon = "📦",
                            title = "Meu estoque",
                            subtitle = "Remédios acabando",
                            color = MediCareColors.Purple,
                            modifier = Modifier.weight(1f)
                        ) { view = "stock" }

                        AiBigActionCard(
                            icon = "🩺",
                            title = "Preparar consulta",
                            subtitle = "Resumo para o médico",
                            color = MediCareColors.Green,
                            modifier = Modifier.weight(1f)
                        ) { view = "consult" }
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = { view = "chat" },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth().height(54.dp)
                    ) {
                        Text("💬 Falar com o Assistente", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                    }

                    Spacer(modifier = Modifier.height(18.dp))
                    Text("Pergunte ao Assistente", color = tokens.sub, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    listOf(
                        "Para que servem os meus medicamentos atuais?",
                        "Como está o meu acompanhamento esta semana?",
                        "Algum dos meus remédios precisa de atenção especial?"
                    ).forEach { prompt ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(tokens.bg1)
                                .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                                .clickable {
                                    onSendQuestion(prompt)
                                    view = "chat"
                                }
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("💬 $prompt", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text("›", color = tokens.muted, fontSize = 18.sp)
                        }
                    }
                }
            }

            "meds" -> {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("💊 Meus Medicamentos", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Text("Toque em um medicamento para receber uma explicação simples:", color = tokens.sub, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    state.medications.filter { it.ativo }.forEach { m ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(tokens.bg1)
                                .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                                .clickable {
                                    onSendQuestion("Explique de forma bem simples para um paciente leigo para que serve o medicamento ${m.nome} (${m.dosagem}) e quais os cuidados básicos.")
                                    view = "chat"
                                }
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(m.nome, color = tokens.txt, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                                Text("${m.dosagem} · ${m.unidade}", color = tokens.sub, fontSize = 13.sp)
                            }
                            Text("Explicar →", color = MediCareColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            "attention" -> {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("⚠️ O que merece atenção?", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(12.dp))
                    if (lateDoses.isEmpty() && lowStockMeds.isEmpty()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(MediCareColors.Green.copy(alpha = 0.14f))
                                .border(1.dp, MediCareColors.Green, RoundedCornerShape(18.dp))
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("✅", fontSize = 36.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Tudo certo!", color = MediCareColors.Green, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Não há atrasos nem medicamentos com estoque crítico no momento.", color = tokens.sub, fontSize = 13.sp, textAlign = TextAlign.Center)
                        }
                    } else {
                        if (lateDoses.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 10.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(MediCareColors.Red.copy(alpha = 0.12f))
                                    .border(1.dp, MediCareColors.Red, RoundedCornerShape(16.dp))
                                    .padding(16.dp)
                            ) {
                                Text("⏰ Doses em atraso hoje (${lateDoses.size})", color = MediCareColors.Red, fontWeight = FontWeight.ExtraBold)
                                lateDoses.forEach { d ->
                                    Text("• ${d.nome} (${d.dosagem}) — programada para ${d.hora}", color = tokens.txt, fontSize = 13.sp)
                                }
                            }
                        }
                        if (lowStockMeds.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(MediCareColors.Amber.copy(alpha = 0.12f))
                                    .border(1.dp, MediCareColors.Amber, RoundedCornerShape(16.dp))
                                    .padding(16.dp)
                            ) {
                                Text("📦 Estoque Baixo (${lowStockMeds.size})", color = MediCareColors.Amber, fontWeight = FontWeight.ExtraBold)
                                lowStockMeds.forEach { m ->
                                    Text("• ${m.nome}: restam apenas ${m.quantidade} ${m.unidade}(s)", color = tokens.txt, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            }

            "stock" -> {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("📦 Situação do Meu Estoque", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(12.dp))
                    state.stockForecasts.forEach { f ->
                        val alertColor = when {
                            f.daysRemaining <= 5 -> MediCareColors.Red
                            f.daysRemaining <= 10 -> MediCareColors.Amber
                            else -> MediCareColors.Green
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(tokens.bg1)
                                .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${f.nome} (${f.dosagem})", color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                Text("Estoque: ${f.quantidade} un · Uso: ${f.dosesPerDay}/dia", color = tokens.sub, fontSize = 12.sp)
                            }
                            Text(
                                text = "Dura ~${f.daysRemaining}d",
                                color = alertColor,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }
            }

            "consult" -> {
                val activeMeds = state.medications.filter { it.ativo }
                val doneToday = state.dailyDoses.count { it.status == DoseStatus.CONFIRMED }
                val totalToday = state.dailyDoses.size
                val summaryText = buildString {
                    appendLine("🩺 RESUMO PARA CONSULTA MÉDICA — MEDICARE")
                    appendLine("Paciente: ${state.user?.nome ?: "Paciente"}")
                    appendLine("Tipo sanguíneo: ${state.user?.bloodType ?: "O+"}")
                    appendLine()
                    appendLine("💊 MEDICAMENTOS EM USO (${activeMeds.size}):")
                    activeMeds.forEach { m ->
                        appendLine("• ${m.nome} ${m.dosagem} (${m.horarios.ifEmpty { listOf("SOS") }.joinToString(", ")})")
                    }
                    appendLine()
                    appendLine("📊 ADESÃO HOJE: $doneToday de $totalToday doses confirmadas.")
                    if (state.allergies.isNotEmpty()) {
                        appendLine("⚠️ ALERGIAS: ${state.allergies.joinToString(", ") { it.name }}")
                    }
                }

                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("🩺 Preparar Consulta", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Text("Apresente ou compartilhe este resumo com seu médico:", color = tokens.sub, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(tokens.bg1)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                            .padding(18.dp)
                    ) {
                        Text(summaryText, color = tokens.txt, fontSize = 13.sp, lineHeight = 20.sp)
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = {
                            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, summaryText)
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Compartilhar Resumo Médico"))
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Text("📤 Compartilhar Resumo", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }

            "chat" -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        state.aiMessages.forEach { (role, msg) ->
                            val isUser = role == "user"
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                            ) {
                                Box(
                                    modifier = Modifier
                                        .widthIn(max = 300.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(if (isUser) MediCareColors.Blue else tokens.bg1)
                                        .border(1.dp, if (isUser) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(16.dp))
                                        .padding(14.dp)
                                ) {
                                    Text(
                                        text = msg,
                                        color = if (isUser) Color.White else tokens.txt,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                        if (state.aiLoading) {
                            Text("Assistente analisando...", color = tokens.muted, fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = questionInput,
                            onValueChange = { questionInput = it },
                            placeholder = { Text("Escreva sua dúvida...") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Button(
                            onClick = {
                                if (questionInput.isNotBlank()) {
                                    onSendQuestion(questionInput)
                                    questionInput = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(52.dp)
                        ) {
                            Text("Enviar", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AiBigActionCard(
    icon: String,
    title: String,
    subtitle: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(tokens.bg1)
            .border(1.5.dp, color.copy(alpha = 0.35f), RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(16.dp)
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(color.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center
        ) {
            Text(icon, fontSize = 22.sp)
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(title, color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(modifier = Modifier.height(2.dp))
        Text(subtitle, color = tokens.sub, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
