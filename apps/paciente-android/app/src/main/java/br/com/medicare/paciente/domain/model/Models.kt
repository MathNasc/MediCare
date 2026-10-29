package br.com.medicare.paciente.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class UserRole(val code: String, val label: String, val description: String) {
    @SerialName("independente")
    INDEPENDENTE(
        "independente",
        "Independente",
        "Utilize de forma independente, tenha acesso a todas as funcionalidades"
    ),
    @SerialName("paciente")
    PACIENTE(
        "paciente",
        "Paciente",
        "Utilize junto com um cuidador, ele poderá gerenciar sua medicação, estoque e confirmar doses retroativamente"
    );

    companion object {
        fun fromCode(code: String?): UserRole =
            entries.find { it.code.equals(code, ignoreCase = true) } ?: INDEPENDENTE
    }
}

@Serializable
enum class TreatmentType(
    val code: String,
    val label: String,
    val shortLabel: String,
    val icon: String,
    val colorHex: Long,
    val description: String
) {
    @SerialName("continuous")
    CONTINUOUS(
        code = "continuous",
        label = "Uso Contínuo",
        shortLabel = "Contínuo",
        icon = "🟢",
        colorHex = 0xFF22C55E,
        description = "Utilizado continuamente, sem data de término. Gera lembretes diários."
    ),
    @SerialName("temporary")
    TEMPORARY(
        code = "temporary",
        label = "Tratamento Temporário",
        shortLabel = "Temporário",
        icon = "🟡",
        colorHex = 0xFFF59E0B,
        description = "Utilizado durante um período específico. Encerra automaticamente ao final."
    ),
    @SerialName("sos")
    SOS(
        code = "sos",
        label = "Uso Sob Demanda (SOS)",
        shortLabel = "SOS",
        icon = "🔵",
        colorHex = 0xFF3B82F6,
        description = "Utilizado apenas quando necessário. Não gera lembretes automáticos."
    );

    companion object {
        fun fromCode(code: String?): TreatmentType =
            entries.find { it.code.equals(code, ignoreCase = true) } ?: CONTINUOUS
    }
}

enum class DoseStatus(
    val code: String,
    val label: String,
    val colorHex: Long,
    val bgAlpha: Float = 0.15f
) {
    SCHEDULED("scheduled", "Agendado", 0xFF8B949E, 0.12f),
    UPCOMING("upcoming", "Em breve", 0xFF3B82F6, 0.15f),
    PENDING("pending", "Pendente", 0xFFF59E0B, 0.15f),
    LATE("late", "Atrasado", 0xFFEF4444, 0.15f),
    MISSED("missed", "Perdida", 0xFF64748B, 0.15f),
    CONFIRMED("confirmed", "Confirmada", 0xFF22C55E, 0.15f);

    companion object {
        fun fromCode(code: String?): DoseStatus =
            entries.find { it.code.equals(code, ignoreCase = true) } ?: SCHEDULED
    }
}

@Serializable
data class EmergencyCardSettings(
    @SerialName("show_allergies") val showAllergies: Boolean = true,
    @SerialName("show_conditions") val showConditions: Boolean = true,
    @SerialName("show_medications") val showMedications: Boolean = true,
    @SerialName("show_contacts") val showContacts: Boolean = true,
    @SerialName("show_notes") val showNotes: Boolean = true,
    @SerialName("emergency_notes") val emergencyNotes: String = ""
)

@Serializable
data class UserProfile(
    val id: String,
    val nome: String,
    val email: String,
    val role: String = "independente",
    @SerialName("social_name") val socialName: String? = null,
    @SerialName("blood_type") val bloodType: String? = "O+",
    @SerialName("tipo_sanguineo") val tipoSanguineo: String? = "O+",
    val dob: String? = "1958-05-14",
    @SerialName("data_nascimento") val dataNascimento: String? = "1958-05-14",
    val sex: String? = "Feminino",
    val cpf: String? = null,
    val phone: String? = "(11) 98765-4321",
    val telefone: String? = "(11) 98765-4321",
    val address: String? = null,
    val weight: String? = "68",
    val height: String? = "165",
    @SerialName("cartao_sus") val cartaoSus: String? = null,
    @SerialName("plano_saude") val planoSaude: String? = null,
    @SerialName("role_change_pin") val roleChangePin: String? = "123456",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = true,
    @SerialName("emergency_settings") val emergencySettings: EmergencyCardSettings = EmergencyCardSettings()
)

