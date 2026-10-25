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
    val activeIngredient: String?,
    val manufacturer: String?,
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
        diasSemana = runCatching { json.decodeFromString<List<Int>>(diasSemanaJson) }.getOrDefault(listOf(1, 2, 3, 4, 5, 6, 7)),
        observacoes = observacoes,
        ativo = ativo,
        status = status,
        treatmentType = treatmentType,
        startDate = startDate,
        endDate = endDate,
        treatmentDays = treatmentDays,
        activeIngredient = activeIngredient,
        manufacturer = manufacturer,
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
                activeIngredient = med.activeIngredient,
                manufacturer = med.manufacturer,
                createdAt = med.createdAt ?: java.time.Instant.now().toString(),
                pendingSync = pendingSync
            )
    }
}

/**
 * Índice único lógico por (userId, medId, hora, doseDateIso) garante idempotência offline
 * e impede duplicação de confirmação da mesma dose programada no mesmo dia.
 */
@Entity(
    tableName = "dose_history",
    indices = [Index(value = ["userId", "medId", "hora", "doseDateIso"], unique = true)]
)
data class DoseHistoryEntity(
    @PrimaryKey val id: String,
    val medId: String,
    val userId: String,
    val hora: String,
    val doseDateIso: String, // YYYY-MM-DD para guarda de idempotência
    val status: String,
    val atrasoMinutos: Int,
    val quantidadeUsada: Int,
    val isRetroactive: Boolean,
    val correctionReason: String?,
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
        notes = notes,
        createdAt = createdAt
    )
}

@Entity(tableName = "pending_sync_queue")
data class PendingSyncActionEntity(
    @PrimaryKey(autoGenerate = true) val queueId: Long = 0,
    val actionType: String, // CONFIRM_DOSE, UNDO_DOSE, UPSERT_MED, DELETE_MED, STOCK_MOVEMENT, RETROACTIVE_DOSE
    val entityId: String,
    val payloadJson: String,
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)
