package br.com.medicare.paciente.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import br.com.medicare.paciente.domain.model.UserProfile
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gerenciador de sessão seguro com criptografia AES-256-GCM (Android Keystore)
 * para tokens de acesso/refresh e preferências de acessibilidade do paciente.
 */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext context: Context
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val prefs: SharedPreferences = runCatching {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "medicare_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }.getOrElse {
        context.getSharedPreferences("medicare_fallback_session", Context.MODE_PRIVATE)
    }

    private val _currentUser = MutableStateFlow(loadUser())
    val currentUser: StateFlow<UserProfile?> = _currentUser.asStateFlow()

    private val _darkTheme = MutableStateFlow(prefs.getBoolean("dark_theme", true))
    val darkTheme: StateFlow<Boolean> = _darkTheme.asStateFlow()

    private val _highContrast = MutableStateFlow(prefs.getBoolean("high_contrast", false))
    val highContrast: StateFlow<Boolean> = _highContrast.asStateFlow()

    private val _fontScale = MutableStateFlow(prefs.getFloat("font_scale", 1.0f))
    val fontScale: StateFlow<Float> = _fontScale.asStateFlow()

    fun getAccessToken(): String? = prefs.getString("access_token", null)

    fun saveSession(user: UserProfile, accessToken: String?, refreshToken: String? = null) {
        prefs.edit().apply {
            putString("user_profile", json.encodeToString(user))
            if (accessToken != null) putString("access_token", accessToken)
            if (refreshToken != null) putString("refresh_token", refreshToken)
            apply()
        }
        _currentUser.value = user
    }

    fun clearSession() {
        prefs.edit().apply {
            remove("user_profile")
            remove("access_token")
            remove("refresh_token")
            apply()
        }
        _currentUser.value = null
    }

    fun setDarkTheme(enabled: Boolean) {
        prefs.edit().putBoolean("dark_theme", enabled).apply()
        _darkTheme.value = enabled
    }

    fun setHighContrast(enabled: Boolean) {
        prefs.edit().putBoolean("high_contrast", enabled).apply()
        _highContrast.value = enabled
    }

    fun setFontScale(scale: Float) {
        val clamped = scale.coerceIn(0.85f, 1.35f)
        prefs.edit().putFloat("font_scale", clamped).apply()
        _fontScale.value = clamped
    }

    private fun loadUser(): UserProfile? {
        val raw = prefs.getString("user_profile", null) ?: return null
        return runCatching { json.decodeFromString<UserProfile>(raw) }.getOrNull()
    }
}
