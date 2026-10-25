package br.com.medicare.paciente.data.remote

import br.com.medicare.paciente.domain.model.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.*

@Serializable
data class AuthRequest(
    val email: String,
    val password: String,
    val data: Map<String, String>? = null
)

@Serializable
data class AuthUserDto(
    val id: String,
    val email: String = "",
    @SerialName("user_metadata") val userMetadata: Map<String, String> = emptyMap(),
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class AuthSessionResponse(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    val user: AuthUserDto? = null
)

@Serializable
data class RetroactiveDoseRpcRequest(
    @SerialName("p_patient_id") val patientId: String,
    @SerialName("p_med_id") val medId: String,
    @SerialName("p_hora") val hora: String,
    @SerialName("p_dose_date") val doseDate: String,
    @SerialName("p_new_status") val newStatus: String = "confirmed",
    @SerialName("p_reason") val reason: String? = null
)

@Serializable
data class RpcStatusResponse(
    val success: Boolean = false,
    val id: String? = null,
    val action: String? = null,
    val error: String? = null
)

@Serializable
data class StockMovementRpcRequest(
    @SerialName("p_medication_id") val medicationId: String,
    @SerialName("p_movement_type") val movementType: String,
    @SerialName("p_quantity_before") val quantityBefore: Int,
    @SerialName("p_quantity_after") val quantityAfter: Int,
    @SerialName("p_purchase_price") val purchasePrice: Double? = null,
    @SerialName("p_purchase_location") val purchaseLocation: String? = null,
    @SerialName("p_notes") val notes: String? = null
)

@Serializable
data class ChangeRolePinRpcRequest(
    @SerialName("p_pin") val pin: String,
    @SerialName("p_new_role") val newRole: String
)

/**
 * Interface REST para o banco compartilhado (PostgREST + GoTrue Auth),
 * garantindo 100% de compatibilidade com o futuro MediCare Cuidador Web.
 */
interface MediCareRemoteApi {

    // ─── Auth (GoTrue) ────────────────────────────────────────────────────────
    @POST("auth/v1/token?grant_type=password")
    suspend fun signInWithPassword(@Body request: AuthRequest): AuthSessionResponse

    @POST("auth/v1/signup")
    suspend fun signUp(@Body request: AuthRequest): AuthSessionResponse

    @POST("auth/v1/recover")
    suspend fun resetPassword(@Body emailPayload: Map<String, String>)

    // ─── Profiles ─────────────────────────────────────────────────────────────
    @GET("rest/v1/profiles")
    suspend fun getProfile(
        @Query("id") idFilter: String, // "eq.<uuid>"
        @Query("select") select: String = "*"
    ): List<UserProfile>

    @Headers("Prefer: return=representation,resolution=merge-duplicates")
    @POST("rest/v1/profiles")
    suspend fun upsertProfile(@Body profile: UserProfile): List<UserProfile>

    // ─── Medicamentos ─────────────────────────────────────────────────────────
    @GET("rest/v1/medicamentos")
    suspend fun getMedications(
        @Query("user_id") userIdFilter: String, // "eq.<uuid>"
        @Query("order") order: String = "created_at.asc"
    ): List<Medication>

    @Headers("Prefer: return=representation,resolution=merge-duplicates")
    @POST("rest/v1/medicamentos")
    suspend fun upsertMedication(@Body medication: Medication): List<Medication>

    @PATCH("rest/v1/medicamentos")
    suspend fun updateMedication(
        @Query("id") idFilter: String,
        @Body updates: Map<String, @JvmSuppressWildcards Any?>
    )

    @DELETE("rest/v1/medicamentos")
    suspend fun deleteMedication(@Query("id") idFilter: String)

    // ─── Histórico de Doses ───────────────────────────────────────────────────
    @GET("rest/v1/historico_doses")
    suspend fun getDoseHistory(
        @Query("user_id") userIdFilter: String,
        @Query("order") order: String = "created_at.desc",
        @Query("limit") limit: Int = 500
    ): List<DoseHistoryRecord>

    @Headers("Prefer: return=representation")
    @POST("rest/v1/historico_doses")
    suspend fun insertDoseHistory(@Body record: DoseHistoryRecord): List<DoseHistoryRecord>

    @PATCH("rest/v1/historico_doses")
    suspend fun updateDoseHistoryStatus(
        @Query("id") idFilter: String,
        @Body statusPatch: Map<String, String>
    )

    // ─── RPCs Compartilhadas (Regras de Negócio no PostgreSQL) ────────────────
    @POST("rest/v1/rpc/confirm_dose_retroactive")
    suspend fun confirmDoseRetroactive(@Body request: RetroactiveDoseRpcRequest): RpcStatusResponse

    @POST("rest/v1/rpc/record_stock_movement")
    suspend fun recordStockMovement(@Body request: StockMovementRpcRequest): RpcStatusResponse

    @POST("rest/v1/rpc/get_all_stock_forecasts")
    suspend fun getAllStockForecasts(): List<StockForecast>

    @POST("rest/v1/rpc/finish_expired_treatments")
    suspend fun finishExpiredTreatments()

    @POST("rest/v1/rpc/change_role_with_pin")
    suspend fun changeRoleWithPin(@Body request: ChangeRolePinRpcRequest): RpcStatusResponse

    // ─── Cuidadores (Integração Paciente <-> Cuidador Web) ────────────────────
    @GET("rest/v1/caregiver_relationships")
    suspend fun getMyCaregivers(
        @Query("patient_id") patientIdFilter: String,
        @Query("status") statusFilter: String = "neq.revoked"
    ): List<CaregiverRelationship>

    @Headers("Prefer: return=representation")
    @POST("rest/v1/caregiver_relationships")
    suspend fun createCaregiverInvite(@Body relationship: CaregiverRelationship): List<CaregiverRelationship>

    @POST("rest/v1/rpc/revoke_caregiver")
    suspend fun revokeCaregiver(@Body payload: Map<String, String>): Boolean
}

@Serializable
data class AiPromptRequest(
    val prompt: String,
    val jsonMode: Boolean = false
)

@Serializable
data class AiPromptResponse(
    val text: String? = null,
    val error: String? = null
)

/**
 * Cliente para o proxy seguro de IA (/api/ai), evitando embutir GEMINI_API_KEY no APK.
 */
interface AiAssistantApi {
    @POST("api/ai")
    suspend fun askAssistant(@Body request: AiPromptRequest): AiPromptResponse
}
