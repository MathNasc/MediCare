package br.com.medicare.paciente.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.com.medicare.paciente.data.repository.MediCareRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Reagenda automaticamente todos os alarmes ativos do paciente quando:
 * - O aparelho é reiniciado (BOOT_COMPLETED / LOCKED_BOOT_COMPLETED)
 * - O aplicativo é atualizado (MY_PACKAGE_REPLACED)
 * - O horário ou fuso horário do aparelho é alterado (TIME_SET / TIMEZONE_CHANGED)
 */
@AndroidEntryPoint
class BootAndTimeChangeReceiver : BroadcastReceiver() {

    @Inject lateinit var repository: MediCareRepository
    @Inject lateinit var alarmScheduler: DoseAlarmScheduler

    override fun onReceive(context: Context, intent: Intent) {
        val validActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED
        )
        if (intent.action !in validActions) return

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val activeMeds = repository.getAllActiveMedicationsLocal()
                alarmScheduler.scheduleAllActiveMedications(activeMeds)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
