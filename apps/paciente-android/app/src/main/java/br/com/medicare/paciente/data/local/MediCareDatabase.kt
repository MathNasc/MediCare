package br.com.medicare.paciente.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        MedicationEntity::class,
        DoseHistoryEntity::class,
        HealthEventEntity::class,
        CalendarNoteEntity::class,
        DoseObservationEntity::class,
        StockMovementEntity::class,
        AllergyEntity::class,
        HealthConditionEntity::class,
        EmergencyContactEntity::class,
        HealthcareProfessionalEntity::class,
        CaregiverRelationshipEntity::class,
        PendingSyncActionEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class MediCareDatabase : RoomDatabase() {
    abstract fun dao(): MediCareDao
}
