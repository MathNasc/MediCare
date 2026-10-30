package br.com.medicare.paciente.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.ui.theme.LocalMediCareTokens
import br.com.medicare.paciente.ui.theme.MediCareColors
import br.com.medicare.paciente.ui.viewmodel.PatientUiState
import java.time.LocalDate
import java.time.Period
import java.util.UUID

/**
 * Tela de Perfil Completa com todas as sub-telas, Cartão de Emergência e Conexão com Servidor Oracle (`src/screens/ProfileScreen.jsx`).
 */
@Composable
fun PatientProfileScreen(
    state: PatientUiState,
    darkTheme: Boolean,
    highContrast: Boolean,
    fontScale: Float,
    oracleBackendUrl: String = "",
    oracleApiKey: String = "",
    lastSyncStatus: String = "",
    onSaveOracleConfig: (String, String) -> Unit = { _, _ -> },
    onSyncOracleNow: () -> Unit = {},
    onToggleDark: (Boolean) -> Unit,
    onToggleHighContrast: (Boolean) -> Unit,
    onChangeFontScale: (Float) -> Unit,
    onUpdateProfile: (UserProfile) -> Unit,
    onChangeRoleWithPin: (String, String, () -> Unit) -> Unit,
    onSaveMedication: (Medication) -> Unit,
    onSaveAllergy: (AllergyItem) -> Unit,
    onDeleteAllergy: (String) -> Unit,
    onSaveCondition: (HealthConditionItem) -> Unit,
    onDeleteCondition: (String) -> Unit,
    onSaveContact: (EmergencyContact) -> Unit,
    onDeleteContact: (String) -> Unit,
    onSaveProfessional: (HealthcareProfessional) -> Unit,
    onDeleteProfessional: (String) -> Unit,
    onCreateCaregiverInvite: (String?, String, String, (CaregiverRelationship) -> Unit) -> Unit,
    onUpdateCaregiver: (CaregiverRelationship) -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit = onLogout
) {
    val tokens = LocalMediCareTokens.current
    val context = LocalContext.current
    var subView by remember { mutableStateOf("main") }
    var showNotifWarningModal by remember { mutableStateOf(false) }
    var showDeleteConfirmModal by remember { mutableStateOf(false) }

    BackHandler(enabled = subView != "main") {
        subView = "main"
    }

    val user = state.user ?: UserProfile(id = "user-local", nome = "Paciente MediCare", email = "paciente@medicare.br")
    val userAge = remember(user.dob) {
        runCatching {
            val birth = LocalDate.parse(user.dob ?: "1958-05-14")
            Period.between(birth, LocalDate.now()).years
        }.getOrNull()
    }

    fun dialPhone(phone: String?) {
        if (phone.isNullOrBlank()) return
        runCatching {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${phone.filter { it.isDigit() || it == '+' }}"))
            context.startActivity(intent)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.bg0)
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        if (subView != "main") {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(tokens.bg2)
                    .clickable { subView = "main" }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("← Voltar ao Perfil", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(14.dp))
        }

        when (subView) {
            "main" -> {
                // Header com Avatar, Idade e Perfil
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(MediCareColors.Blue, MediCareColors.Purple))),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = user.nome.take(1).uppercase(),
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = user.socialName?.takeIf { it.isNotBlank() } ?: user.nome,
                            color = tokens.txt,
                            fontSize = (20 * tokens.fontScale).sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = buildString {
                                if (userAge != null) append("$userAge anos · ")
                                append("Sangue ${user.bloodType ?: "O+"}")
                            },
                            color = tokens.sub,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        val roleObj = UserRole.fromCode(user.role)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(99.dp))
                                .background(MediCareColors.Blue.copy(alpha = 0.16f))
                                .padding(horizontal = 10.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = "👤 ${roleObj.label}",
                                color = MediCareColors.Blue,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Hero Card: Cartão de Emergência
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(MediCareColors.Red.copy(alpha = 0.22f), MediCareColors.Red.copy(alpha = 0.08f))
                            )
                        )
                        .border(1.5.dp, MediCareColors.Red.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
                        .padding(18.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🚨", fontSize = 26.sp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("Cartão de Emergência", color = tokens.txt, fontSize = 17.sp, fontWeight = FontWeight.Black)
                            Text("Acesso rápido para socorristas e médicos", color = tokens.sub, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = { subView = "emergency_card" },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1.4f).height(46.dp)
                        ) {
                            Text("🚨 Abrir Cartão", color = Color.White, fontWeight = FontWeight.ExtraBold)
                        }
                        OutlinedButton(
                            onClick = { subView = "emergency_config" },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).height(46.dp)
                        ) {
                            Text("⚙️ Configurar", color = tokens.txt, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))
                Text("SEÇÕES DO PERFIL", color = tokens.muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))

                // 10 Itens de Navegação idênticos ao ProfileScreen.jsx
                val navItems = listOf(
                    Triple("personal", "👤 Dados pessoais", "Nome, CPF, tipo sanguíneo, peso e altura"),
                    Triple("health", "❤️ Saúde", "${state.allergies.size} alergia(s) · ${state.healthConditions.size} condição(ões)"),
                    Triple("meds_config", "💊 Tratamento", "Medicamentos exibidos na emergência"),
                    Triple("professionals", "👨‍⚕️ Profissionais", "${state.healthcareProfessionals.size} médico(s) cadastrado(s)"),
                    Triple("contacts", "👨‍👩‍👧 Contatos", "${state.emergencyContacts.size} contato(s) de emergência"),
                    Triple("caregivers", "🤝 Cuidadores", "${state.caregivers.count { it.status == "active" }} ativo(s) · Convites e permissões"),
                    Triple("stock", "📦 Estoque", "Histórico de compras, preços e lotes"),
                    Triple("oracle_server", "☁️ Sincronização em Nuvem", "Sincronização automática ativa com o servidor MediCare"),
                    Triple("role_swap", "🔄 Mudar Perfil", "Alternar entre Independente, Supervisionado e Cuidador"),
                    Triple("privacy", "🔐 Privacidade", "Segurança dos dados e encerramento de sessão"),
                    Triple("prefs", "⚙️ Preferências", "Tema, tamanho da fonte, alto contraste e alertas")
                )

                navItems.forEach { (id, title, subtitle) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(tokens.bg1)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                            .clickable { subView = id }
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(title, color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                            Text(subtitle, color = tokens.sub, fontSize = 12.sp)
                        }
                        Text("›", color = tokens.muted, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            "emergency_card" -> {
                val cfg = user.emergencySettings
                val emergencyMeds = state.medications.filter { it.ativo && it.importantForEmergency }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(tokens.bg1)
                        .border(2.dp, MediCareColors.Red, RoundedCornerShape(22.dp))
                        .padding(20.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🚨", fontSize = 28.sp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("CARTÃO MÉDICO DE EMERGÊNCIA", color = MediCareColors.Red, fontSize = 14.sp, fontWeight = FontWeight.Black)
                            Text(user.nome, color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InfoPill("Sangue", user.bloodType ?: "O+", MediCareColors.Red, Modifier.weight(1f))
                        InfoPill("Idade", "${userAge ?: "--"} anos", MediCareColors.Blue, Modifier.weight(1f))
                        InfoPill("Peso/Alt", "${user.weight ?: "--"}kg / ${user.height ?: "--"}cm", MediCareColors.Purple, Modifier.weight(1f))
                    }

                    if (cfg.showAllergies) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text("⚠️ ALERGIAS", color = MediCareColors.Red, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        if (state.allergies.isEmpty()) {
                            Text("Nenhuma alergia registrada.", color = tokens.sub, fontSize = 13.sp)
                        } else {
                            state.allergies.forEach { a ->
                                Text("• ${a.name} (${a.severity}) — ${a.reaction ?: ""}", color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }

                    if (cfg.showConditions) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text("❤️ CONDIÇÕES DE SAÚDE", color = MediCareColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        if (state.healthConditions.isEmpty()) {
                            Text("Nenhuma condição registrada.", color = tokens.sub, fontSize = 13.sp)
                        } else {
                            state.healthConditions.forEach { c ->
                                Text("• ${c.name} ${c.notes?.let { "($it)" } ?: ""}", color = tokens.txt, fontSize = 13.sp)
                            }
                        }
                    }

                    if (cfg.showMedications) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text("💊 MEDICAMENTOS EM USO", color = MediCareColors.Blue, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        emergencyMeds.forEach { m ->
                            Text("• ${m.nome} ${m.dosagem} (${m.horarios.ifEmpty { listOf("SOS") }.joinToString(", ")})", color = tokens.txt, fontSize = 13.sp)
                        }
                    }

                    if (cfg.showContacts && state.emergencyContacts.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text("📞 CONTATOS DE EMERGÊNCIA", color = MediCareColors.Green, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        Spacer(modifier = Modifier.height(6.dp))
                        state.emergencyContacts.forEach { ec ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.bg2)
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("${ec.name} (${ec.relation})", color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    Text(ec.phone, color = tokens.sub, fontSize = 12.sp)
                                }
                                Button(
                                    onClick = { dialPhone(ec.phone) },
                                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("📞 Ligar", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            "emergency_config" -> {
                var settings by remember { mutableStateOf(user.emergencySettings) }
                Text("⚙️ Configurar Cartão de Emergência", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                ToggleSettingRow("Exibir Alergias", settings.showAllergies) { settings = settings.copy(showAllergies = it) }
                ToggleSettingRow("Exibir Condições de Saúde", settings.showConditions) { settings = settings.copy(showConditions = it) }
                ToggleSettingRow("Exibir Medicamentos Importantes", settings.showMedications) { settings = settings.copy(showMedications = it) }
                ToggleSettingRow("Exibir Contatos de Emergência", settings.showContacts) { settings = settings.copy(showContacts = it) }
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = settings.emergencyNotes,
                    onValueChange = { settings = settings.copy(emergencyNotes = it) },
                    label = { Text("Instruções médicas de emergência") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(14.dp))
                Button(
                    onClick = {
                        onUpdateProfile(user.copy(emergencySettings = settings))
                        subView = "emergency_card"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text("✓ Salvar Configuração", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }

            "personal" -> {
                var nome by remember { mutableStateOf(user.nome) }
                var socialName by remember { mutableStateOf(user.socialName ?: "") }
                var dob by remember { mutableStateOf(user.dob ?: "1958-05-14") }
                var sex by remember { mutableStateOf(user.sex ?: "Feminino") }
                var cpf by remember { mutableStateOf(user.cpf ?: "") }
                var phone by remember { mutableStateOf(user.phone ?: "") }
                var address by remember { mutableStateOf(user.address ?: "") }
                var weight by remember { mutableStateOf(user.weight ?: "68") }
                var height by remember { mutableStateOf(user.height ?: "165") }
                var bloodType by remember { mutableStateOf(user.bloodType ?: "O+") }
                val bloodTypes = listOf("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

                Text("👤 Dados Pessoais", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = nome, onValueChange = { nome = it }, label = { Text("Nome completo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = socialName, onValueChange = { socialName = it }, label = { Text("Nome social / Como prefere ser chamado") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = dob, onValueChange = { dob = it }, label = { Text("Nascimento (AAAA-MM-DD)") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = sex, onValueChange = { sex = it }, label = { Text("Sexo") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = cpf, onValueChange = { cpf = it }, label = { Text("CPF") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Telefone") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Endereço residencial") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = weight, onValueChange = { weight = it }, label = { Text("Peso (kg)") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = height, onValueChange = { height = it }, label = { Text("Altura (cm)") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text("Tipo Sanguíneo", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    bloodTypes.forEach { bt ->
                        val sel = bloodType == bt
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (sel) MediCareColors.Red else tokens.bg2)
                                .clickable { bloodType = bt }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(bt, color = if (sel) Color.White else tokens.sub, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        onUpdateProfile(
                            user.copy(
                                nome = nome,
                                socialName = socialName.takeIf { it.isNotBlank() },
                                dob = dob,
                                dataNascimento = dob,
                                sex = sex,
                                cpf = cpf.takeIf { it.isNotBlank() },
                                phone = phone,
                                telefone = phone,
                                address = address.takeIf { it.isNotBlank() },
                                weight = weight,
                                height = height,
                                bloodType = bloodType,
                                tipoSanguineo = bloodType
                            )
                        )
                        subView = "main"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text("✓ Salvar Dados Pessoais", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }

            "health" -> {
                var editingAllergyId by remember { mutableStateOf<String?>(null) }
                var newAllergyName by remember { mutableStateOf("") }
                var newAllergyReaction by remember { mutableStateOf("") }
                var newAllergySeverity by remember { mutableStateOf("Moderada") }
                var editingCondId by remember { mutableStateOf<String?>(null) }
                var newCondName by remember { mutableStateOf("") }
                var newCondNotes by remember { mutableStateOf("") }

                Text("❤️ Saúde (Alergias e Condições)", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                Text("⚠️ Alergias", color = MediCareColors.Red, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(modifier = Modifier.height(6.dp))
                state.allergies.forEach { a ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(tokens.bg1)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("${a.name} (${a.severity}) — ${a.reaction ?: ""}", color = tokens.txt, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("✏️", modifier = Modifier.clickable {
                                editingAllergyId = a.id
                                newAllergyName = a.name
                                newAllergyReaction = a.reaction ?: ""
                                newAllergySeverity = a.severity
                            })
                            Text("🗑️", modifier = Modifier.clickable { onDeleteAllergy(a.id) })
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(value = newAllergyName, onValueChange = { newAllergyName = it }, label = { Text(if (editingAllergyId != null) "Editar alergia" else "Nova alergia") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = newAllergyReaction, onValueChange = { newAllergyReaction = it }, label = { Text("Reação") }, singleLine = true, modifier = Modifier.weight(1f))
                    Button(
                        onClick = {
                            if (newAllergyName.isNotBlank()) {
                                val targetId = editingAllergyId ?: "alg-${UUID.randomUUID().toString().take(6)}"
                                onSaveAllergy(AllergyItem(targetId, user.id, newAllergyName.trim(), newAllergyReaction.trim(), newAllergySeverity.ifBlank { "Moderada" }))
                                editingAllergyId = null
                                newAllergyName = ""
                                newAllergyReaction = ""
                                newAllergySeverity = "Moderada"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red)
                    ) { Text(if (editingAllergyId != null) "✓" else "+") }
                }

                Spacer(modifier = Modifier.height(18.dp))
                Text("🩺 Condições de Saúde", color = MediCareColors.Blue, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(modifier = Modifier.height(6.dp))
                state.healthConditions.forEach { c ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(tokens.bg1)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("${c.name} ${c.notes?.let { "— $it" } ?: ""}", color = tokens.txt, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("✏️", modifier = Modifier.clickable {
                                editingCondId = c.id
                                newCondName = c.name
                                newCondNotes = c.notes ?: ""
                            })
                            Text("🗑️", modifier = Modifier.clickable { onDeleteCondition(c.id) })
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(value = newCondName, onValueChange = { newCondName = it }, label = { Text(if (editingCondId != null) "Editar condição" else "Nova condição") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = newCondNotes, onValueChange = { newCondNotes = it }, label = { Text("Observação") }, singleLine = true, modifier = Modifier.weight(1f))
                    Button(
                        onClick = {
                            if (newCondName.isNotBlank()) {
                                val targetId = editingCondId ?: "cond-${UUID.randomUUID().toString().take(6)}"
                                onSaveCondition(HealthConditionItem(targetId, user.id, newCondName.trim(), newCondNotes.trim()))
                                editingCondId = null
                                newCondName = ""
                                newCondNotes = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue)
                    ) { Text(if (editingCondId != null) "✓" else "+") }
                }
            }

            "meds_config" -> {
                Text("💊 Medicamentos na Emergência", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text("Selecione quais medicamentos devem aparecer no Cartão de Emergência:", color = tokens.sub, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(12.dp))
                state.medications.forEach { m ->
                    ToggleSettingRow("${m.nome} (${m.dosagem})", m.importantForEmergency) { checked ->
                        onSaveMedication(m.copy(importantForEmergency = checked))
                    }
                }
            }

            "professionals" -> {
                var editingProfId by remember { mutableStateOf<String?>(null) }
                var name by remember { mutableStateOf("") }
                var specialty by remember { mutableStateOf("") }
                var phone by remember { mutableStateOf("") }
                var crm by remember { mutableStateOf("") }

                Text("👨‍⚕️ Profissionais de Saúde", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                state.healthcareProfessionals.forEach { p ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(tokens.bg1)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(listOfNotNull(p.specialty, p.crm?.takeIf { it.isNotBlank() && it != "null" }, p.phone).joinToString(" · "), color = tokens.sub, fontSize = 12.sp)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (!p.phone.isNullOrBlank()) {
                                Button(
                                    onClick = { dialPhone(p.phone) },
                                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) { Text("📞 Ligar", color = Color.White, fontSize = 12.sp) }
                            }
                            Text("✏️", modifier = Modifier.clickable {
                                editingProfId = p.id
                                name = p.name
                                specialty = p.specialty
                                crm = p.crm?.takeIf { it != "null" } ?: ""
                                phone = p.phone ?: ""
                            })
                            Text("🗑️", modifier = Modifier.clickable { onDeleteProfessional(p.id) })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(if (editingProfId != null) "Editar profissional:" else "Adicionar profissional:", color = tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome do médico/profissional") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = specialty, onValueChange = { specialty = it }, label = { Text("Especialidade") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = crm, onValueChange = { crm = it }, label = { Text("CRM / Registro") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Telefone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = {
                        if (name.isNotBlank()) {
                            onSaveProfessional(
                                HealthcareProfessional(
                                    id = editingProfId ?: "prof-${UUID.randomUUID().toString().take(6)}",
                                    userId = user.id,
                                    name = name.trim(),
                                    specialty = specialty.ifBlank { "Clínico Geral" },
                                    phone = phone.takeIf { it.isNotBlank() },
                                    crm = crm.takeIf { it.isNotBlank() }
                                )
                            )
                            editingProfId = null; name = ""; specialty = ""; phone = ""; crm = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    modifier = Modifier.fillMaxWidth()
                ) { Text(if (editingProfId != null) "✓ Salvar Alterações" else "+ Salvar Profissional", color = Color.White, fontWeight = FontWeight.Bold) }
            }

            "contacts" -> {
                var editingContactId by remember { mutableStateOf<String?>(null) }
                var name by remember { mutableStateOf("") }
                var relation by remember { mutableStateOf("") }
                var phone by remember { mutableStateOf("") }

                Text("👨‍👩‍👧 Contatos de Emergência", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                state.emergencyContacts.forEach { ec ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(tokens.bg1)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("${ec.name} (${ec.relation})", color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(ec.phone, color = tokens.sub, fontSize = 12.sp)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Button(
                                onClick = { dialPhone(ec.phone) },
                                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) { Text("📞 Ligar", color = Color.White, fontSize = 12.sp) }
                            Text("✏️", modifier = Modifier.clickable {
                                editingContactId = ec.id
                                name = ec.name
                                relation = ec.relation
                                phone = ec.phone
                            })
                            Text("🗑️", modifier = Modifier.clickable { onDeleteContact(ec.id) })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome do contato") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = relation, onValueChange = { relation = it }, label = { Text("Parentesco") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Telefone") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = {
                        if (name.isNotBlank() && phone.isNotBlank()) {
                            onSaveContact(
                                EmergencyContact(
                                    id = editingContactId ?: "ec-${UUID.randomUUID().toString().take(6)}",
                                    userId = user.id,
                                    name = name.trim(),
                                    relation = relation.ifBlank { "Familiar" },
                                    phone = phone.trim(),
                                    priority = state.emergencyContacts.size + 1
                                )
                            )
                            editingContactId = null; name = ""; relation = ""; phone = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    modifier = Modifier.fillMaxWidth()
                ) { Text(if (editingContactId != null) "✓ Salvar Alterações" else "+ Adicionar Contato", color = Color.White, fontWeight = FontWeight.Bold) }
            }

            "caregivers" -> {
                var email by remember { mutableStateOf("") }
                var label by remember { mutableStateOf("Familiar") }
                var perm by remember { mutableStateOf("caregiver") }
                var generatedInvite by remember { mutableStateOf<CaregiverRelationship?>(null) }
                val isPatientRole = user.role.equals("paciente", ignoreCase = true) || user.role.equals("patient", ignoreCase = true) || user.role.equals("supervised", ignoreCase = true)

                Text("🤝 Cuidadores e Vínculos", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text("Gerencie quem pode acompanhar ou administrar suas doses no MediCare Cuidador Web:", color = tokens.sub, fontSize = 13.sp)

                Spacer(modifier = Modifier.height(14.dp))
                if (!isPatientRole) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(MediCareColors.Amber.copy(alpha = 0.14f))
                            .border(1.dp, MediCareColors.Amber.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "⚠️ Você é independente, vire paciente para continuar",
                            color = MediCareColors.Amber,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "O vínculo com cuidadores está disponível apenas quando seu perfil está configurado como Paciente.",
                            color = tokens.sub,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { subView = "role_swap" },
                            colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Amber),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("🔄 Mudar para perfil Paciente", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                } else {
                    state.caregivers.forEach { cg ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(tokens.bg1)
                                .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                                .padding(14.dp)
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column {
                                    Text(cg.caregiverName ?: cg.inviteEmail ?: "Cuidador Convidado", color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                                    Text("${cg.relationshipLabel ?: "Familiar"} · Status: ${cg.status.uppercase()}", color = tokens.sub, fontSize = 12.sp)
                                }
                                if (cg.status != "revoked") {
                                    Text(
                                        text = "Revogar",
                                        color = MediCareColors.Red,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.clickable {
                                            onUpdateCaregiver(cg.copy(status = "revoked"))
                                        }
                                    )
                                }
                            }
                            if (cg.status != "revoked") {
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf("viewer" to "👁️ Visualizador", "caregiver" to "🤝 Cuidador", "admin" to "🛡️ Admin").forEach { (pCode, pLabel) ->
                                        val active = cg.permissionLevel == pCode
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (active) MediCareColors.Purple else tokens.bg2)
                                                .clickable { onUpdateCaregiver(cg.copy(permissionLevel = pCode)) }
                                                .padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                            Text(pLabel, color = if (active) Color.White else tokens.sub, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Convidar novo cuidador:", color = tokens.sub, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("E-mail do cuidador (opcional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Vínculo (ex: Filho, Enfermeira)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            onCreateCaregiverInvite(email, label, perm) { created ->
                                generatedInvite = created
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Purple),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("🔗 Gerar Link de Convite", color = Color.White, fontWeight = FontWeight.ExtraBold)
                    }

                    generatedInvite?.let { inv ->
                        val link = "https://medicare.app/invite/${inv.inviteToken}"
                        Spacer(modifier = Modifier.height(12.dp))
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(MediCareColors.Purple.copy(alpha = 0.14f))
                                .border(1.dp, MediCareColors.Purple, RoundedCornerShape(14.dp))
                                .padding(14.dp)
                        ) {
                            Text("Link de convite gerado:", color = MediCareColors.Purple, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(link, color = tokens.txt, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, "Olá! Acompanhe meu tratamento no MediCare Cuidador: $link")
                                    }
                                    context.startActivity(Intent.createChooser(sendIntent, "Compartilhar Convite"))
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green)
                            ) {
                                Text("📤 Compartilhar via WhatsApp / SMS", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            "stock" -> {
                StockHistorySubScreen(state = state)
            }

            "oracle_server" -> {
                Text("☁️ Sincronização em Nuvem", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text(
                    text = "Seus medicamentos, histórico de doses e agenda são sincronizados automaticamente com o servidor MediCare.",
                    color = tokens.sub,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Text("STATUS DA CONEXÃO", color = tokens.muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(lastSyncStatus, color = MediCareColors.Green, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Fila offline pendente: ${state.pendingSyncCount} registro(s)", color = tokens.sub, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onSyncOracleNow,
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Green),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text("🔄 Sincronizar Agora", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }

            "role_swap" -> {
                var targetRole by remember { mutableStateOf(user.role) }
                var pinInput by remember { mutableStateOf("") }
                var showPatientAlertModal by remember { mutableStateOf(false) }

                Text("🔄 Mudar Modo de Perfil", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text("Escolha como você utiliza o MediCare Paciente.", color = tokens.sub, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(14.dp))

                UserRole.entries.forEach { r ->
                    val sel = targetRole == r.code
                    val isPatientOption = r == UserRole.PACIENTE
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (sel) MediCareColors.Blue.copy(alpha = 0.16f) else tokens.bg1)
                            .border(1.5.dp, if (sel) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(16.dp))
                            .clickable {
                                if (isPatientOption && targetRole != "paciente") {
                                    showPatientAlertModal = true
                                } else {
                                    targetRole = r.code
                                }
                            }
                            .padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(if (isPatientOption) "🧑" else "⚙️", fontSize = 22.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(r.label, color = tokens.txt, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
                            Text(if (sel) "●" else "○", color = if (sel) MediCareColors.Blue else tokens.muted, fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isPatientOption) MediCareColors.Amber.copy(alpha = 0.14f)
                                    else MediCareColors.Blue.copy(alpha = 0.14f)
                                )
                                .border(
                                    1.dp,
                                    if (isPatientOption) MediCareColors.Amber.copy(alpha = 0.45f)
                                    else MediCareColors.Blue.copy(alpha = 0.45f),
                                    RoundedCornerShape(12.dp)
                                )
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Text(if (isPatientOption) "⚠️" else "ℹ️", fontSize = 13.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = r.description,
                                color = if (isPatientOption) MediCareColors.Amber else MediCareColors.Blue,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                if (showPatientAlertModal) {
                    AlertDialog(
                        onDismissRequest = { showPatientAlertModal = false },
                        title = { Text("⚠️ Atenção", fontWeight = FontWeight.Black) },
                        text = {
                            Text("Você só poderá alterar seu perfil para independente com a permissão do cuidador")
                        },
                        confirmButton = {
                            Button(
                                onClick = {
                                    targetRole = "paciente"
                                    showPatientAlertModal = false
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Amber)
                            ) {
                                Text("Confirmar", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { showPatientAlertModal = false }) {
                                Text("Cancelar")
                            }
                        }
                    )
                }

                if (user.role == "paciente" && targetRole != "paciente") {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "⚠️ Você só poderá alterar seu perfil para independente com a permissão do cuidador.",
                        color = MediCareColors.Amber,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = { pinInput = it.filter { ch -> ch.isDigit() }.take(6) },
                        label = { Text("PIN do Cuidador (6 dígitos — padrão: 123456)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        onChangeRoleWithPin(targetRole, pinInput) {
                            subView = "main"
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Blue),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text("✓ Confirmar Alteração de Perfil", color = Color.White, fontWeight = FontWeight.ExtraBold)
                }
            }

            "privacy" -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(tokens.bg1)
                        .border(1.dp, tokens.bdr, RoundedCornerShape(20.dp))
                        .padding(20.dp)
                ) {
                    Text("🔐 Privacidade e Segurança", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Seus dados de saúde são privados, protegidos e sincronizados automaticamente em tempo real com o servidor seguro. Nenhuma informação é compartilhada com terceiros sem sua autorização explícita (como ao vincular um cuidador).\n\nO Cartão de Emergência exibe apenas as informações que você autorizar na tela de configuração do cartão.",
                        color = tokens.sub,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                    Spacer(modifier = Modifier.height(18.dp))
                    Button(
                        onClick = { showDeleteConfirmModal = true },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Text("🗑️ Excluir minha conta e dados", color = MediCareColors.Red, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }

                    if (showDeleteConfirmModal) {
                        AlertDialog(
                            onDismissRequest = { showDeleteConfirmModal = false },
                            title = {
                                Text("Excluir Conta Definitivamente", color = tokens.txt, fontWeight = FontWeight.Bold)
                            },
                            text = {
                                Text(
                                    "Tem certeza que deseja apagar sua conta e todos os seus registros? Seus medicamentos, histórico, dados de saúde e conta serão excluídos permanentemente deste dispositivo e do banco de dados no servidor.\n\nEsta ação NÃO pode ser desfeita.",
                                    color = tokens.sub,
                                    fontSize = 14.sp,
                                    lineHeight = 20.sp
                                )
                            },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        showDeleteConfirmModal = false
                                        onDeleteAccount()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Sim, excluir conta e dados", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDeleteConfirmModal = false }) {
                                    Text("Cancelar", color = tokens.sub)
                                }
                            },
                            containerColor = tokens.bg1
                        )
                    }
                }
            }

            "prefs" -> {
                Text("⚙️ Preferências do Aplicativo", color = tokens.txt, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(12.dp))
                ToggleSettingRow("🌙 Tema Escuro", darkTheme, onToggleDark)
                ToggleSettingRow("👁️ Acessibilidade: Alto Contraste", highContrast, onToggleHighContrast)
                ToggleSettingRow("🔔 Lembretes e Alarmes de Doses", user.notificationsEnabled) { enabled ->
                    if (!enabled && user.role == "paciente") {
                        showNotifWarningModal = true
                    } else {
                        onUpdateProfile(user.copy(notificationsEnabled = enabled))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                Text("Tamanho da Fonte", color = tokens.sub, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(1.0f to "Normal", 1.15f to "Grande", 1.30f to "Maior").forEach { (scaleVal, label) ->
                        val active = kotlin.math.abs(fontScale - scaleVal) < 0.05f
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) MediCareColors.Blue else tokens.bg1)
                                .border(1.dp, if (active) MediCareColors.Blue else tokens.bdr, RoundedCornerShape(12.dp))
                                .clickable { onChangeFontScale(scaleVal) }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(label, color = if (active) Color.White else tokens.txt, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    if (showNotifWarningModal) {
        Dialog(onDismissRequest = { showNotifWarningModal = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(tokens.bg1)
                    .border(1.dp, MediCareColors.Red, RoundedCornerShape(22.dp))
                    .padding(20.dp)
            ) {
                Text("⚠️ Atenção: Paciente Supervisionado", color = MediCareColors.Red, fontSize = 17.sp, fontWeight = FontWeight.Black)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Desativar os lembretes pode fazer você perder horários importantes e notificará seu cuidador responsável. Deseja realmente desativar?",
                    color = tokens.sub,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { showNotifWarningModal = false }, modifier = Modifier.weight(1f)) {
                        Text("Manter Ativo", color = tokens.txt)
                    }
                    Button(
                        onClick = {
                            onUpdateProfile(user.copy(notificationsEnabled = false))
                            showNotifWarningModal = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MediCareColors.Red),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Desativar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * Tela de Histórico de Estoque (`src/screens/StockHistoryScreen.jsx`).
 */
@Composable
fun StockHistorySubScreen(state: PatientUiState) {
    val tokens = LocalMediCareTokens.current
    var selectedMedId by remember { mutableStateOf<String?>(null) }

    val filteredMovements = remember(state.stockMovements, selectedMedId) {
        if (selectedMedId == null) state.stockMovements
        else state.stockMovements.filter { it.medicationId == selectedMedId }
    }

    val lastPurchase = filteredMovements.firstOrNull { it.movementType == "purchase" }
    val boughtThisMonth = filteredMovements.filter { it.movementType == "purchase" }.sumOf { it.quantityDelta.coerceAtLeast(0) }
    val selectedForecast = state.stockForecasts.firstOrNull { selectedMedId == null || it.medId == selectedMedId }

    Column {
        // Situação do Estoque Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(tokens.bg1)
                .border(1.dp, tokens.bdr, RoundedCornerShape(20.dp))
                .padding(18.dp)
        ) {
            Text("📦 Situação do Estoque", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("Acompanhe a quantidade restante, adicione reposições ou ajuste o saldo", color = tokens.sub, fontSize = 13.sp)
            Spacer(modifier = Modifier.height(14.dp))
            if (state.medications.isEmpty()) {
                Text("Nenhum medicamento cadastrado.", color = tokens.muted, fontSize = 13.sp)
            } else {
                state.medications.forEach { med ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(tokens.bg0)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(med.nome, color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                            Text(
                                text = "Restam: ${med.estoqueAtual} ${med.unidade}",
                                color = if (med.estoqueAtual <= 5) MediCareColors.Amber else tokens.sub,
                                fontSize = 13.sp
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(MediCareColors.Blue.copy(alpha = 0.16f))
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("+ Repor", color = MediCareColors.Blue, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Histórico de Alterações (Auditoria) Card
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
                Column(modifier = Modifier.weight(1f)) {
                    Text("📋 Histórico de Alterações", color = tokens.txt, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text("Registro completo para auditoria de reposições, ajustes e consumos", color = tokens.sub, fontSize = 12.sp)
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(MediCareColors.Blue.copy(alpha = 0.16f))
                        .padding(horizontal = 9.dp, vertical = 4.dp)
                ) {
                    Text("${filteredMovements.size} reg.", color = MediCareColors.Blue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(99.dp))
                        .background(if (selectedMedId == null) MediCareColors.Blue else tokens.bg0)
                        .clickable { selectedMedId = null }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("Todos", color = if (selectedMedId == null) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                state.medications.forEach { m ->
                    val sel = selectedMedId == m.id
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(99.dp))
                            .background(if (sel) MediCareColors.Blue else tokens.bg0)
                            .clickable { selectedMedId = m.id }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(m.nome, color = if (sel) Color.White else tokens.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill("🛒 Última compra", lastPurchase?.createdAt?.take(10)?.split("-")?.reversed()?.joinToString("/") ?: "--", MediCareColors.Blue, Modifier.weight(1f))
                InfoPill("📦 Comprado mês", "+$boughtThisMonth un", MediCareColors.Green, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill("⏳ Duração média", "${selectedForecast?.daysRemaining ?: 15} dias", MediCareColors.Amber, Modifier.weight(1f))
                InfoPill("🔮 Término prev.", selectedForecast?.depletionDate?.split("-")?.reversed()?.joinToString("/") ?: "--", MediCareColors.Purple, Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(16.dp))
            if (filteredMovements.isEmpty()) {
                Text("Nenhuma alteração de estoque registrada para este filtro.", color = tokens.muted, fontSize = 13.sp)
            } else {
                filteredMovements.forEach { mov ->
                    val medName = state.medications.find { it.id == mov.medicationId }?.nome ?: "Medicamento"
                    val isPositive = mov.quantityDelta >= 0
                    val typeLabel = when (mov.movementType.lowercase()) {
                        "consumption" -> "💊 Consumo de Dose"
                        "correction", "adjustment" -> if (isPositive) "⚖️ Correção (+)" else "⚖️ Ajuste (-)"
                        else -> if (isPositive) "📦 Reposição" else "📤 Baixa Manual"
                    }
                    val datePart = mov.createdAt.take(10).split("-").reversed().joinToString("/")
                    val timePart = if (mov.createdAt.length >= 16) mov.createdAt.substring(11, 16) else ""
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(tokens.bg0)
                            .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(medName, color = tokens.txt, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                            Text(
                                text = "${if (isPositive) "+" else ""}${mov.quantityDelta} unid.",
                                color = if (isPositive) MediCareColors.Green else MediCareColors.Red,
                                fontWeight = FontWeight.Black,
                                fontSize = 14.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "$typeLabel  •  $datePart${if (timePart.isNotEmpty()) " às $timePart" else ""}",
                            color = tokens.sub,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Saldo auditado: ${mov.quantityBefore} → ${mov.quantityAfter} unidades",
                            color = tokens.txt,
                            fontSize = 12.sp
                        )
                        val extraDetails = listOfNotNull(
                            mov.notes?.takeIf { it.isNotBlank() }?.let { "Motivo: $it" },
                            mov.purchaseLocation?.takeIf { it.isNotBlank() }?.let { "Local: $it" },
                            mov.purchasePrice?.let { "Valor: R$ %.2f".format(it) }
                        ).joinToString("  •  ")
                        if (extraDetails.isNotBlank()) {
                            Text(extraDetails, color = tokens.muted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoPill(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    val tokens = LocalMediCareTokens.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(tokens.bg2)
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(12.dp)
    ) {
        Text(label, color = tokens.muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, color = color, fontSize = 15.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun ToggleSettingRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    val tokens = LocalMediCareTokens.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(tokens.bg1)
            .border(1.dp, tokens.bdr, RoundedCornerShape(14.dp))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = tokens.txt, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