@Serializable
data class Medication(
    val id: String,
    @SerialName("user_id") val userId: String,
    val nome: String,
    val dosagem: String,
    val unidade: String = "comprimido",
    val cor: String = "#3b82f6",
    val quantidade: Int = 30,
    @SerialName("aviso_estoque") val avisoEstoque: Int = 5,
    val horarios: List<String> = listOf("08:00"),
    @SerialName("dias_semana") val diasSemana: List<Int> = listOf(0, 1, 2, 3, 4, 5, 6),
    val observacoes: String? = null,
    val ativo: Boolean = true,
    val status: String = "ativo",
    @SerialName("treatment_type") val treatmentType: String = "continuous",
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("treatment_days") val treatmentDays: Int? = null,
    @SerialName("finished_at") val finishedAt: String? = null,
    @SerialName("active_ingredient") val activeIngredient: String? = null,
    val manufacturer: String? = null,
    @SerialName("important_for_emergency") val importantForEmergency: Boolean = true,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class DoseHistoryRecord(
    val id: String,
    @SerialName("med_id") val medId: String,
    @SerialName("user_id") val userId: String,
    val hora: String,
    val status: String = "confirmed",
    @SerialName("atraso_minutos") val atrasoMinutos: Int = 0,
    @SerialName("quantidade_usada") val quantidadeUsada: Int = 1,
    @SerialName("is_retroactive") val isRetroactive: Boolean = false,
    @SerialName("correction_reason") val correctionReason: String? = null,
    @SerialName("confirmed_by_name") val confirmedByName: String? = null,
    @SerialName("confirmed_by_role") val confirmedByRole: String? = null,
    @SerialName("created_at") val createdAt: String
)

data class ScheduledDose(
    val id: String,
    val medId: String,
    val nome: String,
    val dosagem: String,
    val unidade: String,
    val cor: String,
    val treatmentType: TreatmentType,
    val hora: String,
    val status: DoseStatus,
    val histId: String? = null,
    val histIds: List<String> = emptyList(),
    val quantidadeUsada: Int = 0
)

data class TreatmentProgress(
    val dayNumber: Int,
    val totalDays: Int,
    val percent: Int,
    val isExpired: Boolean,
    val notStarted: Boolean
)

@Serializable
data class StockMovement(
    val id: String,
    @SerialName("medication_id") val medicationId: String,
    @SerialName("movement_type") val movementType: String, // purchase, adjustment, correction, initial, consumption
    @SerialName("quantity_before") val quantityBefore: Int,
    @SerialName("quantity_after") val quantityAfter: Int,
    @SerialName("quantity_delta") val quantityDelta: Int,
    @SerialName("purchase_price") val purchasePrice: Double? = null,
    @SerialName("purchase_location") val purchaseLocation: String? = null,
    val batch: String? = null,
    @SerialName("expiration_date") val expirationDate: String? = null,
    val notes: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class StockForecast(
    @SerialName("med_id") val medId: String,
    val nome: String,
    val dosagem: String,
    val quantidade: Int,
    @SerialName("doses_per_day") val dosesPerDay: Int,
    @SerialName("days_remaining") val daysRemaining: Int,
    @SerialName("depletion_date") val depletionDate: String
)

@Serializable
data class HealthEvent(
    val id: String,
    @SerialName("user_id") val userId: String,
    val type: String, // consulta, exame, procedimento, estoque, lembrete, outro
    val title: String,
    val description: String? = null,
    val date: String, // YYYY-MM-DD
    val time: String? = null,
    val doctor: String? = null,
    val location: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class CalendarNote(
    val id: String,
    @SerialName("user_id") val userId: String,
    val date: String, // YYYY-MM-DD
    val content: String,
    val mood: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class DoseObservation(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("dose_key") val doseKey: String, // YYYY-MM-DD_medId_hora
    val content: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class CaregiverRelationship(
    val id: String,
    @SerialName("patient_id") val patientId: String,
    @SerialName("caregiver_id") val caregiverId: String? = null,
    @SerialName("permission_level") val permissionLevel: String = "viewer", // viewer, caregiver, admin
    @SerialName("relationship_label") val relationshipLabel: String? = null,
    @SerialName("invite_email") val inviteEmail: String? = null,
    @SerialName("invite_token") val inviteToken: String? = null,
    val status: String = "pending", // active, pending, revoked
    @SerialName("caregiver_name") val caregiverName: String? = null,
    @SerialName("created_at") val createdAt: String = "2026-03-01T10:00:00Z"
)

@Serializable
data class EmergencyContact(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val relation: String,
    val phone: String,
    val observation: String? = null,
    val priority: Int = 1
)

@Serializable
data class AllergyItem(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val reaction: String? = null,
    val severity: String = "Moderada" // Leve, Moderada, Grave
)

@Serializable
data class HealthConditionItem(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val notes: String? = null
)

@Serializable
data class HealthcareProfessional(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val specialty: String,
    val phone: String? = null,
    val crm: String? = null,
    val location: String? = null,
    val observation: String? = null
)
