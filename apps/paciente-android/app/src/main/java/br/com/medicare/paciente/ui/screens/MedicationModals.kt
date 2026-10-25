package br.com.medicare.paciente.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.CatalogMedication
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.domain.util.MedicationCatalog
import br.com.medicare.paciente.ui.components.AdhesionRing
import br.com.medicare.paciente.ui.components.StockBar
import br.com.medicare.paciente.ui.components.TreatmentTypeBadge
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

/**
 * Wizard de 3 passos para Cadastro/Edição de Medicamento (`src/components/modals/MedModal.jsx`).
 * Passo 1: Busca no catálogo ANVISA ou entrada manual
 * Passo 2: Tipo de tratamento (Contínuo, Temporário, SOS)
 * Passo 3: Formulário completo (Cor, Princípio ativo, Dosagem, Estoque, Unidade, Fabricante, Cartão de Emergência, Horários, Dias da semana)
 */
@Composable
fun MedModalWizard(
    userId: String,
    existingMed: Medication?,
    onSave: (Medication) -> Unit,
    onRequestStockMovement: (Medication, Int, (Int) -> Unit) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val isEdit = existingMed != null
    var step by remember { mutableStateOf(if (isEdit) 3 else 1) }

    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Anti-hipertensivos") }

    var nome by remember { mutableStateOf(existingMed?.nome ?: "") }
    var activeIngredient by remember { mutableStateOf(existingMed?.activeIngredient ?: "") }
    var dosagem by remember { mutableStateOf(existingMed?.dosagem ?: "") }
    var unidade by remember { mutableStateOf(existingMed?.unidade ?: "comprimido") }
    var cor by remember { mutableStateOf(existingMed?.cor ?: "#3b82f6") }
    var quantidadeText by remember { mutableStateOf((existingMed?.quantidade ?: 30).toString()) }
    var manufacturer by remember { mutableStateOf(existingMed?.manufacturer ?: "") }
    var observacoes by remember { mutableStateOf(existingMed?.observacoes ?: "") }
    var importantForEmergency by remember { mutableStateOf(existingMed?.importantForEmergency ?: true) }
    var treatmentType by remember { mutableStateOf(existingMed?.treatmentType ?: "continuous") }
    var startDate by remember { mutableStateOf(existingMed?.startDate ?: LocalDate.now().toString()) }
    var treatmentDaysText by remember { mutableStateOf((existingMed?.treatmentDays ?: 7).toString()) }
    var horarios by remember {
        mutableStateOf(
            if (existingMed != null && existingMed.horarios.isNotEmpty()) existingMed.horarios
            else listOf("08:00")
        )
    }
    var newHoraInput by remember { mutableStateOf("") }
    var diasSemana by remember {
        mutableStateOf(existingMed?.diasSemana ?: listOf(0, 1, 2, 3, 4, 5, 6))
    }

    val units = listOf("comprimido", "cápsula", "ml", "gotas", "sachê", "unidade")
    val dayNames = listOf("D", "S", "T", "Q", "Q", "S", "S")

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 640.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(26.dp))
                .padding(22.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = when {
                        isEdit -> "✏️ Editar Medicamento"
                        step == 1 -> "🔍 Buscar Medicamento"
                        step == 2 -> "📋 Tipo de Tratamento"
                        else -> "💊 Detalhes do Medicamento"
                    },
                    color = tokens.txt,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "✕",
                    color = tokens.muted,
                    fontSize = 18.sp,
                    modifier = Modifier.clickable { onDismiss() }.padding(4.dp)
                )
            }

            if (!isEdit) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (s in 1..3) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(4.dp)
                                .clip(RoundedCornerShape(99.dp))
                                .background(if (s <= step) MediCareColors.Blue else tokens.bg3)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            when (step) {
                1 -> {
                    Text(
                        text = "Pesquise pelo nome comercial ou princípio ativo no catálogo ANVISA:",
                        color = tokens.sub,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Ex: Losartana, Dipirona, Glifage...") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    val searchResults = remember(searchQuery) { MedicationCatalog.searchLocal(searchQuery) }
                    if (searchQuery.trim().length >= 2) {
                        if (searchResults.isEmpty()) {
                            Text(
                                text = "Nenhum resultado no catálogo para \"$searchQuery\".",
                                color = tokens.muted,
                                fontSize = 13.sp
                            )
                        } else {
                            searchResults.forEach { item ->
                                CatalogItemRow(item = item) { chosen ->
                                    nome = chosen.name
                                    activeIngredient = chosen.activeIngredient
                                    dosagem = chosen.dosage
                                    unidade = chosen.form
                                    step = 2
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                nome = searchQuery.trim()
                                step = 2
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Usar \"${searchQuery.trim()}\" manualmente →", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Text(
                            text = "Categorias mais usadas:",
                            color = tokens.muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            MedicationCatalog.POPULAR_CATEGORIES.forEach { cat ->
                                val active = selectedCategory == cat
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(99.dp))
                                        .background(if (active) MediCareColors.Blue else tokens.bg2)
                                        .clickable { selectedCategory = cat }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = cat,
                                        color = if (active) Color.White else tokens.sub,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        MedicationCatalog.getPopularByCategory(selectedCategory).forEach { item ->
                            CatalogItemRow(item = item) { chosen ->
                                nome = chosen.name
                                activeIngredient = chosen.activeIngredient
                                dosagem = chosen.dosage
                                unidade = chosen.form
                                step = 2
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { step = 2 },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("✏️ Cadastrar manualmente sem busca", color = tokens.sub, fontWeight = FontWeight.Bold)
                    }
                }

                2 -> {
                    Text(
                        text = "Como este medicamento será utilizado?",
                        color = tokens.sub,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    TreatmentType.entries.forEach { t ->
                        val selected = treatmentType == t.code
                        val tColor = Color(t.colorHex)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (selected) tColor.copy(alpha = 0.14f) else tokens.bg2)
                                .border(2.dp, if (selected) tColor else tokens.bdr, RoundedCornerShape(16.dp))
                                .clickable {
                                    treatmentType = t.code
                                    step = 3
                                }
                                .padding(16.dp)
                        ) {
                            Text(
                                text = "${t.icon}  ${t.label}",
                                color = if (selected) tColor else tokens.txt,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = t.description, color = tokens.sub, fontSize = 13.sp)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(onClick = { step = 1 }) {
                            Text("← Voltar para busca", color = tokens.sub)
                        }
                        Button(
                            onClick = { step = 3 },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue)
                        ) {
                            Text("Continuar →", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                3 -> {
                    // Seletor de Cor da Pílula (10 cores)
                    Text("Cor de identificação", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        MediCareColors.PillPalette.forEach { hex ->
                            val c = MediCareColors.parseHex(hex)
                            val isSelected = cor.equals(hex, ignoreCase = true)
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clip(CircleShape)
                                    .background(c)
                                    .border(
                                        width = if (isSelected) 3.dp else 0.dp,
                                        color = if (isSelected) Color.White else Color.Transparent,
                                        shape = CircleShape
                                    )
                                    .clickable { cor = hex }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = nome,
                        onValueChange = { nome = it },
                        label = { Text("Nome do medicamento *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = activeIngredient,
                        onValueChange = { activeIngredient = it },
                        label = { Text("Princípio ativo") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = dosagem,
                            onValueChange = { dosagem = it },
                            label = { Text("Dosagem (ex: 50mg) *") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = quantidadeText,
                            onValueChange = { quantidadeText = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Qtd. estoque") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Unidade", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        units.forEach { u ->
                            val sel = unidade == u
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (sel) MediCareColors.Blue else tokens.bg2)
                                    .clickable { unidade = u }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(u, color = if (sel) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = manufacturer,
                        onValueChange = { manufacturer = it },
                        label = { Text("Fabricante / Laboratório") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (treatmentType == "temporary") {
                        Spacer(modifier = Modifier.height(10.dp))
                        val daysInt = treatmentDaysText.toIntOrNull() ?: 7
                        val endPreview = DoseCalculator.computeEndDate(startDate, daysInt)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MediCareColors.Amber.copy(alpha = 0.12f))
                                .border(1.dp, MediCareColors.Amber.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Text("🟡 Duração do Tratamento Temporário", color = MediCareColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = startDate,
                                    onValueChange = { startDate = it },
                                    label = { Text("Início (AAAA-MM-DD)") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1.3f)
                                )
                                OutlinedTextField(
                                    value = treatmentDaysText,
                                    onValueChange = { treatmentDaysText = it.filter { ch -> ch.isDigit() } },
                                    label = { Text("Dias") },
                                    singleLine = true,
                                    modifier = Modifier.weight(0.7f)
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Término previsto: ${endPreview.split("-").reversed().joinToString("/")}",
                                color = tokens.sub,
                                fontSize = 12.sp
                            )
                        }
                    }

                    if (treatmentType != "sos") {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Horários de administração", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            horarios.forEach { h ->
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(MediCareColors.Blue.copy(alpha = 0.16f))
                                        .border(1.dp, MediCareColors.Blue.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("⏰ $h", color = MediCareColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    if (horarios.size > 1) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "✕",
                                            color = MediCareColors.Red,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Black,
                                            modifier = Modifier.clickable { horarios = horarios - h }
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newHoraInput,
                                onValueChange = { newHoraInput = it },
                                label = { Text("+ Horário (ex: 14:00)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    val clean = newHoraInput.trim()
                                    if (clean.matches(Regex("^\\d{2}:\\d{2}$")) && !horarios.contains(clean)) {
                                        horarios = (horarios + clean).sorted()
                                        newHoraInput = ""
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("+ Adicionar", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Dias da semana", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            dayNames.forEachIndexed { idx, label ->
                                val active = diasSemana.contains(idx)
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(if (active) MediCareColors.Blue else tokens.bg2)
                                        .clickable {
                                            diasSemana = if (active && diasSemana.size > 1) diasSemana - idx else diasSemana + idx
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(label, color = if (active) Color.White else tokens.muted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = observacoes,
                        onValueChange = { observacoes = it },
                        label = { Text("Observações (ex: Tomar em jejum)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(tokens.bg2)
                            .clickable { importantForEmergency = !importantForEmergency }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(checked = importantForEmergency, onCheckedChange = { importantForEmergency = it })
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "🚨 Mostrar no Cartão de Emergência",
                            color = tokens.txt,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(
                            onClick = { if (isEdit) onDismiss() else step = 2 },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).height(48.dp)
                        ) {
                            Text(if (isEdit) "Cancelar" else "← Voltar", color = tokens.sub, fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = {
                                if (nome.isBlank() || dosagem.isBlank()) return@Button
                                val newQty = quantidadeText.toIntOrNull() ?: 30
                                val daysInt = if (treatmentType == "temporary") (treatmentDaysText.toIntOrNull() ?: 7) else null
                                val computedEnd = if (treatmentType == "temporary" && daysInt != null) {
                                    DoseCalculator.computeEndDate(startDate, daysInt)
                                } else null

                                val updatedMed = Medication(
                                    id = existingMed?.id ?: "med-${UUID.randomUUID().toString().take(8)}",
                                    userId = userId,
                                    nome = nome.trim(),
                                    dosagem = dosagem.trim(),
                                    unidade = unidade,
                                    cor = cor,
                                    quantidade = newQty,
                                    avisoEstoque = existingMed?.avisoEstoque ?: 5,
                                    horarios = if (treatmentType == "sos") emptyList() else horarios,
                                    diasSemana = diasSemana.sorted(),
                                    observacoes = observacoes.takeIf { it.isNotBlank() },
                                    ativo = true,
                                    status = "ativo",
                                    treatmentType = treatmentType,
                                    startDate = if (treatmentType == "temporary") startDate else null,
                                    endDate = computedEnd,
                                    treatmentDays = daysInt,
                                    activeIngredient = activeIngredient.takeIf { it.isNotBlank() },
                                    manufacturer = manufacturer.takeIf { it.isNotBlank() },
                                    importantForEmergency = importantForEmergency,
                                    createdAt = existingMed?.createdAt
                                )

                                if (existingMed != null && existingMed.quantidade != newQty) {
                                    onRequestStockMovement(existingMed, newQty) { confirmedQty ->
                                        onSave(updatedMed.copy(quantidade = confirmedQty))
                                        onDismiss()
                                    }
                                } else {
                                    onSave(updatedMed)
                                    onDismiss()
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).height(48.dp)
                        ) {
                            Text("✓ Salvar", color = Color.White, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogItemRow(
    item: CatalogMedication,
    onSelect: (CatalogMedication) -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val badge = MedicationCatalog.MEDICINE_TYPES[item.type]

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(tokens.bg2)
            .border(1.dp, tokens.bdr, RoundedCornerShape(12.dp))
            .clickable { onSelect(item) }
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(item.name, color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                if (badge != null) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(badge.color.copy(alpha = 0.16f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(badge.shortLabel, color = badge.color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Text(
                text = "${item.activeIngredient} · ${item.presentation}",
                color = tokens.muted,
                fontSize = 11.sp
            )
        }
        Text("Selecionar →", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * Detalhe Completo do Medicamento (`src/components/modals/MedDetail.jsx`).
 */
@Composable
fun MedDetailDialog(
    med: Medication,
    history: List<DoseHistoryRecord>,
    onEdit: () -> Unit,
    onAdjustStock: () -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val pillColor = MediCareColors.parseHex(med.cor)
    val medHistory = remember(med.id, history) { history.filter { it.medId == med.id }.take(8) }
    val confirmedCount = medHistory.count { it.status == "confirmed" }
    val adhesionPct = if (medHistory.isNotEmpty()) ((confirmedCount * 100f) / medHistory.size).toInt() else 100

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 600.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(26.dp))
                .verticalScroll(rememberScrollState())
        ) {
            // Cabeçalho com gradiente da cor da pílula
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            listOf(pillColor.copy(alpha = 0.25f), tokens.bg1)
                        )
                    )
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TreatmentTypeBadge(TreatmentType.fromCode(med.treatmentType), med.status)
                    Text(
                        text = "✕",
                        color = tokens.sub,
                        fontSize = 18.sp,
                        modifier = Modifier.clickable { onDismiss() }
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text(med.nome, color = tokens.txt, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text(
                    text = buildString {
                        append("${med.dosagem} · ${med.unidade}")
                        if (!med.activeIngredient.isNullOrBlank()) append(" · ${med.activeIngredient}")
                        if (!med.manufacturer.isNullOrBlank()) append(" (${med.manufacturer})")
                    },
                    color = tokens.sub,
                    fontSize = 13.sp
                )
            }

            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(tokens.bg2)
                            .padding(14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            AdhesionRing(percent = adhesionPct, size = 64.dp, strokeWidth = 7.dp, color = pillColor)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Adesão", color = tokens.muted, fontSize = 11.sp)
                        }
                    }
                    Column(
                        modifier = Modifier
                            .weight(1.4f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(tokens.bg2)
                            .padding(14.dp)
                    ) {
                        Text("Estoque disponível", color = tokens.muted, fontSize = 11.sp)
                        Text(
                            text = "${med.quantidade} ${med.unidade}s",
                            color = if (med.quantidade <= 5) MediCareColors.Red else tokens.txt,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        StockBar(qty = med.quantidade)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "📦 Registrar compra / ajuste →",
                            color = MediCareColors.Blue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { onAdjustStock() }
                        )
                    }
                }

                if (med.horarios.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text("Horários programados", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        med.horarios.forEach { h ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(pillColor.copy(alpha = 0.16f))
                                    .padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Text("⏰ $h", color = pillColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                if (!med.observacoes.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Observações: ${med.observacoes}", color = tokens.sub, fontSize = 13.sp)
                }

                Spacer(modifier = Modifier.height(14.dp))
                Text("Histórico recente", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                if (medHistory.isEmpty()) {
                    Text("Nenhuma tomada registrada ainda.", color = tokens.muted, fontSize = 12.sp)
                } else {
                    medHistory.forEach { rec ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(tokens.bg2)
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${rec.createdAt.take(10).split("-").reversed().joinToString("/")} às ${rec.hora}",
                                color = tokens.txt,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = if (rec.status == "confirmed") "✓ Tomada" else rec.status,
                                color = MediCareColors.Green,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Fechar", color = tokens.sub)
                    }
                    Button(
                        onClick = onEdit,
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("✏️ Editar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * Modal de Registro Rápido SOS (`src/components/modals/SOSQuickLogModal.jsx`).
 */
@Composable
fun SOSQuickLogModal(
    med: Medication,
    onConfirm: (hora: String, quantity: Int, reason: String) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val now = LocalTime.now()
    var hora by remember { mutableStateOf("%02d:%02d".format(now.hour, now.minute)) }
    var quantity by remember { mutableStateOf(1) }
    var selectedReason by remember { mutableStateOf("Dor de cabeça") }
    var customReason by remember { mutableStateOf("") }

    val quickReasons = listOf("Dor de cabeça", "Febre", "Dor no corpo", "Alergia", "Enjoo", "Cólica")

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(24.dp))
                .padding(22.dp)
        ) {
            Text("🚨 Registrar Uso SOS", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Text("${med.nome} (${med.dosagem})", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)

            Spacer(modifier = Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = hora,
                    onValueChange = { hora = it },
                    label = { Text("Horário da tomada") },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Quantidade", color = tokens.sub, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { if (quantity > 1) quantity-- },
                            contentPadding = PaddingValues(0.dp),
                            modifier = Modifier.size(34.dp)
                        ) { Text("-", fontWeight = FontWeight.Black) }
                        Text("$quantity", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        OutlinedButton(
                            onClick = { quantity++ },
                            contentPadding = PaddingValues(0.dp),
                            modifier = Modifier.size(34.dp)
                        ) { Text("+", fontWeight = FontWeight.Black) }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text("Motivo / Sintoma", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                quickReasons.forEach { r ->
                    val sel = selectedReason == r && customReason.isBlank()
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(99.dp))
                            .background(if (sel) MediCareColors.Blue else tokens.bg2)
                            .clickable {
                                selectedReason = r
                                customReason = ""
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(r, color = if (sel) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = customReason,
                onValueChange = { customReason = it },
                label = { Text("Outro motivo ou observação (opcional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Cancelar", color = tokens.sub)
                }
                Button(
                    onClick = {
                        val finalReason = customReason.takeIf { it.isNotBlank() } ?: selectedReason
                        onConfirm(hora, quantity, finalReason)
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("✓ Registrar Tomada", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}

/**
 * Modal de Movimentação de Estoque (`src/components/modals/StockMovementModal.jsx`).
 * Suporta: 🛒 Compra (Farmácia, Valor R$, Lote, Validade) e ✏️ Correção / 📉 Ajuste Manual (Perda, Erro de contagem, Vencimento, Danificado).
 */
@Composable
fun StockMovementModal(
    med: Medication,
    initialTargetQuantity: Int? = null,
    onConfirmMovement: (
        movementType: String,
        newQty: Int,
        price: Double?,
        location: String?,
        batch: String?,
        expiry: String?,
        notes: String?
    ) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalMediCareTokens.current
    val defaultDelta = if (initialTargetQuantity != null) initialTargetQuantity - med.quantidade else 30
    var mode by remember { mutableStateOf(if (defaultDelta >= 0) "purchase" else "adjustment") }
    var newQtyText by remember {
        mutableStateOf((initialTargetQuantity ?: (med.quantidade + 30)).coerceAtLeast(0).toString())
    }
    var pharmacy by remember { mutableStateOf("") }
    var priceText by remember { mutableStateOf("") }
    var batch by remember { mutableStateOf("") }
    var expirationDate by remember { mutableStateOf("") }
    var adjustmentReason by remember { mutableStateOf("Erro de contagem") }
    var notes by remember { mutableStateOf("") }

    val reasons = listOf("Perda", "Erro de contagem", "Vencimento", "Danificado")

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
            Text("📦 Controle de Estoque", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text("${med.nome} (${med.dosagem})", color = tokens.txt, fontSize = 19.sp, fontWeight = FontWeight.Black)
            Text("Estoque anterior: ${med.quantidade} ${med.unidade}s", color = tokens.sub, fontSize = 13.sp)

            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("purchase" to "🛒 Compra", "adjustment" to "📉 Ajuste", "correction" to "✏️ Correção").forEach { (code, label) ->
                    val active = mode == code
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (active) MediCareColors.Blue else tokens.bg2)
                            .clickable { mode = code }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = if (active) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = newQtyText,
                onValueChange = { newQtyText = it.filter { ch -> ch.isDigit() } },
                label = { Text("Nova quantidade total em estoque *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            if (mode == "purchase") {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = pharmacy,
                    onValueChange = { pharmacy = it },
                    label = { Text("Farmácia / Local da compra") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = priceText,
                        onValueChange = { priceText = it },
                        label = { Text("Valor pago (R$)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = batch,
                        onValueChange = { batch = it },
                        label = { Text("Lote") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = expirationDate,
                    onValueChange = { expirationDate = it },
                    label = { Text("Validade (AAAA-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                Spacer(modifier = Modifier.height(10.dp))
                Text("Motivo do ajuste", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    reasons.forEach { r ->
                        val sel = adjustmentReason == r
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(99.dp))
                                .background(if (sel) MediCareColors.Amber else tokens.bg2)
                                .clickable { adjustmentReason = r }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(r, color = if (sel) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Observação adicional") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("Cancelar", color = tokens.sub)
                }
                Button(
                    onClick = {
                        val target = newQtyText.toIntOrNull() ?: med.quantidade
                        val parsedPrice = priceText.replace(",", ".").toDoubleOrNull()
                        val finalNotes = if (mode == "purchase") notes.takeIf { it.isNotBlank() }
                        else listOfNotNull(adjustmentReason, notes.takeIf { it.isNotBlank() }).joinToString(" — ")

                        onConfirmMovement(
                            mode,
                            target,
                            parsedPrice,
                            pharmacy.takeIf { it.isNotBlank() },
                            batch.takeIf { it.isNotBlank() },
                            expirationDate.takeIf { it.isNotBlank() },
                            finalNotes
                        )
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text("✓ Confirmar", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}
