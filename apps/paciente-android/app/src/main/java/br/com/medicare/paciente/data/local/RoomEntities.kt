package br.com.medicare.paciente.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import br.com.medicare.paciente.domain.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Entity(tableName = "medications")
data class MedicationEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val nome: String,
    val dosagem: String,
    val unidade: String,
    val cor: String,
    val quantidade: Int,
    val avisoEstoque: Int,
    val horariosJson: String,
    val diasSemanaJson: String,
    val observacoes: String?,
    val ativo: Boolean,
    val status: String,
    val treatmentType: String,
    val startDate: String?,
    val endDate: String?,
    val treatmentDays: Int?,
    val finishedAt: String?,
    val activeIngredient: String?,
    val manufacturer: String?,
    val importantForEmergency: Boolean,
    val createdAt: String,
    val pendingSync: Boolean = false
) {
    fun toDomain(json: Json = Json { ignoreUnknownKeys = true }): Medication = Medication(
        id = id,
        userId = userId,
        nome = nome,
        dosagem = dosagem,
        unidade = unidade,
        cor = cor,
        quantidade = quantidade,
        avisoEstoque = avisoEstoque,
        horarios = runCatching { json.decodeFromString<List<String>>(horariosJson) }.getOrDefault(listOf("08:00")),
        diasSemana = runCatching { json.decodeFromString<List<Int>>(diasSemanaJson) }.getOrDefault(listOf(0, 1, 2, 3, 4, 5, 6)),
        observacoes = observacoes,
        ativo = ativo,
        status = status,
        treatmentType = treatmentType,
        startDate = startDate,
        endDate = endDate,
        treatmentDays = treatmentDays,
        finishedAt = finishedAt,
        activeIngredient = activeIngredient,
        manufacturer = manufacturer,
        importantForEmergency = importantForEmergency,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(med: Medication, pendingSync: Boolean = false, json: Json = Json): MedicationEntity =
            MedicationEntity(
                id = med.id,
                userId = med.userId,
                nome = med.nome,
                dosagem = med.dosagem,
                unidade = med.unidade,
                cor = med.cor,
                quantidade = med.quantidade,
                avisoEstoque = med.avisoEstoque,
                horariosJson = json.encodeToString(med.horarios),
                diasSemanaJson = json.encodeToString(med.diasSemana),
                observacoes = med.observacoes,
                ativo = med.ativo,
                status = med.status,
                treatmentType = med.treatmentType,
                startDate = med.startDate,
                endDate = med.endDate,
                treatmentDays = med.treatmentDays,
                finishedAt = med.finishedAt,
                activeIngredient = med.activeIngredient,
                manufacturer = med.manufacturer,
                importantForEmergency = med.importantForEmergency,
                createdAt = med.createdAt ?: java.time.Instant.now().toString(),
                pendingSync = pendingSync
            )
    }
}

@Entity(
    tableName = "dose_history",
    indices = [Index(value = ["userId", "medId", "hora", "doseDateIso"], unique = true)]
)
data class DoseHistoryEntity(
    @PrimaryKey val id: String,
    val medId: String,
    val userId: String,
    val hora: String,
    val doseDateIso: String,
    val status: String,
    val atrasoMinutos: Int,
    val quantidadeUsada: Int,
    val isRetroactive: Boolean,
    val correctionReason: String?,
    val confirmedByName: String?,
    val confirmedByRole: String?,
    val createdAt: String,
    val pendingSync: Boolean = false
) {
    fun toDomain(): DoseHistoryRecord = DoseHistoryRecord(
        id = id,
        medId = medId,
        userId = userId,
        hora = hora,
        status = status,
        atrasoMinutos = atrasoMinutos,
        quantidadeUsada = quantidadeUsada,
        isRetroactive = isRetroactive,
        correctionReason = correctionReason,
        confirmedByName = confirmedByName,
        confirmedByRole = confirmedByRole,
        createdAt = createdAt
    )
}

