package br.com.medicare.paciente.notifications

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import br.com.medicare.paciente.domain.model.Medication
import br.com.medicare.paciente.domain.model.TreatmentType
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orquestrador nativo de alarmes de medicamentos via AlarmManager.
 *
 * Responsabilidades:
 * 1. Agendar alarmes exatos (setExactAndAllowWhileIdle) para os horários configurados.
 * 2. Agendar repetição/adiamento de 15 minutos quando a dose não for confirmada.
 * 3. Cancelar alarmes de repetição e remover a notificação ativa assim que a dose é confirmada.
 * 4. Reagendar todos os medicamentos ativos após reboot, troca de fuso ou edição de tratamento.
 */
@Singleton
class DoseAlarmScheduler @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        const val CHANNEL_ID = "medicare_dose_reminders"
        const val ACTION_TRIGGER_DOSE_ALARM = "br.com.medicare.paciente.ACTION_TRIGGER_DOSE_ALARM"
        const val ACTION_CONFIRM_DOSE = "br.com.medicare.paciente.ACTION_CONFIRM_DOSE"
        const val ACTION_SNOOZE_DOSE = "br.com.medicare.paciente.ACTION_SNOOZE_DOSE"

        const val EXTRA_DOSE_ID = "extra_dose_id"
        const val EXTRA_MED_ID = "extra_med_id"
        const val EXTRA_MED_NAME = "extra_med_name"
        const val EXTRA_DOSAGE = "extra_dosage"
        const val EXTRA_UNIT = "extra_unit"
        const val EXTRA_HORA = "extra_hora"
        const val EXTRA_IS_REPEAT = "extra_is_repeat"

        fun notificationIdFor(medId: String, hora: String): Int =
            "$medId-$hora".hashCode()

        fun snoozeRequestCodeFor(medId: String, hora: String): Int =
            "snooze-$medId-$hora".hashCode()
    }

    private val alarmManager: AlarmManager? =
        context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    init {
        ensureNotificationChannel()
    }

    fun ensureNotificationChannel() {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Lembretes de Medicamentos",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alertas sonoros e visuais nos horários programados das doses"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 150, 250)
            setBypassDnd(true)
        }
        manager.createNotificationChannel(channel)
    }

    /**
     * Agenda todos os horários diários de uma lista de medicamentos ativos.
     */
    fun scheduleAllActiveMedications(medications: List<Medication>, today: LocalDate = LocalDate.now()) {
        val todayIso = today.toString()
        medications.forEach { med ->
            if (!shouldScheduleMedication(med, todayIso)) {
                cancelAllAlarmsForMedication(med)
            } else {
                med.horarios.forEach { hora ->
                    scheduleNextOccurrence(med, hora)
                }
            }
        }
    }

    fun shouldScheduleMedication(med: Medication, todayIso: String = LocalDate.now().toString()): Boolean {
        if (!med.ativo) return false
        return when (TreatmentType.fromCode(med.treatmentType)) {
            TreatmentType.SOS -> false
            TreatmentType.TEMPORARY -> {
                if (med.status.isNotBlank() && med.status != "ativo") return false
                if (!med.endDate.isNullOrBlank() && todayIso > med.endDate) return false
                true
            }
            TreatmentType.CONTINUOUS -> true
        }
    }

    /**
     * Agenda a próxima ocorrência exata para um medicamento e horário (HH:mm).
     */
    fun scheduleNextOccurrence(
        med: Medication,
        hora: String,
        now: LocalDateTime = LocalDateTime.now()
    ) {
        val parts = hora.split(":")
        val h = parts.getOrNull(0)?.toIntOrNull() ?: return
        val m = parts.getOrNull(1)?.toIntOrNull() ?: return

        var targetDateTime = LocalDateTime.of(now.toLocalDate(), LocalTime.of(h.coerceIn(0, 23), m.coerceIn(0, 59)))
        if (!targetDateTime.isAfter(now)) {
            targetDateTime = targetDateTime.plusDays(1)
        }

        val triggerAtMillis = targetDateTime
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()

        val doseId = "${med.id}-${hora.replace(":", "")}"
        val pendingIntent = buildAlarmPendingIntent(
            requestCode = notificationIdFor(med.id, hora),
            doseId = doseId,
            medId = med.id,
            medName = med.nome,
            dosage = med.dosagem,
            unit = med.unidade,
            hora = hora,
            isRepeat = false
        )

        scheduleExactSafe(triggerAtMillis, pendingIntent)
    }

    /**
     * Agenda um lembrete de repetição em 15 minutos quando a dose ainda não foi confirmada.
     */
    fun scheduleSnoozeReminder(
        medId: String,
        medName: String,
        dosage: String,
        unit: String,
        hora: String,
        delayMinutes: Long = 15L
    ) {
        val triggerAtMillis = System.currentTimeMillis() + (delayMinutes * 60_000L)
        val doseId = "$medId-${hora.replace(":", "")}"
        val pendingIntent = buildAlarmPendingIntent(
            requestCode = snoozeRequestCodeFor(medId, hora),
            doseId = doseId,
            medId = medId,
            medName = medName,
            dosage = dosage,
            unit = unit,
            hora = hora,
            isRepeat = true
        )
        scheduleExactSafe(triggerAtMillis, pendingIntent)
    }

    /**
     * Cancela imediatamente qualquer repetição/snooze pendente e remove a notificação ativa
     * quando o paciente confirma que tomou a dose.
     */
    fun onDoseConfirmed(medId: String, hora: String) {
        val snoozeIntent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = ACTION_TRIGGER_DOSE_ALARM
        }
        val pendingSnooze = PendingIntent.getBroadcast(
            context,
            snoozeRequestCodeFor(medId, hora),
            snoozeIntent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingSnooze != null) {
            alarmManager?.cancel(pendingSnooze)
            pendingSnooze.cancel()
        }
        NotificationManagerCompat.from(context).cancel(notificationIdFor(medId, hora))
    }

    /**
     * Cancela todos os alarmes e notificações de um medicamento (usado ao excluir ou desativar).
     */
    fun cancelAllAlarmsForMedication(med: Medication) {
        med.horarios.forEach { hora ->
            onDoseConfirmed(med.id, hora)
            val alarmIntent = Intent(context, DoseAlarmReceiver::class.java).apply {
                action = ACTION_TRIGGER_DOSE_ALARM
            }
            val pendingAlarm = PendingIntent.getBroadcast(
                context,
                notificationIdFor(med.id, hora),
                alarmIntent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingAlarm != null) {
                alarmManager?.cancel(pendingAlarm)
                pendingAlarm.cancel()
            }
        }
    }

    private fun buildAlarmPendingIntent(
        requestCode: Int,
        doseId: String,
        medId: String,
        medName: String,
        dosage: String,
        unit: String,
        hora: String,
        isRepeat: Boolean
    ): PendingIntent {
        val intent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = ACTION_TRIGGER_DOSE_ALARM
            putExtra(EXTRA_DOSE_ID, doseId)
            putExtra(EXTRA_MED_ID, medId)
            putExtra(EXTRA_MED_NAME, medName)
            putExtra(EXTRA_DOSAGE, dosage)
            putExtra(EXTRA_UNIT, unit)
            putExtra(EXTRA_HORA, hora)
            putExtra(EXTRA_IS_REPEAT, isRepeat)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun scheduleExactSafe(triggerAtMillis: Long, pendingIntent: PendingIntent) {
        val am = alarmManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
    }
}
