package br.com.medicare.paciente.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.ui.components.*
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors
import br.com.medicare.paciente.ui.viewmodel.PatientUiState
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/**
 * 1. Tela de Autenticação (`src/screens/AuthScreen.jsx`).
 */
@Composable
fun PatientAuthScreen(
    isRemoteConfigured: Boolean,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String, String) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var isRegisterMode by remember { mutableStateOf(false) }
    var nome by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("maria.helena@medicare.br") }
    var password by remember { mutableStateOf("123456") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(26.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(26.dp))
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(MediCareColors.Blue, MediCareColors.Purple))),
                contentAlignment = Alignment.Center
            ) {
                Text("💊", fontSize = 32.sp)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "MediCare Paciente",
                color = tokens.txt,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "Seus medicamentos, lembretes e saúde sempre com você",
                color = tokens.sub,
                fontSize = 13.sp
            )

            Spacer(modifier = Modifier.height(22.dp))

            if (isRegisterMode) {
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Seu nome completo") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("E-mail") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Senha") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    if (isRegisterMode) onRegister(nome, email, password)
                    else onLogin(email, password)
                },
                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(54.dp)
            ) {
                Text(
                    text = if (isRegisterMode) "Criar Conta" else "Entrar no MediCare",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            TextButton(onClick = { isRegisterMode = !isRegisterMode }) {
                Text(
                    text = if (isRegisterMode) "Já tenho conta · Fazer login" else "Não tem conta? Cadastre-se",
                    color = MediCareColors.Blue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/**
 * 2. Dashboard Principal do Paciente (`src/screens/HomeScreen.jsx` + `src/components/Dashboard.jsx`).
 */
@Composable
fun PatientHomeScreen(
    state: PatientUiState,
    onSelectDose: (ScheduledDose) -> Unit,
    onConfirmDoseDirect: (ScheduledDose) -> Unit,
    onSnoozeDose: (ScheduledDose) -> Unit,
    onUndoDose: (ScheduledDose) -> Unit,
    onOpenStats: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val today = remember { LocalDate.now() }
    val localePt = remember { Locale("pt", "BR") }
    val dateHeader = remember(today) {
        val wd = today.dayOfWeek.getDisplayName(TextStyle.FULL, localePt)
        val month = today.month.getDisplayName(TextStyle.FULL, localePt)
        "$wd, ${today.dayOfMonth} de $month"
    }

    var earlyDoseWarning by remember { mutableStateOf<Pair<ScheduledDose, Long>?>(null) }
    var undoConfirmTarget by remember { mutableStateOf<ScheduledDose?>(null) }

    val nextDose = remember(state.dailyDoses) {
        state.dailyDoses.firstOrNull { it.status != DoseStatus.CONFIRMED }
    }
    val criticalMeds = remember(state.medications) {
        state.medications.filter { it.ativo && it.quantidade <= 5 }
    }

    fun handleConfirmAttempt(dose: ScheduledDose) {
        val minsTill = DoseCalculator.minutesTill(dose.hora)
        if (minsTill > 60) {
            earlyDoseWarning = dose to minsTill
        } else {
            onConfirmDoseDirect(dose)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        // Cabeçalho com Data, Saudação e Acesso à Tela "Saúde em números"
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = dateHeader.replaceFirstChar { it.uppercase() },
                    color = tokens.muted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "${DoseCalculator.greetingFor(state.user?.nome)} 👋",
                    color = tokens.txt,
                    fontSize = (24 * tokens.fontScale).sp,
                    fontWeight = FontWeight.Black
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(12.dp))
                    .clickable { onOpenStats() }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("📊 Saúde", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            }
        }

        // Alerta de Estoque Crítico
        if (criticalMeds.isNotEmpty()) {
            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MediCareColors.Red.copy(alpha = 0.14f))
                    .border(1.dp, MediCareColors.Red.copy(alpha = 0.45f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🚨", fontSize = 20.sp)
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Estoque crítico",
                        color = MediCareColors.Red,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = criticalMeds.joinToString(", ") { "${it.nome} (${it.quantidade} restantes)" },
                        color = tokens.sub,
                        fontSize = 12.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // NextDoseHero
        NextDoseHero(
            dose = nextDose,
            onConfirm = { handleConfirmAttempt(it) },
            onRemind = onSnoozeDose
        )

        Spacer(modifier = Modifier.height(16.dp))

        // DayProgress
        DayProgress(doses = state.dailyDoses)

        Spacer(modifier = Modifier.height(16.dp))

        // Timeline vertical do dia
        DailyTimeline(
            doses = state.dailyDoses,
            onSelectDose = onSelectDose,
            onUndoRequest = { undoConfirmTarget = it }
        )
    }

    earlyDoseWarning?.let { (dose, minsEarly) ->
        TimeWarningModal(
            dose = dose,
            minutesEarly = minsEarly,
            onConfirmAnyway = {
                onConfirmDoseDirect(dose)
                earlyDoseWarning = null
            },
            onDismiss = { earlyDoseWarning = null }
        )
    }

    undoConfirmTarget?.let { dose ->
        UndoConfirmModal(
            dose = dose,
            onConfirmUndo = {
                onUndoDose(dose)
                undoConfirmTarget = null
            },
            onDismiss = { undoConfirmTarget = null }
        )
    }
}

/**
 * 3. Tela de Medicamentos Completa (`src/screens/MedsScreen.jsx`).
 * 3 Abas: 💊 Contínuos, 📅 Temporários, 🚨 SOS + Wizard de 3 passos + Detalhe + SOSQuickLog + StockMovement + RepeatTreatment.
 */
@Composable
fun PatientMedsScreen(
    state: PatientUiState,
    onSaveMedication: (Medication) -> Unit,
    onRepeatTreatment: (Medication, Int) -> Unit,
    onDeleteMedication: (Medication) -> Unit,
    onRegisterSosUse: (Medication, String, Int, String) -> Unit,
    onRecordStockMovement: (Medication, String, Int, Double?, String?, String?, String?, String?) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var activeTab by remember { mutableStateOf("continuous") }

    var showWizardModal by remember { mutableStateOf(false) }
    var editingMed by remember { mutableStateOf<Medication?>(null) }
    var detailMed by remember { mutableStateOf<Medication?>(null) }
    var sosModalMed by remember { mutableStateOf<Medication?>(null) }
    var stockModalState by remember { mutableStateOf<Triple<Medication, Int?, ((Int) -> Unit)?>?>(null) }
    var repeatTarget by remember { mutableStateOf<Medication?>(null) }
    var deleteTarget by remember { mutableStateOf<Medication?>(null) }

    val continuousMeds = remember(state.medications) {
        state.medications.filter { it.ativo && (it.treatmentType == "continuous" || it.treatmentType.isBlank()) }
    }
    val temporaryMeds = remember(state.medications) {
        state.medications.filter { it.treatmentType == "temporary" }
    }
    val sosMeds = remember(state.medications) {
        state.medications.filter { it.ativo && it.treatmentType == "sos" }
    }

    val currentList = when (activeTab) {
        "temporary" -> temporaryMeds
        "sos" -> sosMeds
        else -> continuousMeds
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        // Header + Botão "+ Novo"
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Meus Medicamentos",
                    color = tokens.txt,
                    fontSize = (22 * tokens.fontScale).sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "${state.medications.count { it.ativo }} medicamento(s) ativo(s)",
                    color = tokens.muted,
                    fontSize = 13.sp
                )
            }
            Button(
                onClick = {
                    editingMed = null
                    showWizardModal = true
                },
                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("＋ Novo", color = Color.White, fontWeight = FontWeight.ExtraBold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // 3 Abas: Contínuos / Temporários / SOS
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf(
                Triple("continuous", "💊 Contínuos", continuousMeds.size),
                Triple("temporary", "📅 Temporários", temporaryMeds.size),
                Triple("sos", "🚨 SOS", sosMeds.size)
            ).forEach { (id, label, count) ->
                val sel = activeTab == id
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (sel) MediCareColors.Blue else Color.Transparent)
                        .clickable { activeTab = id }
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = label,
                        color = if (sel) Color.White else tokens.muted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "$count",
                        color = if (sel) Color.White.copy(alpha = 0.85f) else tokens.sub,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (currentList.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("💊", fontSize = 40.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Nenhum medicamento nesta categoria", color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text("Toque em \"＋ Novo\" para adicionar.", color = tokens.muted, fontSize = 13.sp)
            }
        } else {
            val todayIso = LocalDate.now().toString()
            currentList.forEach { m ->
                val pillColor = MediCareColors.parseHex(m.cor)
                val tType = TreatmentType.fromCode(m.treatmentType)
                val progress = DoseCalculator.getTreatmentProgress(m)
                val isFinished = m.status == "finalizado" || (progress?.isExpired == true)
                val todayDosesDone = state.history.count {
                    it.medId == m.id && it.createdAt.startsWith(todayIso) && it.status == "confirmed"
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                        .clickable { detailMed = m }
                ) {
                    // Faixa vertical colorida idêntica ao MedsScreen.jsx
                    Box(
                        modifier = Modifier
                            .width(6.dp)
                            .heightIn(min = 120.dp)
                            .background(pillColor)
                    )

                    Column(modifier = Modifier.weight(1f).padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(13.dp))
                                        .background(pillColor.copy(alpha = 0.18f))
                                        .border(1.5.dp, pillColor.copy(alpha = 0.45f), RoundedCornerShape(13.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("💊", fontSize = 20.sp)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(
                                            text = m.nome,
                                            color = tokens.txt,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        TreatmentTypeBadge(tType, if (isFinished) "finalizado" else m.status)
                                    }
                                    Text(
                                        text = "${m.dosagem} · ${m.unidade} · ${
                                            if (tType == TreatmentType.SOS) "Uso sob demanda"
                                            else m.horarios.joinToString(", ")
                                        }",
                                        color = tokens.muted,
                                        fontSize = 12.sp
                                    )
                                    if (!m.observacoes.isNullOrBlank()) {
                                        Text("📝 ${m.observacoes}", color = tokens.sub, fontSize = 11.sp)
                                    }
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (tType != TreatmentType.SOS && !isFinished) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(tokens.bg2)
                                            .padding(horizontal = 8.dp, vertical = 4.dp)
                                    ) {
                                        Text(
                                            text = "Hoje: $todayDosesDone/${m.horarios.size}",
                                            color = if (todayDosesDone == m.horarios.size) MediCareColors.Green else tokens.sub,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(tokens.bg2)
                                        .clickable {
                                            editingMed = m
                                            showWizardModal = true
                                        }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) { Text("✏️", fontSize = 12.sp) }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MediCareColors.Red.copy(alpha = 0.14f))
                                        .clickable { deleteTarget = m }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) { Text("🗑️", fontSize = 12.sp) }
                            }
                        }

                        if (tType == TreatmentType.TEMPORARY) {
                            TreatmentProgressBar(m)
                            if (isFinished) {
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = { repeatTarget = m },
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("🔁 Repetir tratamento", color = MediCareColors.Amber, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Estoque disponível",
                                color = tokens.muted,
                                fontSize = 11.sp
                            )
                            Text(
                                text = "${m.quantidade} ${m.unidade}s ${if (m.quantidade <= 5) "🚨" else ""}",
                                color = when {
                                    m.quantidade <= 5 -> MediCareColors.Red
                                    m.quantidade <= 10 -> MediCareColors.Amber
                                    else -> MediCareColors.Green
                                },
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        StockBar(qty = m.quantidade)

                        if (tType == TreatmentType.SOS) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (todayDosesDone > 0) "Tomado $todayDosesDone vez(es) hoje" else "Nenhum uso hoje",
                                    color = tokens.muted,
                                    fontSize = 12.sp
                                )
                                Button(
                                    onClick = { sosModalMed = m },
                                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("＋ Tomar SOS", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Wizard de 3 passos
    if (showWizardModal) {
        MedModalWizard(
            userId = state.user?.id ?: "user-local",
            existingMed = editingMed,
            onSave = onSaveMedication,
            onRequestStockMovement = { med, targetQty, callback ->
                stockModalState = Triple(med, targetQty, callback)
            },
            onDismiss = { showWizardModal = false }
        )
    }

    // Detalhe do medicamento
    detailMed?.let { med ->
        MedDetailDialog(
            med = med,
            history = state.history,
            onEdit = {
                detailMed = null
                editingMed = med
                showWizardModal = true
            },
            onAdjustStock = {
                detailMed = null
                stockModalState = Triple(med, null, null)
            },
            onDismiss = { detailMed = null }
        )
    }

    // SOS Quick Log Modal
    sosModalMed?.let { med ->
        SOSQuickLogModal(
            med = med,
            onConfirm = { hora, qty, reason ->
                onRegisterSosUse(med, hora, qty, reason)
            },
            onDismiss = { sosModalMed = null }
        )
    }

    // Stock Movement Modal
    stockModalState?.let { (med, targetQty, callback) ->
        StockMovementModal(
            med = med,
            initialTargetQuantity = targetQty,
            onConfirmMovement = { movType, newQty, price, location, batch, expiry, notes ->
                onRecordStockMovement(med, movType, newQty, price, location, batch, expiry, notes)
                callback?.invoke(newQty)
                stockModalState = null
            },
            onDismiss = { stockModalState = null }
        )
    }

    // Repeat Treatment Modal
    repeatTarget?.let { med ->
        var daysText by remember { mutableStateOf((med.treatmentDays ?: 7).toString()) }
        Dialog(onDismissRequest = { repeatTarget = null }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                    .padding(22.dp)
            ) {
                Text("🔁 Repetir Tratamento", color = MediCareColors.Amber, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text(med.nome, color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = daysText,
                    onValueChange = { daysText = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Nova duração (dias)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { repeatTarget = null }, modifier = Modifier.weight(1f)) {
                        Text("Cancelar", color = tokens.sub)
                    }
                    Button(
                        onClick = {
                            onRepeatTreatment(med, daysText.toIntOrNull() ?: 7)
                            repeatTarget = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Reiniciar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // Confirm Delete Modal
    deleteTarget?.let { med ->
        Dialog(onDismissRequest = { deleteTarget = null }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("🗑️", fontSize = 38.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Excluir ${med.nome}?", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("Os alarmes programados para este medicamento serão cancelados.", color = tokens.sub, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { deleteTarget = null }, modifier = Modifier.weight(1f)) {
                        Text("Cancelar", color = tokens.sub)
                    }
                    Button(
                        onClick = {
                            onDeleteMedication(med)
                            deleteTarget = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Excluir", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * 4. Tela "Saúde em Números" (`src/screens/StatsScreen.jsx`).
 */
@Composable
fun PatientStatsScreen(
    state: PatientUiState,
    onBackToHome: () -> Unit = {}
) {
    val tokens = LocalMediCareTokens.current
    val doneToday = state.dailyDoses.count { it.status == DoseStatus.CONFIRMED }
    val totalToday = state.dailyDoses.size
    val pendingToday = (totalToday - doneToday).coerceAtLeast(0)
    val adhesion = if (totalToday > 0) ((doneToday * 100f) / totalToday).toInt() else 100
    val criticalCount = state.medications.count { it.ativo && it.quantidade <= 5 }

    val continuousCount = state.medications.count { it.ativo && it.treatmentType == "continuous" }
    val tempActiveCount = state.medications.count { it.ativo && it.treatmentType == "temporary" && it.status != "finalizado" }
    val tempFinishedCount = state.medications.count { it.treatmentType == "temporary" && it.status == "finalizado" }
    val sosUsedCount = state.history.count { rec ->
        state.medications.find { it.id == rec.medId }?.treatmentType == "sos"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Saúde em números", color = tokens.txt, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("Resumo de adesão e acompanhamento", color = tokens.sub, fontSize = 13.sp)
            }
            TextButton(onClick = onBackToHome) {
                Text("← Início", color = MediCareColors.Blue, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Hero de Adesão
        val ringColor = when {
            adhesion >= 80 -> MediCareColors.Green
            adhesion >= 60 -> MediCareColors.Amber
            else -> MediCareColors.Red
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(20.dp))
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AdhesionRing(percent = adhesion, size = 96.dp, strokeWidth = 10.dp, color = ringColor)
            Spacer(modifier = Modifier.width(18.dp))
            Column {
                Text("Taxa de adesão", color = tokens.txt, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                Text("Baseada nas doses confirmadas", color = tokens.sub, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(99.dp))
                        .background(ringColor.copy(alpha = 0.16f))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = when {
                            adhesion >= 80 -> "🌟 Excelente"
                            adhesion >= 60 -> "⚡ Bom progresso"
                            else -> "💪 Vamos melhorar"
                        },
                        color = ringColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Grid 2x2
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCardBox("✓", "Hoje: tomadas", "$doneToday/$totalToday", MediCareColors.Green, Modifier.weight(1f))
            StatCardBox("⏰", "Hoje: pendentes", "$pendingToday", MediCareColors.Amber, Modifier.weight(1f))
        }
        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCardBox("💊", "Medicamentos ativos", "${state.medications.count { it.ativo }}", MediCareColors.Blue, Modifier.weight(1f))
            StatCardBox("🚨", "Estoque crítico", "$criticalCount", if (criticalCount > 0) MediCareColors.Red else MediCareColors.Green, Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Resumo de Tratamentos (4 cards)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                .padding(16.dp)
        ) {
            Text("💊 Resumo de Tratamentos", color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCardBox("🟢", "Contínuos", "$continuousCount", MediCareColors.Green, Modifier.weight(1f))
                StatCardBox("🟡", "Temporários", "$tempActiveCount", MediCareColors.Amber, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCardBox("✓", "Concluídos", "$tempFinishedCount", Color(0xFF10B981), Modifier.weight(1f))
                StatCardBox("🔵", "SOS no mês", "$sosUsedCount", MediCareColors.Blue, Modifier.weight(1f))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Controle de Estoque
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                .padding(16.dp)
        ) {
            Text("📦 Controle de estoque", color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(modifier = Modifier.height(10.dp))
            state.medications.filter { it.ativo }.forEach { m ->
                Column(modifier = Modifier.padding(bottom = 10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${m.nome} (${m.dosagem})", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text("${m.quantidade} ${m.unidade}s", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    StockBar(qty = m.quantidade)
                }
            }
        }
    }
}

@Composable
private fun StatCardBox(icon: String, label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    val tokens = LocalMediCareTokens.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(tokens.bg1)
            .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Text(icon, fontSize = 20.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(label, color = tokens.muted, fontSize = 11.sp)
    }
}