@Entity(tableName = "health_events")
data class HealthEventEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val type: String,
    val title: String,
    val description: String?,
    val date: String,
    val time: String?,
    val doctor: String?,
    val location: String?,
    val createdAt: String,
    val pendingSync: Boolean = false
) {
    fun toDomain(): HealthEvent = HealthEvent(
        id = id,
        userId = userId,
        type = type,
        title = title,
        description = description,
        date = date,
        time = time,
        doctor = doctor,
        location = location,
        createdAt = createdAt
    )
}

@Entity(tableName = "calendar_notes")
data class CalendarNoteEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val date: String,
    val content: String,
    val mood: String?,
    val createdAt: String,
    val pendingSync: Boolean = false
) {
    fun toDomain(): CalendarNote = CalendarNote(
        id = id,
        userId = userId,
        date = date,
        content = content,
        mood = mood,
        createdAt = createdAt
    )
}

@Entity(tableName = "dose_observations")
data class DoseObservationEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val doseKey: String,
    val content: String,
    val createdAt: String
) {
    fun toDomain(): DoseObservation = DoseObservation(
        id = id,
        userId = userId,
        doseKey = doseKey,
        content = content,
        createdAt = createdAt
    )
}

@Entity(tableName = "stock_movements")
data class StockMovementEntity(
    @PrimaryKey val id: String,
    val medicationId: String,
    val movementType: String,
    val quantityBefore: Int,
    val quantityAfter: Int,
    val quantityDelta: Int,
    val purchasePrice: Double?,
    val purchaseLocation: String?,
    val batch: String?,
    val expirationDate: String?,
    val notes: String?,
    val createdAt: String,
    val pendingSync: Boolean = false
) {
    fun toDomain(): StockMovement = StockMovement(
        id = id,
        medicationId = medicationId,
        movementType = movementType,
        quantityBefore = quantityBefore,
        quantityAfter = quantityAfter,
        quantityDelta = quantityDelta,
        purchasePrice = purchasePrice,
        purchaseLocation = purchaseLocation,
        batch = batch,
        expirationDate = expirationDate,
        notes = notes,
        createdAt = createdAt
    )
}

@Entity(tableName = "allergies")
data class AllergyEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val name: String,
    val reaction: String?,
    val severity: String
) {
    fun toDomain(): AllergyItem = AllergyItem(id, userId, name, reaction, severity)
}

@Entity(tableName = "health_conditions")
data class HealthConditionEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val name: String,
    val notes: String?
) {
    fun toDomain(): HealthConditionItem = HealthConditionItem(id, userId, name, notes)
}

@Entity(tableName = "emergency_contacts")
data class EmergencyContactEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val name: String,
    val relation: String,
    val phone: String,
    val observation: String?,
    val priority: Int
) {
    fun toDomain(): EmergencyContact = EmergencyContact(id, userId, name, relation, phone, observation, priority)
}

@Entity(tableName = "healthcare_professionals")
data class HealthcareProfessionalEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val name: String,
    val specialty: String,
    val phone: String?,
    val crm: String?,
    val location: String?,
    val observation: String?
) {
    fun toDomain(): HealthcareProfessional = HealthcareProfessional(id, userId, name, specialty, phone, crm, location, observation)
}

@Entity(tableName = "caregiver_relationships")
data class CaregiverRelationshipEntity(
    @PrimaryKey val id: String,
    val patientId: String,
    val caregiverId: String?,
    val permissionLevel: String,
    val relationshipLabel: String?,
    val inviteEmail: String?,
    val inviteToken: String?,
    val status: String,
    val caregiverName: String?,
    val createdAt: String
) {
    fun toDomain(): CaregiverRelationship = CaregiverRelationship(
        id = id,
        patientId = patientId,
        caregiverId = caregiverId,
        permissionLevel = permissionLevel,
        relationshipLabel = relationshipLabel,
        inviteEmail = inviteEmail,
        inviteToken = inviteToken,
        status = status,
        caregiverName = caregiverName,
        createdAt = createdAt
    )
}

@Entity(tableName = "pending_sync_queue")
data class PendingSyncActionEntity(
    @PrimaryKey(autoGenerate = true) val queueId: Long = 0,
    val actionType: String,
    val entityId: String,
    val payloadJson: String,
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)
