package br.com.medicare.paciente.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface MediCareDao {

    // ─── Medications ──────────────────────────────────────────────────────────
    @Query("SELECT * FROM medications WHERE userId = :userId ORDER BY createdAt ASC")
    fun observeMedications(userId: String): Flow<List<MedicationEntity>>

    @Query("SELECT * FROM medications WHERE userId = :userId ORDER BY createdAt ASC")
    suspend fun getMedications(userId: String): List<MedicationEntity>

    @Query("SELECT * FROM medications WHERE ativo = 1")
    suspend fun getAllActiveMedications(): List<MedicationEntity>

    @Query("SELECT * FROM medications WHERE id = :medId LIMIT 1")
    suspend fun getMedicationById(medId: String): MedicationEntity?

    @Upsert
    suspend fun upsertMedications(meds: List<MedicationEntity>)

    @Upsert
    suspend fun upsertMedication(med: MedicationEntity)

    @Query("DELETE FROM medications WHERE id = :medId")
    suspend fun deleteMedication(medId: String)

    // ─── Dose History (Idempotent) ────────────────────────────────────────────
    @Query("SELECT * FROM dose_history WHERE userId = :userId ORDER BY createdAt DESC LIMIT 500")
    fun observeDoseHistory(userId: String): Flow<List<DoseHistoryEntity>>

    @Query("SELECT * FROM dose_history WHERE userId = :userId ORDER BY createdAt DESC LIMIT 500")
    suspend fun getDoseHistory(userId: String): List<DoseHistoryEntity>

    @Query(
        """
        SELECT * FROM dose_history 
        WHERE userId = :userId AND medId = :medId AND hora = :hora AND doseDateIso = :doseDateIso 
        LIMIT 1
        """
    )
    suspend fun findExistingDoseForDay(
        userId: String,
        medId: String,
        hora: String,
        doseDateIso: String
    ): DoseHistoryEntity?

    @Upsert
    suspend fun upsertDoseHistory(record: DoseHistoryEntity)

    @Upsert
    suspend fun upsertDoseHistoryList(records: List<DoseHistoryEntity>)

    @Query("UPDATE dose_history SET status = 'pending', pendingSync = :pendingSync WHERE id = :histId")
    suspend fun markDoseAsPending(histId: String, pendingSync: Boolean)

    // ─── Health Events & Calendar Notes ───────────────────────────────────────
    @Query("SELECT * FROM health_events WHERE userId = :userId ORDER BY date ASC")
    fun observeHealthEvents(userId: String): Flow<List<HealthEventEntity>>

    @Upsert
    suspend fun upsertHealthEvent(event: HealthEventEntity)

    @Query("DELETE FROM health_events WHERE id = :id")
    suspend fun deleteHealthEvent(id: String)

    @Query("SELECT * FROM calendar_notes WHERE userId = :userId ORDER BY date DESC")
    fun observeCalendarNotes(userId: String): Flow<List<CalendarNoteEntity>>

    @Upsert
    suspend fun upsertCalendarNote(note: CalendarNoteEntity)

    @Query("DELETE FROM calendar_notes WHERE id = :id")
    suspend fun deleteCalendarNote(id: String)

    // ─── Stock Movements ──────────────────────────────────────────────────────
    @Query("SELECT * FROM stock_movements ORDER BY createdAt DESC LIMIT 100")
    fun observeStockMovements(): Flow<List<StockMovementEntity>>

    @Upsert
    suspend fun upsertStockMovement(movement: StockMovementEntity)

    // ─── Offline Pending Sync Queue ───────────────────────────────────────────
    @Query("SELECT * FROM pending_sync_queue ORDER BY createdAtEpochMs ASC")
    suspend fun getPendingSyncActions(): List<PendingSyncActionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueueSyncAction(action: PendingSyncActionEntity)

    @Delete
    suspend fun removeSyncAction(action: PendingSyncActionEntity)

    @Query("SELECT COUNT(*) FROM pending_sync_queue")
    fun observePendingSyncCount(): Flow<Int>
}
