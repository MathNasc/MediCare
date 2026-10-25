package br.com.medicare.paciente.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.ui.components.*
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors
import br.com.medicare.paciente.ui.viewmodel.MediCareViewModel
import br.com.medicare.paciente.ui.viewmodel.PatientUiState
import java.time.LocalDate
import kotlin.math.roundToInt

// ─── 1. AUTH SCREEN (Equivalente a src/components/AuthScreen.jsx) ─────────────
@Composable
fun PatientAuthScreen(
    isRemoteConfigured: Boolean,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String, String) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var isRegisterMode by remember { mutableStateOf(false) }
    var nome by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 400.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!isRemoteConfigured) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MediCareColors.Blue.copy(alpha = 0.12f))
                        .border(1.dp, MediCareColors.Blue.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(text = "💾", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Modo Offline / Local ativo",
                            color = Color(0xFF60A5FA),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp
                        )
                        Text(
                            text = "Seus medicamentos e alarmes ficam salvos com segurança no aparelho e sincronizam quando o banco remoto estiver configurado.",
                            color = Color(0xFF93C5FD),
                            fontSize = 12.sp
                        )
                    }
                }
                Spacer(modifier = Modifier.height(18.dp))
            }

            // Logo MediCare
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF3B82F6), Color(0xFF6366F1))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "💊", fontSize = 36.sp)
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "MediCare",
                color = tokens.txt,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "Controle inteligente de medicamentos e doses",
                color = tokens.sub,
                fontSize = 14.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                    .padding(20.dp)
            ) {
                if (isRegisterMode) {
                    OutlinedTextField(
                        value = nome,
                        onValueChange = { nome = it },
                        label = { Text("Seu nome") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("E-mail") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Senha") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = {
                        if (isRegisterMode) onRegister(nome, email, password)
                        else onLogin(email, password)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text(
                        text = if (isRegisterMode) "Criar minha conta" else "Entrar no MediCare",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                TextButton(
                    onClick = { isRegisterMode = !isRegisterMode },
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text(
                        text = if (isRegisterMode) "Já tem conta? Entrar" else "Não tem conta? Cadastre-se",
                        color = MediCareColors.Blue
                    )
                }
            }
        }
    }
}

// ─── 2. HOME SCREEN (Equivalente a src/screens/HomeScreen.jsx) ────────────────
@Composable
fun PatientHomeScreen(
    state: PatientUiState,
    onDoseClick: (ScheduledDose) -> Unit,
    onRegisterSos: (Medication) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var filter by remember { mutableStateOf("all") } // all, pending, confirmed

    val totalDoses = state.dailyDoses.size
    val confirmedDoses = state.dailyDoses.count { it.status == DoseStatus.CONFIRMED }
    val pendingDoses = totalDoses - confirmedDoses
    val adhesionPercent = if (totalDoses > 0) {
        ((confirmedDoses.toDouble() / totalDoses) * 100).roundToInt()
    } else 100

    val filteredDoses = remember(state.dailyDoses, filter) {
        when (filter) {
            "pending" -> state.dailyDoses.filter { it.status != DoseStatus.CONFIRMED }
            "confirmed" -> state.dailyDoses.filter { it.status == DoseStatus.CONFIRMED }
            else -> state.dailyDoses
        }
    }

    val sosMeds = remember(state.medications) {
        state.medications.filter { it.ativo && TreatmentType.fromCode(it.treatmentType) == TreatmentType.SOS }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Cabeçalho com saudação e indicador de fila offline
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = DoseCalculator.greetingFor(state.user?.nome),
                        color = tokens.txt,
                        fontSize = (22 * tokens.fontScale).sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "Acompanhe suas doses programadas de hoje",
                        color = tokens.sub,
                        fontSize = (13 * tokens.fontScale).sp
                    )
                }
                if (state.pendingSyncCount > 0) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(MediCareColors.Amber.copy(alpha = 0.18f))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "🔄 ${state.pendingSyncCount} pendente(s)",
                            color = MediCareColors.Amber,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Card de Resumo e Anel de Adesão Diária (Dashboard.jsx)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                    .padding(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AdhesionRing(percent = adhesionPercent)
                Spacer(modifier = Modifier.width(18.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Progresso de Hoje",
                        color = tokens.txt,
                        fontSize = (17 * tokens.fontScale).sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "$confirmedDoses de $totalDoses doses confirmadas",
                        color = tokens.sub,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MediCareColors.Green.copy(alpha = 0.14f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "✓ $confirmedDoses Tomadas",
                                color = MediCareColors.Green,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MediCareColors.Amber.copy(alpha = 0.14f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "⏳ $pendingDoses Pendentes",
                                color = MediCareColors.Amber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // Filtros rápidos
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "all" to "Todas ($totalDoses)",
                    "pending" to "Pendentes ($pendingDoses)",
                    "confirmed" to "Tomadas ($confirmedDoses)"
                ).forEach { (key, label) ->
                    val active = filter == key
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (active) MediCareColors.Blue else tokens.bg1)
                            .border(1.dp, if (active) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(10.dp))
                            .clickable { filter = key }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = label,
                            color = if (active) Color.White else tokens.sub,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Lista de doses do dia
        items(filteredDoses, key = { it.id }) { dose ->
            DoseCard(dose = dose, onClick = { onDoseClick(dose) })
        }

        // Seção rápida para medicamentos SOS (Se Necessário)
        if (sosMeds.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "🔵 Uso Sob Demanda (SOS)",
                    color = tokens.txt,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
            items(sosMeds, key = { it.id }) { med ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = med.nome,
                            color = tokens.txt,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "${med.dosagem} · Estoque: ${med.quantidade} ${med.unidade}(s)",
                            color = tokens.sub,
                            fontSize = 12.sp
                        )
                    }
                    Button(
                        onClick = { onRegisterSos(med) },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(text = "Registrar uso", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ─── 3. MEDS SCREEN (Equivalente a src/screens/MedsScreen.jsx) ────────────────
@Composable
fun PatientMedsScreen(
    state: PatientUiState,
    onSaveMedication: (String?, String, String, String, String, Int, List<String>, String, Int?, String?) -> Unit,
    onDeleteMedication: (Medication) -> Unit,
    onAdjustStock: (Medication, Int, String, String?) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var showAddDialog by remember { mutableStateOf(false) }
    var editingMed by remember { mutableStateOf<Medication?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
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
                        text = "${state.medications.size} cadastrado(s) com alarmes sincronizados",
                        color = tokens.sub,
                        fontSize = 13.sp
                    )
                }
                Button(
                    onClick = {
                        editingMed = null
                        showAddDialog = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(text = "+ Novo", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }
        }

        items(state.medications, key = { it.id }) { med ->
            val tType = TreatmentType.fromCode(med.treatmentType)
            val progress = DoseCalculator.getTreatmentProgress(med)
            val lowStock = med.quantidade <= med.avisoEstoque

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = med.nome,
                            color = tokens.txt,
                            fontSize = (17 * tokens.fontScale).sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "${med.dosagem} · ${med.unidade}",
                            color = tokens.sub,
                            fontSize = 13.sp
                        )
                    }
                    TreatmentTypeBadge(type = tType)
                }

                Spacer(modifier = Modifier.height(10.dp))

                if (med.horarios.isNotEmpty() && tType != TreatmentType.SOS) {
                    Text(
                        text = "⏰ Horários: ${med.horarios.joinToString(", ")}",
                        color = tokens.sub,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                if (progress != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Dia ${progress.dayNumber} de ${progress.totalDays} (${progress.percent}%)",
                        color = MediCareColors.Amber,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    LinearProgressIndicator(
                        progress = { progress.percent / 100f },
                        color = MediCareColors.Amber,
                        trackColor = tokens.bg3,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .height(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (lowStock) "⚠️ Estoque baixo: ${med.quantidade} un." else "📦 Estoque: ${med.quantidade} un.",
                        color = if (lowStock) MediCareColors.Red else tokens.sub,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = {
                            onAdjustStock(med, med.quantidade + 30, "purchase", "Reposição rápida +30")
                        }) {
                            Text("+30 Estoque", color = MediCareColors.Green, fontSize = 12.sp)
                        }
                        TextButton(onClick = {
                            editingMed = med
                            showAddDialog = true
                        }) {
                            Text("Editar", color = MediCareColors.Blue, fontSize = 12.sp)
                        }
                        TextButton(onClick = { onDeleteMedication(med) }) {
                            Text("Excluir", color = MediCareColors.Red, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        MedicationFormDialog(
            initial = editingMed,
            onDismiss = { showAddDialog = false },
            onSave = { nome, dosagem, unidade, cor, qtd, horarios, tType, days, obs ->
                onSaveMedication(
                    editingMed?.id,
                    nome,
                    dosagem,
                    unidade,
                    cor,
                    qtd,
                    horarios,
                    tType,
                    days,
                    obs
                )
                showAddDialog = false
            }
        )
    }
}

@Composable
private fun MedicationFormDialog(
    initial: Medication?,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, Int, List<String>, String, Int?, String?) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var nome by remember { mutableStateOf(initial?.nome ?: "") }
    var dosagem by remember { mutableStateOf(initial?.dosagem ?: "") }
    var unidade by remember { mutableStateOf(initial?.unidade ?: "comprimido") }
    var horariosText by remember { mutableStateOf(initial?.horarios?.joinToString(", ") ?: "08:00, 20:00") }
    var quantidadeText by remember { mutableStateOf((initial?.quantidade ?: 30).toString()) }
    var treatmentType by remember { mutableStateOf(initial?.treatmentType ?: "continuous") }
    var treatmentDaysText by remember { mutableStateOf((initial?.treatmentDays ?: 7).toString()) }
    var observacoes by remember { mutableStateOf(initial?.observacoes ?: "") }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
                .padding(22.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = if (initial == null) "Novo Medicamento" else "Editar Medicamento",
                color = tokens.txt,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black
            )
            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = nome,
                onValueChange = { nome = it },
                label = { Text("Nome do medicamento") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(10.dp))

            OutlinedTextField(
                value = dosagem,
                onValueChange = { dosagem = it },
                label = { Text("Dosagem (ex: 50mg, 500mg)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(10.dp))

            // Seletor de tipo de tratamento
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TreatmentType.entries.forEach { t ->
                    val selected = treatmentType == t.code
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selected) Color(t.colorHex).copy(alpha = 0.2f) else tokens.bg2)
                            .border(1.dp, if (selected) Color(t.colorHex) else tokens.bdr, RoundedCornerShape(10.dp))
                            .clickable { treatmentType = t.code }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${t.icon} ${t.shortLabel}",
                            color = if (selected) Color(t.colorHex) else tokens.sub,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            if (treatmentType != "sos") {
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = horariosText,
                    onValueChange = { horariosText = it },
                    label = { Text("Horários separados por vírgula (ex: 08:00, 20:00)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            if (treatmentType == "temporary") {
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = treatmentDaysText,
                    onValueChange = { treatmentDaysText = it },
                    label = { Text("Duração em dias") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            OutlinedTextField(
                value = quantidadeText,
                onValueChange = { quantidadeText = it },
                label = { Text("Quantidade em estoque") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(10.dp))
            OutlinedTextField(
                value = observacoes,
                onValueChange = { observacoes = it },
                label = { Text("Instruções / Observações") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(18.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar", color = tokens.sub)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (nome.isNotBlank()) {
                            val horarios = horariosText.split(",")
                                .map { it.trim() }
                                .filter { it.matches(Regex("^\\d{2}:\\d{2}$")) }
                                .ifEmpty { listOf("08:00") }
                            onSave(
                                nome,
                                dosagem.ifBlank { "1 dose" },
                                unidade,
                                initial?.cor ?: "#3b82f6",
                                quantidadeText.toIntOrNull() ?: 30,
                                horarios,
                                treatmentType,
                                treatmentDaysText.toIntOrNull(),
                                observacoes.ifBlank { null }
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue)
                ) {
                    Text("Salvar", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─── 4. CALENDAR SCREEN (Equivalente a src/screens/CalendarScreen.jsx) ────────
@Composable
fun PatientCalendarScreen(
    state: PatientUiState,
    onAddEvent: (String, String, String, String?, String?) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var newEventTitle by remember { mutableStateOf("") }
    var newEventDate by remember { mutableStateOf(LocalDate.now().toString()) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Agenda e Histórico",
                color = tokens.txt,
                fontSize = (22 * tokens.fontScale).sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "Consultas, exames, reposições de estoque e histórico de doses",
                color = tokens.sub,
                fontSize = 13.sp
            )
        }

        // Card rápido para agendar consulta ou exame
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(16.dp)
            ) {
                Text(
                    text = "Agendar Consulta ou Exame",
                    color = tokens.txt,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = newEventTitle,
                    onValueChange = { newEventTitle = it },
                    label = { Text("Ex: Cardiologista Dr. Roberto") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Data: $newEventDate", color = tokens.sub, fontSize = 13.sp)
                    Button(
                        onClick = {
                            if (newEventTitle.isNotBlank()) {
                                onAddEvent(newEventTitle, "consulta", newEventDate, "09:00", null)
                                newEventTitle = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue)
                    ) {
                        Text("Adicionar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (state.healthEvents.isNotEmpty()) {
            item {
                Text(
                    text = "📅 Eventos Programados",
                    color = tokens.txt,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
            }
            items(state.healthEvents, key = { it.id }) { ev ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = if (ev.type == "estoque") "📦" else "🩺", fontSize = 22.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(text = ev.title, color = tokens.txt, fontWeight = FontWeight.Bold)
                        Text(text = "${ev.date} ${ev.time ?: ""} · ${ev.description ?: ""}", color = tokens.sub, fontSize = 12.sp)
                    }
                }
            }
        }

        item {
            Text(
                text = "🕒 Últimas Doses Confirmadas",
                color = tokens.txt,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 16.sp
            )
        }

        items(state.history.take(25), key = { it.id }) { rec ->
            val medName = state.medications.find { it.id == rec.medId }?.nome ?: "Medicamento"
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                    .padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(text = medName, color = tokens.txt, fontWeight = FontWeight.Bold)
                    Text(
                        text = "Horário: ${rec.hora} · Data: ${rec.createdAt.take(10)}",
                        color = tokens.sub,
                        fontSize = 12.sp
                    )
                }
                Text(
                    text = if (rec.status == "confirmed") "✓ Confirmada" else "Pendente",
                    color = if (rec.status == "confirmed") MediCareColors.Green else MediCareColors.Amber,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
            }
        }
    }
}

// ─── 5. STATS & STOCK SCREEN (Equivalente a StatsScreen.jsx + StockHistoryScreen.jsx)
@Composable
fun PatientStatsScreen(state: PatientUiState) {
    val tokens = LocalMediCareTokens.current

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Saúde e Previsão de Estoque",
                color = tokens.txt,
                fontSize = (22 * tokens.fontScale).sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "Projeção automática de término e histórico de reposições",
                color = tokens.sub,
                fontSize = 13.sp
            )
        }

        item {
            Text(
                text = "📦 Próxima Reposição Prevista",
                color = tokens.txt,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }

        items(state.stockForecasts, key = { it.medId }) { forecast ->
            val critical = forecast.daysRemaining <= 5
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(tokens.bg1)
                    .border(
                        1.dp,
                        if (critical) MediCareColors.Red.copy(alpha = 0.5f) else tokens.bdr,
                        RoundedCornerShape(16.dp)
                    )
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "${forecast.nome} (${forecast.dosagem})",
                        color = tokens.txt,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "Estoque: ${forecast.quantidade} un. · Consumo: ${forecast.dosesPerDay}/dia",
                        color = tokens.sub,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "Término previsto: ${forecast.depletionDate}",
                        color = tokens.muted,
                        fontSize = 12.sp
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (critical) MediCareColors.Red.copy(alpha = 0.15f)
                            else MediCareColors.Green.copy(alpha = 0.15f)
                        )
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "${forecast.daysRemaining} dias",
                        color = if (critical) MediCareColors.Red else MediCareColors.Green,
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

// ─── 6. AI ASSISTANT SCREEN (Equivalente a src/screens/AIScreen.jsx) ──────────
@Composable
fun PatientAiScreen(
    state: PatientUiState,
    onSendQuestion: (String) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    var input by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(16.dp)
    ) {
        Text(
            text = "✨ Assistente Farmacêutico IA",
            color = tokens.txt,
            fontSize = (22 * tokens.fontScale).sp,
            fontWeight = FontWeight.Black
        )
        Text(
            text = "Tire dúvidas sobre seus medicamentos (conectado via proxy seguro sem chaves no APK)",
            color = tokens.sub,
            fontSize = 12.sp
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Aviso de segurança médica obrigatório
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(MediCareColors.Amber.copy(alpha = 0.12f))
                .border(1.dp, MediCareColors.Amber.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                .padding(10.dp)
        ) {
            Text(
                text = "⚠️ As informações geradas por IA são apenas educativas e não substituem prescrição ou consulta médica.",
                color = MediCareColors.Amber,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(state.aiMessages) { (role, text) ->
                val isUser = role == "user"
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = if (isUser) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Box(
                        modifier = Modifier
                            .widthIn(max = 310.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (isUser) MediCareColors.Blue else tokens.bg1)
                            .border(1.dp, if (isUser) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(16.dp))
                            .padding(14.dp)
                    ) {
                        Text(
                            text = text,
                            color = if (isUser) Color.White else tokens.txt,
                            fontSize = (14 * tokens.fontScale).sp
                        )
                    }
                }
            }
            if (state.aiLoading) {
                item {
                    Text(
                        text = "Consultando assistente...",
                        color = tokens.sub,
                        fontSize = 12.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Pergunte sobre horários, alimentos...") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = {
                    if (input.isNotBlank()) {
                        onSendQuestion(input)
                        input = ""
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.height(54.dp)
            ) {
                Text("Enviar", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ─── 7. PROFILE SCREEN (Equivalente a src/screens/ProfileScreen.jsx) ──────────
@Composable
fun PatientProfileScreen(
    state: PatientUiState,
    darkTheme: Boolean,
    highContrast: Boolean,
    fontScale: Float,
    onToggleDark: (Boolean) -> Unit,
    onToggleHighContrast: (Boolean) -> Unit,
    onChangeFontScale: (Float) -> Unit,
    onLogout: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val user = state.user

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Cartão de Identificação e Emergência
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(22.dp))
                    .padding(20.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(MediCareColors.Blue.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (user?.nome?.firstOrNull()?.uppercase() ?: "P"),
                            color = MediCareColors.Blue,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = user?.nome ?: "Paciente",
                            color = tokens.txt,
                            fontSize = (19 * tokens.fontScale).sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = user?.email ?: "",
                            color = tokens.sub,
                            fontSize = 13.sp
                        )
                        Text(
                            text = "Perfil: ${UserRole.fromCode(user?.role).label} · Tipo Sanguíneo: ${user?.tipoSanguineo ?: "O+"}",
                            color = MediCareColors.Green,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Integração com MediCare Cuidador Web
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(16.dp)
            ) {
                Text(
                    text = "🤝 Integração com MediCare Cuidador (Web)",
                    color = tokens.txt,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Seus cuidadores autorizados acompanham suas confirmações de dose e alertas de estoque em tempo real através do painel web compartilhado.",
                    color = tokens.sub,
                    fontSize = 12.sp
                )
            }
        }

        // Acessibilidade e Aparência
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(tokens.bg1)
                    .border(1.dp, tokens.bdr, RoundedCornerShape(18.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Acessibilidade e Aparência",
                    color = tokens.txt,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Modo Escuro", color = tokens.txt, fontSize = 14.sp)
                    Switch(checked = darkTheme, onCheckedChange = onToggleDark)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Alto Contraste", color = tokens.txt, fontSize = 14.sp)
                    Switch(checked = highContrast, onCheckedChange = onToggleHighContrast)
                }

                Text(
                    text = "Tamanho da Fonte: ${(fontScale * 100).roundToInt()}%",
                    color = tokens.sub,
                    fontSize = 13.sp
                )
                Slider(
                    value = fontScale,
                    onValueChange = onChangeFontScale,
                    valueRange = 0.85f..1.30f
                )
            }
        }

        item {
            OutlinedButton(
                onClick = onLogout,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Text("Sair da Conta", color = MediCareColors.Red, fontWeight = FontWeight.Bold)
            }
        }
    }
}
