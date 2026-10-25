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
    val stockMovements: List<StockMovement> = emptyList(),
    val stockForecasts: List<StockForecast> = emptyList(),
    val pendingSyncCount: Int = 0,
    val selectedDoseForModal: ScheduledDose? = null,
    val aiMessages: List<Pair<String, String>> = emptyList(), // Pair(role, content)
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
            "assistant" to "Olá! Sou o Assistente Farmacêutico do MediCare. Posso tirar dúvidas sobre horários, interações e organização dos seus medicamentos.\n\n*Aviso: Minhas respostas são informativas e nunca substituem a orientação do seu médico.*"
        )
    )
    private val _aiLoading = MutableStateFlow(false)
    private val _toastMessage = MutableStateFlow<String?>(null)

    private val medsFlow: Flow<List<Medication>> = sessionManager.currentUser.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else repository.observeMedications(user.id)
    }

    private val historyFlow: Flow<List<DoseHistoryRecord>> = sessionManager.currentUser.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else repository.observeDoseHistory(user.id)
    }

    private val eventsFlow: Flow<List<HealthEvent>> = sessionManager.currentUser.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else repository.observeHealthEvents(user.id)
    }

    private val notesFlow: Flow<List<CalendarNote>> = sessionManager.currentUser.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else repository.observeCalendarNotes(user.id)
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
            repository.observeStockMovements(),
            repository.observePendingSyncCount(),
            _selectedDoseId,
            _aiMessages,
            _aiLoading
        ) { movements, pendingCount, selectedId, aiMsgs, aiLoad ->
             quintuple(movements, pendingCount, selectedId, aiMsgs, aiLoad)
        }
    ) { base, extra ->
        val (movements, pendingCount, selectedId, aiMsgs, aiLoad) = extra
        base.copy(
            stockMovements = movements,
            pendingSyncCount = pendingCount,
            selectedDoseForModal = base.dailyDoses.find { it.id == selectedId },
            aiMessages = aiMsgs,
            aiLoading = aiLoad
        )
    }.combine(_toastMessage) { state, toast ->
        state.copy(toastMessage = toast)
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
            }
        }
    }

    fun openDoseByDeepLink(doseId: String?) {
        _selectedDoseId.value = doseId
    }

    fun closeDoseModal() {
        _selectedDoseId.value = null
    }

    fun clearToast() {
        _toastMessage.value = null
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

    fun logout() {
        viewModelScope.launch {
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

    fun registerSosUse(med: Medication) {
        viewModelScope.launch {
            repository.registerSosUse(med, quantityUsed = 1, observation = "Uso sob demanda (SOS)")
            _toastMessage.value = "🔵 Uso SOS de ${med.nome} registrado!"
        }
    }

    fun saveMedication(
        existingId: String?,
        nome: String,
        dosagem: String,
        unidade: String,
        cor: String,
        quantidade: Int,
        horarios: List<String>,
        treatmentType: String,
        treatmentDays: Int?,
        observacoes: String?
    ) {
        val user = sessionManager.currentUser.value ?: return
        viewModelScope.launch {
            val startDate = if (treatmentType == "temporary") LocalDate.now().toString() else null
            val endDate = if (treatmentType == "temporary" && treatmentDays != null) {
                DoseCalculator.computeEndDate(startDate!!, treatmentDays)
            } else null

            val med = Medication(
                id = existingId ?: "med-${UUID.randomUUID().toString().take(8)}",
                userId = user.id,
                nome = nome.trim(),
                dosagem = dosagem.trim(),
                unidade = unidade,
                cor = cor,
                quantidade = quantidade,
                horarios = horarios.ifEmpty { listOf("08:00") },
                observacoes = observacoes,
                treatmentType = treatmentType,
                startDate = startDate,
                endDate = endDate,
                treatmentDays = treatmentDays
            )
            repository.saveMedication(med)
            _toastMessage.value = "💊 Medicamento ${med.nome} salvo e alarmes atualizados!"
        }
    }

    fun deleteMedication(med: Medication) {
        viewModelScope.launch {
            repository.deleteMedication(med)
            _toastMessage.value = "Medicamento removido."
        }
    }

    fun adjustStock(med: Medication, newQuantity: Int, movementType: String, notes: String?) {
        viewModelScope.launch {
            repository.recordStockMovement(med, movementType, newQuantity, notes)
            _toastMessage.value = "📦 Estoque de ${med.nome} atualizado para $newQuantity!"
        }
    }

    fun addHealthEvent(title: String, type: String, date: String, time: String?, description: String?) {
        val user = sessionManager.currentUser.value ?: return
        viewModelScope.launch {
            repository.saveHealthEvent(
                HealthEvent(
                    id = "ev-${UUID.randomUUID().toString().take(8)}",
                    userId = user.id,
                    type = type,
                    title = title,
                    description = description,
                    date = date,
                    time = time,
                    createdAt = Instant.now().toString()
                )
            )
            _toastMessage.value = "📅 Evento adicionado à agenda!"
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

    private data class Quintuple<A, B, C, D, E>(val a: A, val b: B, val c: C, val d: D, val e: E)
    private fun <A, B, C, D, E> quintuple(a: A, b: B, c: C, d: D, e: E) = Quintuple(a, b, c, d, e)
}
