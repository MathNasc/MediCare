package br.com.medicare.paciente.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        MedicationEntity::class,
        DoseHistoryEntity::class,
        HealthEventEntity::class,
        CalendarNoteEntity::class,
        StockMovementEntity::class,
        PendingSyncActionEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class MediCareDatabase : RoomDatabase() {
    abstract fun dao(): MediCareDao
}
