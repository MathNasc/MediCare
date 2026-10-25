package br.com.medicare.paciente.di

import android.content.Context
import androidx.room.Room
import br.com.medicare.paciente.BuildConfig
import br.com.medicare.paciente.data.local.MediCareDao
import br.com.medicare.paciente.data.local.MediCareDatabase
import br.com.medicare.paciente.data.local.SessionManager
import br.com.medicare.paciente.data.remote.AiAssistantApi
import br.com.medicare.paciente.data.remote.MediCareRemoteApi
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        coerceInputValues = true
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MediCareDatabase {
        return Room.databaseBuilder(
            context,
            MediCareDatabase::class.java,
            "medicare_paciente_offline.db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideDao(db: MediCareDatabase): MediCareDao = db.dao()

    @Provides
    @Singleton
    fun provideOkHttpClient(sessionManager: SessionManager): OkHttpClient {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = sessionManager.getAccessToken() ?: BuildConfig.BACKEND_ANON_KEY
            val reqBuilder = original.newBuilder()
                .header("apikey", BuildConfig.BACKEND_ANON_KEY)
                .header("Content-Type", "application/json")
            if (token.isNotBlank()) {
                reqBuilder.header("Authorization", "Bearer $token")
            }
            chain.proceed(reqBuilder.build())
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideMediCareRemoteApi(okHttpClient: OkHttpClient): MediCareRemoteApi {
        val baseUrl = BuildConfig.BACKEND_URL.trimEnd('/') + "/"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(MediCareRemoteApi::class.java)
    }

    @Provides
    @Singleton
    fun provideAiAssistantApi(okHttpClient: OkHttpClient): AiAssistantApi {
        val baseUrl = BuildConfig.AI_PROXY_URL.trimEnd('/') + "/"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AiAssistantApi::class.java)
    }
}
