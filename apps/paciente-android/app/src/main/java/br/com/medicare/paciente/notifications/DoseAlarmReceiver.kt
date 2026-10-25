package br.com.medicare.paciente.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.medicare.paciente.MainActivity
import br.com.medicare.paciente.data.repository.MediCareRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

/**
 * BroadcastReceiver responsável por:
 * 1. Disparar notificações ricas nos horários programados (com prevenção de duplicidade se já confirmada).
 * 2. Processar a ação rápida "✓ Tomei agora" diretamente da barra de notificações.
 * 3. Processar a ação rápida "⏰ 15 minutos" reagendando o lembrete.
 */
@AndroidEntryPoint
class DoseAlarmReceiver : BroadcastReceiver() {

    @Inject lateinit var repository: MediCareRepository
    @Inject lateinit var alarmScheduler: DoseAlarmScheduler

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                val medId = intent.getStringExtra(DoseAlarmScheduler.EXTRA_MED_ID) ?: return@launch
                val medName = intent.getStringExtra(DoseAlarmScheduler.EXTRA_MED_NAME) ?: "Medicamento"
                val dosage = intent.getStringExtra(DoseAlarmScheduler.EXTRA_DOSAGE) ?: ""
                val unit = intent.getStringExtra(DoseAlarmScheduler.EXTRA_UNIT) ?: "comprimido"
                val hora = intent.getStringExtra(DoseAlarmScheduler.EXTRA_HORA) ?: "08:00"
                val doseId = intent.getStringExtra(DoseAlarmScheduler.EXTRA_DOSE_ID)
                    ?: "$medId-${hora.replace(":", "")}"
                val isRepeat = intent.getBooleanExtra(DoseAlarmScheduler.EXTRA_IS_REPEAT, false)

                when (intent.action) {
                    DoseAlarmScheduler.ACTION_TRIGGER_DOSE_ALARM -> {
                        // 1. Verifica se o medicamento ainda está ativo eagenda a ocorrência do dia seguinte
                        val med = repository.getMedicationById(medId)
                        if (med != null && alarmScheduler.shouldScheduleMedication(med)) {
                            alarmScheduler.scheduleNextOccurrence(med, hora)
                        }

                        // 2. Prevenção de duplicidade: se a dose de hoje já foi confirmada, não notifica
                        val alreadyConfirmed = repository.isDoseConfirmedForToday(medId, hora, LocalDate.now())
                        if (alreadyConfirmed) {
                            alarmScheduler.onDoseConfirmed(medId, hora)
                            return@launch
                        }

                        // 3. Exibe a notificação e agenda repetição automática em 15 minutos caso não confirmada
                        showDoseNotification(
                            context = context,
                            doseId = doseId,
                            medId = medId,
                            medName = medName,
                            dosage = dosage,
                            unit = unit,
                            hora = hora,
                            isRepeat = isRepeat
                        )

                        if (!isRepeat) {
                            alarmScheduler.scheduleSnoozeReminder(
                                medId = medId,
                                medName = medName,
                                dosage = dosage,
                                unit = unit,
                                hora = hora,
                                delayMinutes = 15L
                            )
                        }
                    }

                    DoseAlarmScheduler.ACTION_CONFIRM_DOSE -> {
                        repository.confirmDoseByMedAndHora(medId = medId, hora = hora)
                        alarmScheduler.onDoseConfirmed(medId, hora)
                    }

                    DoseAlarmScheduler.ACTION_SNOOZE_DOSE -> {
                        NotificationManagerCompat.from(context)
                            .cancel(DoseAlarmScheduler.notificationIdFor(medId, hora))
                        alarmScheduler.scheduleSnoozeReminder(
                            medId = medId,
                            medName = medName,
                            dosage = dosage,
                            unit = unit,
                            hora = hora,
                            delayMinutes = 15L
                        )
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun showDoseNotification(
        context: Context,
        doseId: String,
        medId: String,
        medName: String,
        dosage: String,
        unit: String,
        hora: String,
        isRepeat: Boolean
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        alarmScheduler.ensureNotificationChannel()
        val notificationId = DoseAlarmScheduler.notificationIdFor(medId, hora)

        // Deep link para abrir o app diretamente no modal de confirmação da dose
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("medicare://dose/$doseId")
            putExtra(DoseAlarmScheduler.EXTRA_DOSE_ID, doseId)
            putExtra(DoseAlarmScheduler.EXTRA_MED_ID, medId)
            putExtra(DoseAlarmScheduler.EXTRA_HORA, hora)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Ação 1: Confirmar ("✓ Tomei agora")
        val confirmIntent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = DoseAlarmScheduler.ACTION_CONFIRM_DOSE
            putExtra(DoseAlarmScheduler.EXTRA_DOSE_ID, doseId)
            putExtra(DoseAlarmScheduler.EXTRA_MED_ID, medId)
            putExtra(DoseAlarmScheduler.EXTRA_MED_NAME, medName)
            putExtra(DoseAlarmScheduler.EXTRA_DOSAGE, dosage)
            putExtra(DoseAlarmScheduler.EXTRA_UNIT, unit)
            putExtra(DoseAlarmScheduler.EXTRA_HORA, hora)
        }
        val confirmPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 1,
            confirmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Ação 2: Adiar 15 minutos ("⏰ 15 minutos")
        val snoozeIntent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = DoseAlarmScheduler.ACTION_SNOOZE_DOSE
            putExtra(DoseAlarmScheduler.EXTRA_DOSE_ID, doseId)
            putExtra(DoseAlarmScheduler.EXTRA_MED_ID, medId)
            putExtra(DoseAlarmScheduler.EXTRA_MED_NAME, medName)
            putExtra(DoseAlarmScheduler.EXTRA_DOSAGE, dosage)
            putExtra(DoseAlarmScheduler.EXTRA_UNIT, unit)
            putExtra(DoseAlarmScheduler.EXTRA_HORA, hora)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 2,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (isRepeat) {
            "⏰ Lembrete Pendente: $medName"
        } else {
            "💊 Hora do medicamento: $medName"
        }
        val body = "$dosage ($unit) · Horário programado: $hora"

        val notification = NotificationCompat.Builder(context, DoseAlarmScheduler.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .addAction(0, "✓ Tomei agora", confirmPendingIntent)
            .addAction(0, "⏰ 15 minutos", snoozePendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }
}
