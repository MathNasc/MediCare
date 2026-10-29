package br.com.medicare.paciente.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.medicare.paciente.data.local.SessionManager
import br.com.medicare.paciente.data.repository.MediCareRepository
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.notifications.DoseAlarmScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

data class PatientUiState(
    val user: UserProfile? = null,
    val medications: List<Medication> = emptyList(),
    val history: List<DoseHistoryRecord> = emptyList(),
    val dailyDoses: List<ScheduledDose> = emptyList(),
    val healthEvents: List<HealthEvent> = emptyList(),
    val calendarNotes: List<CalendarNote> = emptyList(),
    val doseObservations: List<DoseObservation> = emptyList(),
    val stockMovements: List<StockMovement> = emptyList(),
    val stockForecasts: List<StockForecast> = emptyList(),
    val allergies: List<AllergyItem> = emptyList(),
    val healthConditions: List<HealthConditionItem> = emptyList(),
    val emergencyContacts: List<EmergencyContact> = emptyList(),
    val healthcareProfessionals: List<HealthcareProfessional> = emptyList(),
    val caregivers: List<CaregiverRelationship> = emptyList(),
    val pendingSyncCount: Int = 0,
    val selectedDoseForModal: ScheduledDose? = null,
    val aiMessages: List<Pair<String, String>> = emptyList(),
    val aiLoading: Boolean = false,
    val toastMessage: String? = null,
    val isRemoteConfigured: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class MediCareViewModel @Inject constructor(
    private val repository: MediCareRepository,
    val sessionManager: SessionManager,
    private val alarmScheduler: DoseAlarmScheduler
) : ViewModel() {

    private val _selectedDoseId = MutableStateFlow<String?>(null)
    private val _aiMessages = MutableStateFlow(
        listOf(
            "assistant" to "Olá! Sou o Assistente de Saúde do MediCare. Posso explicar seus medicamentos em linguagem simples, revisar sua adesão ou preparar um resumo para sua próxima consulta médica.\n\nℹ️ *Minhas respostas são informativas e nunca substituem a orientação do seu médico.*"
        )
    )
    private val _aiLoading = MutableStateFlow(false)
    private val _toastMessage = MutableStateFlow<String?>(null)

    private val medsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeMedications(u.id)
    }
    private val historyFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeDoseHistory(u.id)
    }
    private val eventsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeHealthEvents(u.id)
    }
    private val notesFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeCalendarNotes(u.id)
    }
    private val obsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeDoseObservations(u.id)
    }
    private val allergiesFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeAllergies(u.id)
    }
    private val conditionsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeHealthConditions(u.id)
    }
    private val contactsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeEmergencyContacts(u.id)
    }
    private val professionalsFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeHealthcareProfessionals(u.id)
    }
    private val caregiversFlow = sessionManager.currentUser.flatMapLatest { u ->
        if (u == null) flowOf(emptyList()) else repository.observeCaregivers(u.id)
    }

    val uiState: StateFlow<PatientUiState> = combine(
        sessionManager.currentUser,
        medsFlow,
        historyFlow,
        eventsFlow,
        notesFlow
    ) { user, meds, hist, events, notes ->
        val doses = DoseCalculator.buildDailyDoses(meds, hist)
        val forecasts = DoseCalculator.computeStockForecasts(meds)
        PatientUiState(
            user = user,
            medications = meds,
            history = hist,
            dailyDoses = doses,
            healthEvents = events,
            calendarNotes = notes,
            stockForecasts = forecasts,
            isRemoteConfigured = repository.isRemoteConfigured
        )
    }.combine(
        combine(
            obsFlow,
            allergiesFlow,
            conditionsFlow,
            contactsFlow,
            professionalsFlow
        ) { obs, alg, cond, cont, prof ->
            Quintuple(obs, alg, cond, cont, prof)
        }
    ) { base, profileData ->
        base.copy(
            doseObservations = profileData.a,
            allergies = profileData.b,
            healthConditions = profileData.c,
            emergencyContacts = profileData.d,
            healthcareProfessionals = profileData.e
        )
    }.combine(
        combine(
            caregiversFlow,
            repository.observeStockMovements(),
            repository.observePendingSyncCount(),
            _selectedDoseId,
            _aiMessages
        ) { cgs, movements, pendingCount, selectedId, aiMsgs ->
            Quintuple(cgs, movements, pendingCount, selectedId, aiMsgs)
        }
    ) { base, extra ->
        val userMedIds = base.medications.map { it.id }.toSet()
        base.copy(
            caregivers = extra.a,
            stockMovements = if (base.user == null) emptyList() else extra.b.filter { it.medicationId in userMedIds },
            pendingSyncCount = extra.c,
            selectedDoseForModal = base.dailyDoses.find { it.id == extra.d },
            aiMessages = extra.e
        )
    }.combine(combine(_aiLoading, _toastMessage) { l, t -> l to t }) { state, (loading, toast) ->
        state.copy(aiLoading = loading, toastMessage = toast)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = PatientUiState(isRemoteConfigured = repository.isRemoteConfigured)
    )

    init {
        viewModelScope.launch {
            val current = sessionManager.currentUser.value
            if (current != null) {
                repository.syncFromServer(current.id)
            } else if (!repository.isRemoteConfigured) {
                // Auto-login padrão para experiência imediata offline quando não há sessão prévia
                repository.login("maria.helena@medicare.br", "123456")
            }
        }
    }

    fun showToast(msg: String) {
        _toastMessage.value = msg
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    fun openDoseByDeepLink(doseId: String?) {
        _selectedDoseId.value = doseId
    }

    fun closeDoseModal() {
        _selectedDoseId.value = null
    }

    fun login(email: String, pass: String) {
        viewModelScope.launch {
            val res = repository.login(email, pass)
            res.onFailure { _toastMessage.value = it.message ?: "Falha no login" }
        }
    }

    fun register(nome: String, email: String, pass: String) {
        viewModelScope.launch {
            val res = repository.register(nome, email, pass)
            res.onFailure { _toastMessage.value = it.message ?: "Falha no cadastro" }
        }
    }

    fun updateProfile(updated: UserProfile) {
        viewModelScope.launch {
            repository.updateProfile(updated)
            _toastMessage.value = "✓ Dados do perfil atualizados!"
        }
    }

    fun changeRoleWithPin(newRole: String, pin: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            val res = repository.changeRoleWithPin(newRole, pin)
            res.onSuccess {
                _toastMessage.value = "🔄 Perfil alterado para ${UserRole.fromCode(newRole).label}!"
                onSuccess()
            }.onFailure {
                _toastMessage.value = "⚠️ ${it.message}"
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            _selectedDoseId.value = null
            _aiMessages.value = listOf(
                "assistant" to "Olá! Sou o Assistente de Saúde do MediCare. Posso explicar seus medicamentos em linguagem simples, revisar sua adesão ou preparar um resumo para sua próxima consulta médica.\n\nℹ️ *Minhas respostas são informativas e nunca substituem a orientação do seu médico.*"
            )
            repository.logout()
        }
    }

    fun confirmDose(dose: ScheduledDose) {
        viewModelScope.launch {
            repository.confirmDose(dose)
            _toastMessage.value = "✓ Dose de ${dose.nome} confirmada!"
        }
    }

    fun snoozeDose(dose: ScheduledDose) {
        alarmScheduler.scheduleSnoozeReminder(
            medId = dose.medId,
            medName = dose.nome,
            dosage = dose.dosagem,
            unit = dose.unidade,
            hora = dose.hora,
            delayMinutes = 15L
        )
        _toastMessage.value = "⏰ Lembrete reagendado para daqui a 15 minutos."
    }

    fun undoDose(dose: ScheduledDose) {
        viewModelScope.launch {
            repository.undoDoseConfirmation(dose)
            _toastMessage.value = "↩️ Confirmação desfeita e estoque restaurado."
        }
    }

    fun registerSosUse(med: Medication, hora: String, quantityUsed: Int, reason: String) {
        viewModelScope.launch {
            repository.registerSosUse(
                med = med,
                hora = hora,
                quantityUsed = quantityUsed,
                observation = reason.ifBlank { "Uso sob demanda (SOS)" }
            )
            _toastMessage.value = "🚨 Uso SOS de ${med.nome} registrado!"
        }
    }

    fun confirmDoseRetroactive(medId: String, hora: String, dateIso: String, reason: String) {
        viewModelScope.launch {
            val res = repository.confirmDoseRetroactive(medId, hora, dateIso, reason)
            res.onSuccess {
                _toastMessage.value = "🕐 Dose retroativa registrada com auditoria!"
            }.onFailure {
                _toastMessage.value = "⚠️ ${it.message}"
            }
        }
    }

    fun saveMedicationFull(med: Medication) {
        viewModelScope.launch {
            repository.saveMedication(med)
            _toastMessage.value = "💊 Medicamento ${med.nome} salvo!"
        }
    }

    fun repeatTreatment(med: Medication, durationDays: Int) {
        viewModelScope.launch {
            repository.repeatTreatment(med, durationDays)
            _toastMessage.value = "🔁 Tratamento de ${med.nome} reiniciado por $durationDays dias!"
        }
    }

    fun deleteMedication(med: Medication) {
        viewModelScope.launch {
            repository.deleteMedication(med)
            _toastMessage.value = "🗑️ Medicamento removido."
        }
    }

    fun recordStockMovement(
        med: Medication,
        movementType: String,
        newQuantity: Int,
        purchasePrice: Double? = null,
        purchaseLocation: String? = null,
        batch: String? = null,
        expirationDate: String? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            repository.recordStockMovement(
                med = med,
                movementType = movementType,
                newQuantity = newQuantity,
                purchasePrice = purchasePrice,
                purchaseLocation = purchaseLocation,
                batch = batch,
                expirationDate = expirationDate,
                notes = notes
            )
            _toastMessage.value = "📦 Estoque de ${med.nome} atualizado para $newQuantity ${med.unidade}s!"
        }
    }

    fun saveHealthEvent(event: HealthEvent) {
        viewModelScope.launch {
            repository.saveHealthEvent(event)
            _toastMessage.value = "📅 Evento salvo no calendário!"
        }
    }

    fun deleteHealthEvent(id: String) {
        viewModelScope.launch {
            repository.deleteHealthEvent(id)
            _toastMessage.value = "🗑️ Evento removido."
        }
    }

    fun saveCalendarNote(note: CalendarNote) {
        viewModelScope.launch {
            repository.saveCalendarNote(note)
            _toastMessage.value = "📝 Anotação salva!"
        }
    }

    fun deleteCalendarNote(id: String) {
        viewModelScope.launch {
            repository.deleteCalendarNote(id)
            _toastMessage.value = "🗑️ Anotação removida."
        }
    }

    fun saveDoseObservation(doseKey: String, content: String) {
        viewModelScope.launch {
            repository.saveDoseObservation(doseKey, content)
            _toastMessage.value = "💬 Observação da dose registrada!"
        }
    }

    fun saveAllergy(item: AllergyItem) {
        viewModelScope.launch {
            repository.saveAllergy(item)
            _toastMessage.value = "✓ Alergia salva!"
        }
    }

    fun deleteAllergy(id: String) {
        viewModelScope.launch { repository.deleteAllergy(id) }
    }

    fun saveHealthCondition(item: HealthConditionItem) {
        viewModelScope.launch {
            repository.saveHealthCondition(item)
            _toastMessage.value = "✓ Condição de saúde salva!"
        }
    }

    fun deleteHealthCondition(id: String) {
        viewModelScope.launch { repository.deleteHealthCondition(id) }
    }

    fun saveEmergencyContact(item: EmergencyContact) {
        viewModelScope.launch {
            repository.saveEmergencyContact(item)
            _toastMessage.value = "✓ Contato de emergência salvo!"
        }
    }

    fun deleteEmergencyContact(id: String) {
        viewModelScope.launch { repository.deleteEmergencyContact(id) }
    }

    fun saveHealthcareProfessional(item: HealthcareProfessional) {
        viewModelScope.launch {
            repository.saveHealthcareProfessional(item)
            _toastMessage.value = "✓ Profissional de saúde salvo!"
        }
    }

    fun deleteHealthcareProfessional(id: String) {
        viewModelScope.launch { repository.deleteHealthcareProfessional(id) }
    }

    fun createCaregiverInvite(email: String?, label: String, permissionLevel: String, onCreated: (CaregiverRelationship) -> Unit = {}) {
        viewModelScope.launch {
            val created = repository.createCaregiverInvite(email, label, permissionLevel)
            if (created != null) {
                onCreated(created)
                _toastMessage.value = "🤝 Convite de cuidador gerado!"
            }
        }
    }

    fun updateCaregiverRelationship(rel: CaregiverRelationship) {
        viewModelScope.launch {
            repository.updateCaregiverRelationship(rel)
            _toastMessage.value = "✓ Permissão de cuidador atualizada!"
        }
    }

    fun askAi(question: String) {
        if (question.isBlank() || _aiLoading.value) return
        val currentMeds = uiState.value.medications
        _aiMessages.value = _aiMessages.value + ("user" to question)
        _aiLoading.value = true

        viewModelScope.launch {
            val answer = repository.askAiAssistant(question, currentMeds)
            _aiMessages.value = _aiMessages.value + ("assistant" to answer)
            _aiLoading.value = false
        }
    }

    fun syncWithOracleBackend() {
        val current = sessionManager.currentUser.value ?: return
        viewModelScope.launch {
            repository.syncFromServer(current.id)
            val timestamp = java.time.LocalTime.now().toString().take(8)
            sessionManager.updateLastSyncStatus("✓ Sincronizado com Servidor Oracle às $timestamp")
            _toastMessage.value = "🔄 Sincronização com PostgreSQL Oracle concluída!"
        }
    }

    private data class Quintuple<A, B, C, D, E>(val a: A, val b: B, val c: C, val d: D, val e: E)
}
