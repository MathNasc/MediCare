package br.com.medicare.paciente.data.repository

import android.content.Context
import br.com.medicare.paciente.BuildConfig
import br.com.medicare.paciente.data.local.*
import br.com.medicare.paciente.data.remote.*
import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.DoseCalculator
import br.com.medicare.paciente.notifications.DoseAlarmScheduler
import br.com.medicare.paciente.notifications.SyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

@Singleton
class MediCareRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val dao: MediCareDao,
    private val sessionManager: SessionManager,
    private val remoteApi: MediCareRemoteApi,
    private val aiApi: AiAssistantApi,
    private val alarmScheduler: DoseAlarmScheduler
) {
    private val json = Json { ignoreUnknownKeys = true }

    val isRemoteConfigured: Boolean
        get() = BuildConfig.BACKEND_URL.isNotBlank() && BuildConfig.BACKEND_ANON_KEY.isNotBlank()

    // ─── Streams Reativos (Offline-First via Room) ────────────────────────────
    fun observeMedications(userId: String): Flow<List<Medication>> =
        dao.observeMedications(userId).map { list -> list.map { it.toDomain(json) } }

    fun observeDoseHistory(userId: String): Flow<List<DoseHistoryRecord>> =
        dao.observeDoseHistory(userId).map { list -> list.map { it.toDomain() } }

    fun observeHealthEvents(userId: String): Flow<List<HealthEvent>> =
        dao.observeHealthEvents(userId).map { list -> list.map { it.toDomain() } }

    fun observeCalendarNotes(userId: String): Flow<List<CalendarNote>> =
        dao.observeCalendarNotes(userId).map { list -> list.map { it.toDomain() } }

    fun observeDoseObservations(userId: String): Flow<List<DoseObservation>> =
        dao.observeDoseObservations(userId).map { list -> list.map { it.toDomain() } }

    fun observeStockMovements(): Flow<List<StockMovement>> =
        dao.observeStockMovements().map { list -> list.map { it.toDomain() } }

    fun observeAllergies(userId: String): Flow<List<AllergyItem>> =
        dao.observeAllergies(userId).map { list -> list.map { it.toDomain() } }

    fun observeHealthConditions(userId: String): Flow<List<HealthConditionItem>> =
        dao.observeHealthConditions(userId).map { list -> list.map { it.toDomain() } }

    fun observeEmergencyContacts(userId: String): Flow<List<EmergencyContact>> =
        dao.observeEmergencyContacts(userId).map { list -> list.map { it.toDomain() } }

    fun observeHealthcareProfessionals(userId: String): Flow<List<HealthcareProfessional>> =
        dao.observeHealthcareProfessionals(userId).map { list -> list.map { it.toDomain() } }

    fun observeCaregivers(userId: String): Flow<List<CaregiverRelationship>> =
        dao.observeCaregivers(userId).map { list -> list.map { it.toDomain() } }

    fun observePendingSyncCount(): Flow<Int> =
        dao.observePendingSyncCount()

    suspend fun getAllActiveMedicationsLocal(): List<Medication> =
        dao.getAllActiveMedications().map { it.toDomain(json) }

    suspend fun getMedicationById(medId: String): Medication? =
        dao.getMedicationById(medId)?.toDomain(json)

    suspend fun isDoseConfirmedForToday(medId: String, hora: String, today: LocalDate = LocalDate.now()): Boolean {
        val userId = sessionManager.currentUser.value?.id ?: return false
        val existing = dao.findExistingDoseForDay(userId, medId, hora, today.toString())
        return existing?.status == "confirmed"
    }

    // ─── Autenticação e Sessão ────────────────────────────────────────────────
    suspend fun login(email: String, pass: String): Result<UserProfile> {
        if (!isRemoteConfigured) {
            val localUser = UserProfile(
                id = "user-local-paciente",
                nome = email.substringBefore("@").replaceFirstChar { it.uppercase() }.ifBlank { "Maria Helena Silva" },
                email = email.ifBlank { "maria.helena@medicare.br" },
                role = "independente",
                bloodType = "O+",
                tipoSanguineo = "O+",
                dob = "1958-05-14",
                dataNascimento = "1958-05-14",
                sex = "Feminino",
                phone = "(11) 98765-4321",
                telefone = "(11) 98765-4321",
                weight = "68",
                height = "165",
                roleChangePin = "123456"
            )
            sessionManager.saveSession(localUser, accessToken = null)
            seedDefaultDataIfEmpty(localUser.id)
            return Result.success(localUser)
        }

        return runCatching {
            val res = remoteApi.signInWithPassword(AuthRequest(email = email.trim(), password = pass))
            val authUser = res.user ?: error("Credenciais inválidas.")
            sessionManager.saveSession(
                UserProfile(id = authUser.id, nome = authUser.userMetadata["nome"] ?: email, email = authUser.email),
                accessToken = res.accessToken,
                refreshToken = res.refreshToken
            )
            val profile = runCatching {
                remoteApi.getProfile("eq.${authUser.id}").firstOrNull()
            }.getOrNull() ?: UserProfile(
                id = authUser.id,
                nome = authUser.userMetadata["nome"] ?: email.substringBefore("@"),
                email = authUser.email,
                role = "independente"
            )
            sessionManager.saveSession(profile, res.accessToken, res.refreshToken)
            syncFromServer(profile.id)
            profile
        }
    }

    suspend fun register(nome: String, email: String, pass: String, role: String = "independente"): Result<UserProfile> {
        if (!isRemoteConfigured) {
            val localUser = UserProfile(
                id = "user-local-paciente",
                nome = nome.ifBlank { "Maria Helena Silva" },
                email = email.ifBlank { "maria.helena@medicare.br" },
                role = role
            )
            sessionManager.saveSession(localUser, accessToken = null)
            seedDefaultDataIfEmpty(localUser.id)
            return Result.success(localUser)
        }

        return runCatching {
            val res = remoteApi.signUp(
                AuthRequest(email = email.trim(), password = pass, data = mapOf("nome" to nome))
            )
            val authUser = res.user ?: error("Não foi possível criar a conta.")
            val profile = UserProfile(id = authUser.id, nome = nome, email = email.trim(), role = role)
            sessionManager.saveSession(profile, res.accessToken, res.refreshToken)
            if (res.accessToken != null) {
                runCatching { remoteApi.upsertProfile(profile) }
            }
            profile
        }
    }

    suspend fun updateProfile(updated: UserProfile) {
        sessionManager.saveSession(updated, sessionManager.getAccessToken())
        if (isRemoteConfigured) {
            runCatching { remoteApi.upsertProfile(updated) }
        }
    }

    suspend fun changeRoleWithPin(newRole: String, pin: String): Result<UserProfile> {
        val current = sessionManager.currentUser.value ?: return Result.failure(Exception("Sessão inativa"))
        if (current.role == "paciente" && newRole != "paciente") {
            val expectedPin = current.roleChangePin ?: "123456"
            if (pin.trim() != expectedPin) {
                return Result.failure(Exception("PIN de cuidador incorreto. Verifique o código de 6 dígitos."))
            }
        }
        if (isRemoteConfigured && pin.isNotBlank()) {
            runCatching {
                remoteApi.changeRoleWithPin(ChangeRolePinRpcRequest(pin = pin, newRole = newRole))
            }
        }
        val updated = current.copy(role = newRole)
        updateProfile(updated)
        return Result.success(updated)
    }

    suspend fun logout() {
        val current = sessionManager.currentUser.value
        if (current != null) {
            val meds = dao.getMedications(current.id).map { it.toDomain(json) }
            meds.forEach { alarmScheduler.cancelAllAlarmsForMedication(it) }
        }
        sessionManager.clearSession()
    }

    // ─── Sincronização Bidirecional ───────────────────────────────────────────
    suspend fun syncFromServer(userId: String) {
        if (!isRemoteConfigured) {
            seedDefaultDataIfEmpty(userId)
            return
        }
        flushPendingSyncQueue()
        runCatching { remoteApi.finishExpiredTreatments() }
        runCatching {
            val remoteMeds = remoteApi.getMedications("eq.$userId")
            dao.upsertMedications(remoteMeds.map { MedicationEntity.fromDomain(it, pendingSync = false, json = json) })
            alarmScheduler.scheduleAllActiveMedications(remoteMeds)
        }
        runCatching {
            val remoteHist = remoteApi.getDoseHistory("eq.$userId")
            val entities = remoteHist.map { h ->
                DoseHistoryEntity(
                    id = h.id,
                    medId = h.medId,
                    userId = h.userId,
                    hora = h.hora,
                    doseDateIso = h.createdAt.take(10),
                    status = h.status,
                    atrasoMinutos = h.atrasoMinutos,
                    quantidadeUsada = h.quantidadeUsada,
                    isRetroactive = h.isRetroactive,
                    correctionReason = h.correctionReason,
                    confirmedByName = h.confirmedByName,
                    confirmedByRole = h.confirmedByRole,
                    createdAt = h.createdAt,
                    pendingSync = false
                )
            }
            dao.upsertDoseHistoryList(entities)
        }
    }

    // ─── Confirmação Idempotente de Dose (Offline-First) ──────────────────────
    suspend fun confirmDose(dose: ScheduledDose, today: LocalDate = LocalDate.now()): DoseHistoryRecord? {
        return confirmDoseByMedAndHora(medId = dose.medId, hora = dose.hora, today = today)
    }

    suspend fun confirmDoseByMedAndHora(
        medId: String,
        hora: String,
        today: LocalDate = LocalDate.now()
    ): DoseHistoryRecord? {
        val user = sessionManager.currentUser.value ?: return null
        val todayIso = today.toString()

        val existing = dao.findExistingDoseForDay(user.id, medId, hora, todayIso)
        if (existing != null && existing.status == "confirmed") {
            alarmScheduler.onDoseConfirmed(medId, hora)
            return existing.toDomain()
        }

        val parts = hora.split(":")
        val plannedTime = LocalTime.of(
            parts.getOrNull(0)?.toIntOrNull() ?: 8,
            parts.getOrNull(1)?.toIntOrNull() ?: 0
        )
        val delayMin = max(0L, ChronoUnit.MINUTES.between(plannedTime, LocalTime.now())).toInt()

        val recordId = existing?.id ?: UUID.randomUUID().toString()
        val nowIso = Instant.now().toString()

        val entity = DoseHistoryEntity(
            id = recordId,
            medId = medId,
            userId = user.id,
            hora = hora,
            doseDateIso = todayIso,
            status = "confirmed",
            atrasoMinutos = delayMin,
            quantidadeUsada = 1,
            isRetroactive = false,
            correctionReason = null,
            confirmedByName = user.nome,
            confirmedByRole = user.role,
            createdAt = nowIso,
            pendingSync = true
        )
        dao.upsertDoseHistory(entity)

        val medEntity = dao.getMedicationById(medId)
        if (medEntity != null) {
            val newQty = max(0, medEntity.quantidade - 1)
            dao.upsertMedication(medEntity.copy(quantidade = newQty, pendingSync = true))
        }

        alarmScheduler.onDoseConfirmed(medId, hora)

        val domainRecord = entity.toDomain()
        if (isRemoteConfigured) {
            val synced = runCatching {
                remoteApi.insertDoseHistory(domainRecord)
                if (medEntity != null) {
                    remoteApi.updateMedication("eq.$medId", mapOf("quantidade" to max(0, medEntity.quantidade - 1)))
                }
                dao.upsertDoseHistory(entity.copy(pendingSync = false))
                true
            }.getOrDefault(false)

            if (!synced) {
                enqueueSync("CONFIRM_DOSE", recordId, json.encodeToString(domainRecord))
            }
        }
        return domainRecord
    }

    suspend fun undoDoseConfirmation(dose: ScheduledDose) {
        val histId = dose.histId ?: return
        dao.markDoseAsPending(histId, pendingSync = true)

        val medEntity = dao.getMedicationById(dose.medId)
        if (medEntity != null) {
            val restoredQty = medEntity.quantidade + 1
            dao.upsertMedication(medEntity.copy(quantidade = restoredQty, pendingSync = true))
            alarmScheduler.scheduleNextOccurrence(medEntity.toDomain(json), dose.hora)
        }

        if (isRemoteConfigured) {
            val synced = runCatching {
                remoteApi.updateDoseHistoryStatus("eq.$histId", mapOf("status" to "pending"))
                if (medEntity != null) {
                    remoteApi.updateMedication("eq.${dose.medId}", mapOf("quantidade" to (medEntity.quantidade + 1)))
                }
                dao.markDoseAsPending(histId, pendingSync = false)
                true
            }.getOrDefault(false)

            if (!synced) {
                enqueueSync("UNDO_DOSE", histId, histId)
            }
        }
    }

    // ─── Uso de Medicamento SOS (com Horário, Motivo e Quantidade) ────────────
    suspend fun registerSosUse(
        med: Medication,
        hora: String? = null,
        quantityUsed: Int = 1,
        observation: String? = null
    ) {
        val user = sessionManager.currentUser.value ?: return
        val nowTime = LocalTime.now()
        val effectiveHora = hora?.takeIf { it.isNotBlank() } ?: "%02d:%02d".format(nowTime.hour, nowTime.minute)
        val todayIso = LocalDate.now().toString()
        val recordId = UUID.randomUUID().toString()

        val entity = DoseHistoryEntity(
            id = recordId,
            medId = med.id,
            userId = user.id,
            hora = effectiveHora,
            doseDateIso = "$todayIso-sos-$recordId",
            status = "confirmed",
            atrasoMinutos = 0,
            quantidadeUsada = quantityUsed,
            isRetroactive = false,
            correctionReason = observation,
            confirmedByName = user.nome,
            confirmedByRole = user.role,
            createdAt = Instant.now().toString(),
            pendingSync = true
        )
        dao.upsertDoseHistory(entity)

        val newQty = max(0, med.quantidade - quantityUsed)
        dao.upsertMedication(MedicationEntity.fromDomain(med.copy(quantidade = newQty), pendingSync = true, json = json))

        if (isRemoteConfigured) {
            val domainRecord = entity.toDomain()
            val synced = runCatching {
                remoteApi.insertDoseHistory(domainRecord)
                remoteApi.updateMedication("eq.${med.id}", mapOf("quantidade" to newQty))
                true
            }.getOrDefault(false)
            if (!synced) {
                enqueueSync("CONFIRM_DOSE", recordId, json.encodeToString(domainRecord))
            }
        }
    }

    // ─── Confirmação Retroativa com Auditoria e Trava de 24h ──────────────────
    suspend fun confirmDoseRetroactive(
        medId: String,
        hora: String,
        doseDateIso: String,
        reason: String?
    ): Result<Unit> {
        val user = sessionManager.currentUser.value ?: return Result.failure(Exception("Sessão inativa"))
        if (user.role == "paciente") {
            val doseDate = LocalDate.parse(doseDateIso)
            val daysDiff = ChronoUnit.DAYS.between(doseDate, LocalDate.now())
            if (daysDiff > 1) {
                return Result.failure(Exception("Pacientes supervisionados só podem registrar doses retroativas nas últimas 24 horas."))
            }
        }

        val recordId = UUID.randomUUID().toString()
        val createdAtIso = "${doseDateIso}T${hora}:00Z"
        val entity = DoseHistoryEntity(
            id = recordId,
            medId = medId,
            userId = user.id,
            hora = hora,
            doseDateIso = doseDateIso,
            status = "confirmed",
            atrasoMinutos = 0,
            quantidadeUsada = 1,
            isRetroactive = true,
            correctionReason = reason,
            confirmedByName = user.nome,
            confirmedByRole = user.role,
            createdAt = createdAtIso,
            pendingSync = true
        )
        dao.upsertDoseHistory(entity)

        if (isRemoteConfigured) {
            runCatching {
                remoteApi.confirmDoseRetroactive(
                    RetroactiveDoseRpcRequest(
                        patientId = user.id,
                        medId = medId,
                        hora = hora,
                        doseDate = doseDateIso,
                        newStatus = "confirmed",
                        reason = reason
                    )
                )
            }
        }
        return Result.success(Unit)
    }

    // ─── Gestão de Medicamentos e Tratamentos ─────────────────────────────────
    suspend fun saveMedication(medication: Medication) {
        val entity = MedicationEntity.fromDomain(medication, pendingSync = true, json = json)
        dao.upsertMedication(entity)

        if (alarmScheduler.shouldScheduleMedication(medication)) {
            alarmScheduler.scheduleAllActiveMedications(listOf(medication))
        } else {
            alarmScheduler.cancelAllAlarmsForMedication(medication)
        }

        if (isRemoteConfigured) {
            val synced = runCatching {
                remoteApi.upsertMedication(medication)
                dao.upsertMedication(entity.copy(pendingSync = false))
                true
            }.getOrDefault(false)
            if (!synced) {
                enqueueSync("UPSERT_MED", medication.id, json.encodeToString(medication))
            }
        }
    }

    suspend fun repeatTreatment(med: Medication, durationDays: Int) {
        val startIso = LocalDate.now().toString()
        val endIso = DoseCalculator.computeEndDate(startIso, durationDays)
        val reopened = med.copy(
            ativo = true,
            status = "ativo",
            startDate = startIso,
            endDate = endIso,
            treatmentDays = durationDays,
            finishedAt = null
        )
        saveMedication(reopened)
    }

    suspend fun deleteMedication(med: Medication) {
        alarmScheduler.cancelAllAlarmsForMedication(med)
        dao.deleteMedication(med.id)
        if (isRemoteConfigured) {
            val synced = runCatching {
                remoteApi.deleteMedication("eq.${med.id}")
                true
            }.getOrDefault(false)
            if (!synced) {
                enqueueSync("DELETE_MED", med.id, med.id)
            }
        }
    }

    // ─── Movimentação Completa de Estoque (Compra / Ajuste / Correção) ────────
    suspend fun recordStockMovement(
        med: Medication,
        movementType: String,
        newQuantity: Int,
        purchasePrice: Double? = null,
        purchaseLocation: String? = null,
        batch: String? = null,
        expirationDate: String? = null,
        notes: String? = null
    ) {
        val movement = StockMovementEntity(
            id = UUID.randomUUID().toString(),
            medicationId = med.id,
            movementType = movementType,
            quantityBefore = med.quantidade,
            quantityAfter = newQuantity,
            quantityDelta = newQuantity - med.quantidade,
            purchasePrice = purchasePrice,
            purchaseLocation = purchaseLocation,
            batch = batch,
            expirationDate = expirationDate,
            notes = notes,
            createdAt = Instant.now().toString(),
            pendingSync = true
        )
        dao.upsertStockMovement(movement)
        saveMedication(med.copy(quantidade = newQuantity))

        if (newQuantity > med.quantidade) {
            saveHealthEvent(
                HealthEvent(
                    id = UUID.randomUUID().toString(),
                    userId = med.userId,
                    type = "estoque",
                    title = "Reposição de estoque: ${med.nome}",
                    description = buildString {
                        append("${med.quantidade} ➔ $newQuantity ${med.unidade}s")
                        if (!purchaseLocation.isNullOrBlank()) append(" · $purchaseLocation")
                    },
                    date = LocalDate.now().toString(),
                    time = "%02d:%02d".format(LocalTime.now().hour, LocalTime.now().minute),
                    createdAt = Instant.now().toString()
                )
            )
        }

        if (isRemoteConfigured) {
            runCatching {
                remoteApi.recordStockMovement(
                    StockMovementRpcRequest(
                        medicationId = med.id,
                        movementType = movementType,
                        quantityBefore = med.quantidade,
                        quantityAfter = newQuantity,
                        purchasePrice = purchasePrice,
                        purchaseLocation = purchaseLocation,
                        notes = notes
                    )
                )
            }
        }
    }

    // ─── Calendário (Eventos, Notas e Observações de Doses) ───────────────────
    suspend fun saveHealthEvent(event: HealthEvent) {
        dao.upsertHealthEvent(
            HealthEventEntity(
                id = event.id,
                userId = event.userId,
                type = event.type,
                title = event.title,
                description = event.description,
                date = event.date,
                time = event.time,
                doctor = event.doctor,
                location = event.location,
                createdAt = event.createdAt
            )
        )
    }

    suspend fun deleteHealthEvent(id: String) {
        dao.deleteHealthEvent(id)
    }

    suspend fun saveCalendarNote(note: CalendarNote) {
        dao.upsertCalendarNote(
            CalendarNoteEntity(
                id = note.id,
                userId = note.userId,
                date = note.date,
                content = note.content,
                mood = note.mood,
                createdAt = note.createdAt
            )
        )
    }

    suspend fun deleteCalendarNote(id: String) {
        dao.deleteCalendarNote(id)
    }

    suspend fun saveDoseObservation(doseKey: String, content: String) {
        val user = sessionManager.currentUser.value ?: return
        dao.upsertDoseObservation(
            DoseObservationEntity(
                id = "obs-$doseKey",
                userId = user.id,
                doseKey = doseKey,
                content = content,
                createdAt = Instant.now().toString()
            )
        )
    }

    // ─── Perfil: Saúde, Contatos, Profissionais e Cuidadores ──────────────────
    suspend fun saveAllergy(item: AllergyItem) {
        dao.upsertAllergy(AllergyEntity(item.id, item.userId, item.name, item.reaction, item.severity))
    }

    suspend fun deleteAllergy(id: String) {
        dao.deleteAllergy(id)
    }

    suspend fun saveHealthCondition(item: HealthConditionItem) {
        dao.upsertHealthCondition(HealthConditionEntity(item.id, item.userId, item.name, item.notes))
    }

    suspend fun deleteHealthCondition(id: String) {
        dao.deleteHealthCondition(id)
    }

    suspend fun saveEmergencyContact(item: EmergencyContact) {
        dao.upsertEmergencyContact(
            EmergencyContactEntity(item.id, item.userId, item.name, item.relation, item.phone, item.observation, item.priority)
        )
    }

    suspend fun deleteEmergencyContact(id: String) {
        dao.deleteEmergencyContact(id)
    }

    suspend fun saveHealthcareProfessional(item: HealthcareProfessional) {
        dao.upsertHealthcareProfessional(
            HealthcareProfessionalEntity(
                item.id, item.userId, item.name, item.specialty, item.phone, item.crm, item.location, item.observation
            )
        )
    }

    suspend fun deleteHealthcareProfessional(id: String) {
        dao.deleteHealthcareProfessional(id)
    }

    suspend fun createCaregiverInvite(email: String?, label: String, permissionLevel: String): CaregiverRelationship? {
        val user = sessionManager.currentUser.value ?: return null
        val token = UUID.randomUUID().toString().replace("-", "").take(16)
        val rel = CaregiverRelationship(
            id = "cg-${UUID.randomUUID().toString().take(8)}",
            patientId = user.id,
            caregiverId = null,
            permissionLevel = permissionLevel,
            relationshipLabel = label.ifBlank { "Familiar / Cuidador" },
            inviteEmail = email?.takeIf { it.isNotBlank() },
            inviteToken = token,
            status = "pending",
            caregiverName = email?.substringBefore("@")?.replaceFirstChar { it.uppercase() } ?: label,
            createdAt = Instant.now().toString()
        )
        dao.upsertCaregiver(
            CaregiverRelationshipEntity(
                id = rel.id,
                patientId = rel.patientId,
                caregiverId = rel.caregiverId,
                permissionLevel = rel.permissionLevel,
                relationshipLabel = rel.relationshipLabel,
                inviteEmail = rel.inviteEmail,
                inviteToken = rel.inviteToken,
                status = rel.status,
                caregiverName = rel.caregiverName,
                createdAt = rel.createdAt
            )
        )
        if (isRemoteConfigured) {
            runCatching { remoteApi.createCaregiverInvite(rel) }
        }
        return rel
    }

    suspend fun updateCaregiverRelationship(rel: CaregiverRelationship) {
        dao.upsertCaregiver(
            CaregiverRelationshipEntity(
                id = rel.id,
                patientId = rel.patientId,
                caregiverId = rel.caregiverId,
                permissionLevel = rel.permissionLevel,
                relationshipLabel = rel.relationshipLabel,
                inviteEmail = rel.inviteEmail,
                inviteToken = rel.inviteToken,
                status = rel.status,
                caregiverName = rel.caregiverName,
                createdAt = rel.createdAt
            )
        )
    }

    // ─── Assistente de IA Seguro ──────────────────────────────────────────────
    suspend fun askAiAssistant(userQuestion: String, activeMeds: List<Medication>): String {
        val medsContext = if (activeMeds.isEmpty()) {
            "Nenhum medicamento cadastrado."
        } else {
            activeMeds.joinToString("; ") { "${it.nome} (${it.dosagem}, horários: ${it.horarios.joinToString(",")})" }
        }
        val prompt = buildString {
            appendLine("Você é o Assistente Farmacêutico do MediCare.")
            appendLine("Sempre inclua um aviso de que suas orientações são informativas e não substituem avaliação médica.")
            appendLine("Medicamentos atuais do paciente: $medsContext")
            appendLine("Pergunta do paciente: $userQuestion")
        }

        return runCatching {
            val response = aiApi.askAssistant(AiPromptRequest(prompt = prompt))
            response.text ?: response.error ?: "Não foi possível obter resposta no momento."
        }.getOrElse {
            buildOfflineAssistantAnswer(userQuestion, activeMeds)
        }
    }

    private fun buildOfflineAssistantAnswer(question: String, activeMeds: List<Medication>): String {
        val q = question.lowercase()
        val medMatch = activeMeds.firstOrNull { q.contains(it.nome.lowercase().split(" ").first()) }
        return buildString {
            if (medMatch != null) {
                appendLine("💊 **${medMatch.nome} (${medMatch.dosagem})**")
                if (!medMatch.activeIngredient.isNullOrBlank()) {
                    appendLine("• Princípio ativo: ${medMatch.activeIngredient}")
                }
                appendLine("• Horários programados: ${medMatch.horarios.ifEmpty { listOf("Uso SOS") }.joinToString(", ")}")
                if (!medMatch.observacoes.isNullOrBlank()) {
                    appendLine("• Orientação registrada: ${medMatch.observacoes}")
                }
                appendLine("• Estoque atual: ${medMatch.quantidade} ${medMatch.unidade}(s)")
            } else {
                appendLine("🩺 **Orientação do Assistente de Saúde**")
                appendLine("Você possui atualmente **${activeMeds.size} medicamento(s)** cadastrado(s): ${activeMeds.joinToString(", ") { "${it.nome} ${it.dosagem}" }.")
                appendLine("Para melhor eficácia do tratamento, mantenha os horários regulares com água e nunca interrompa medicamentos de uso contínuo sem falar com seu médico.")
            }
            appendLine()
            append("ℹ️ *Esta explicação é apenas informativa e não substitui a orientação do seu médico ou farmacêutico.*")
        }
    }

    // ─── Processamento da Fila de Sincronização Offline (WorkManager) ─────────
    suspend fun flushPendingSyncQueue(): Boolean {
        if (!isRemoteConfigured) return true
        val actions = dao.getPendingSyncActions()
        var allSuccess = true

        for (action in actions) {
            val ok = runCatching {
                when (action.actionType) {
                    "CONFIRM_DOSE" -> {
                        val record = json.decodeFromString<DoseHistoryRecord>(action.payloadJson)
                        remoteApi.insertDoseHistory(record)
                    }
                    "UNDO_DOSE" -> {
                        remoteApi.updateDoseHistoryStatus("eq.${action.entityId}", mapOf("status" to "pending"))
                    }
                    "UPSERT_MED" -> {
                        val med = json.decodeFromString<Medication>(action.payloadJson)
                        remoteApi.upsertMedication(med)
                    }
                    "DELETE_MED" -> {
                        remoteApi.deleteMedication("eq.${action.entityId}")
                    }
                }
                true
            }.getOrDefault(false)

            if (ok) {
                dao.removeSyncAction(action)
            } else {
                allSuccess = false
            }
        }
        return allSuccess
    }

    private suspend fun enqueueSync(actionType: String, entityId: String, payloadJson: String) {
        dao.enqueueSyncAction(
            PendingSyncActionEntity(
                actionType = actionType,
                entityId = entityId,
                payloadJson = payloadJson
            )
        )
        SyncWorker.enqueueImmediateSync(context)
    }

    suspend fun seedDefaultDataIfEmpty(userId: String) {
        val current = dao.getMedications(userId)
        if (current.isNotEmpty()) return

        val defaults = listOf(
            Medication(
                id = "med-1",
                userId = userId,
                nome = "Losartana Potássica",
                dosagem = "50mg",
                unidade = "comprimido",
                cor = "#3b82f6",
                quantidade = 24,
                avisoEstoque = 5,
                horarios = listOf("08:00", "20:00"),
                observacoes = "Tomar com água pela manhã e à noite",
                treatmentType = "continuous",
                activeIngredient = "Losartana potássica",
                manufacturer = "Medley",
                importantForEmergency = true
            ),
            Medication(
                id = "med-2",
                userId = userId,
                nome = "Amoxicilina",
                dosagem = "500mg",
                unidade = "cápsula",
                cor = "#f59e0b",
                quantidade = 14,
                avisoEstoque = 4,
                horarios = listOf("08:00", "16:00", "22:00"),
                observacoes = "Antibiótico de 7 dias — não interromper antes do fim",
                treatmentType = "temporary",
                startDate = LocalDate.now().minusDays(2).toString(),
                endDate = LocalDate.now().plusDays(4).toString(),
                treatmentDays = 7,
                activeIngredient = "Amoxicilina tri-hidratada",
                manufacturer = "EMS",
                importantForEmergency = true
            ),
            Medication(
                id = "med-3",
                userId = userId,
                nome = "Dipirona Monoidratada",
                dosagem = "1g",
                unidade = "comprimido",
                cor = "#8b5cf6",
                quantidade = 4,
                avisoEstoque = 5,
                horarios = emptyList(),
                observacoes = "Apenas se houver dor ou febre acima de 37,8°C",
                treatmentType = "sos",
                activeIngredient = "Dipirona monoidratada",
                manufacturer = "Sanofi",
                importantForEmergency = false
            )
        )
        dao.upsertMedications(defaults.map { MedicationEntity.fromDomain(it, pendingSync = false, json = json) })
        alarmScheduler.scheduleAllActiveMedications(defaults)

        // Sementes iniciais de Saúde, Contatos, Profissionais, Cuidadores e Estoque
        dao.upsertAllergy(AllergyEntity("alg-1", userId, "Penicilina", "Urticária e vermelhidão", "Moderada"))
        dao.upsertHealthCondition(HealthConditionEntity("cond-1", userId, "Hipertensão Arterial Sistêmica", "Controlada com Losartana 50mg"))
        dao.upsertEmergencyContact(EmergencyContactEntity("ec-1", userId, "Carlos Eduardo Silva", "Filho", "(11) 99876-5432", "Mora a 10 minutos", 1))
        dao.upsertEmergencyContact(EmergencyContactEntity("ec-2", userId, "Ana Paula Silva", "Filha", "(11) 99123-4567", "Plantão noturno", 2))
        dao.upsertHealthcareProfessional(
            HealthcareProfessionalEntity(
                "prof-1", userId, "Dr. Roberto Almeida", "Cardiologista", "(11) 3210-9876", "CRM-SP 112233", "Hospital Sírio-Libanês", "Retorno semestral"
            )
        )
        dao.upsertCaregiver(
            CaregiverRelationshipEntity(
                id = "cg-1",
                patientId = userId,
                caregiverId = "caregiver-carlos",
                permissionLevel = "caregiver",
                relationshipLabel = "Filho",
                inviteEmail = "carlos.silva@email.com",
                inviteToken = "tok8912medicare",
                status = "active",
                caregiverName = "Carlos Eduardo Silva",
                createdAt = LocalDate.now().minusDays(20).toString()
            )
        )
        dao.upsertStockMovement(
            StockMovementEntity(
                id = "sm-1",
                medicationId = "med-1",
                movementType = "purchase",
                quantityBefore = 4,
                quantityAfter = 34,
                quantityDelta = 30,
                purchasePrice = 18.90,
                purchaseLocation = "Drogasil Paulista",
                batch = "L2409A",
                expirationDate = "2027-08-30",
                notes = "Caixa com 30 comprimidos",
                createdAt = LocalDate.now().minusDays(3).toString() + "T14:20:00Z"
            )
        )
        dao.upsertHealthEvent(
            HealthEventEntity(
                id = "ev-1",
                userId = userId,
                type = "consulta",
                title = "Retorno Cardiologia",
                description = "Levar exames de sangue e mapa de pressão",
                date = LocalDate.now().plusDays(4).toString(),
                time = "14:30",
                doctor = "Dr. Roberto Almeida",
                location = "Clínica CardioVida — Sala 402",
                createdAt = Instant.now().toString()
            )
        )
    }
}
