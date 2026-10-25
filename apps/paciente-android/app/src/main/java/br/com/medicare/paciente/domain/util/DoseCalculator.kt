package br.com.medicare.paciente.domain.util

import br.com.medicare.paciente.domain.model.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Regras de negócio de cálculo de doses, status temporal, progresso de tratamentos
 * e previsões de estoque — espelhando fielmente `src/lib/doseUtils.js` e `src/lib/treatmentTypes.js`.
 */
object DoseCalculator {

    fun minutesTill(hora: String, now: LocalTime = LocalTime.now()): Long {
        val parts = hora.split(":")
        val h = parts.getOrNull(0)?.toIntOrNull() ?: 8
        val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
        val target = LocalTime.of(h.coerceIn(0, 23), m.coerceIn(0, 59))
        return ChronoUnit.MINUTES.between(now, target)
    }

    fun timeLabel(hora: String, now: LocalTime = LocalTime.now()): String {
        val d = minutesTill(hora, now)
        return when {
            d > 60 -> "em ${(d / 60.0).roundToInt()}h"
            d > 0 -> "em $d min"
            d == 0L -> "agora"
            d > -60 -> "${abs(d)} min atrás"
            else -> "${(abs(d) / 60.0).roundToInt()}h atrás"
        }
    }

    fun getDoseStatus(hora: String, confirmed: Boolean, now: LocalTime = LocalTime.now()): DoseStatus {
        if (confirmed) return DoseStatus.CONFIRMED
        val d = minutesTill(hora, now)
        return when {
            d > 15 -> DoseStatus.SCHEDULED
            d > 0 -> DoseStatus.UPCOMING
            d > -30 -> DoseStatus.PENDING
            d > -120 -> DoseStatus.LATE
            else -> DoseStatus.MISSED
        }
    }

    fun buildDailyDoses(
        medications: List<Medication>,
        history: List<DoseHistoryRecord>,
        today: LocalDate = LocalDate.now(),
        nowTime: LocalTime = LocalTime.now()
    ): List<ScheduledDose> {
        val todayIso = today.toString() // YYYY-MM-DD
        val result = mutableListOf<ScheduledDose>()

        medications
            .filter { it.ativo }
            .filter { med ->
                when (TreatmentType.fromCode(med.treatmentType)) {
                    TreatmentType.SOS -> false // SOS nunca entra na agenda programada do dia
                    TreatmentType.TEMPORARY -> {
                        if (med.status.isNotBlank() && med.status != "ativo") return@filter false
                        if (!med.startDate.isNullOrBlank() && todayIso < med.startDate) return@filter false
                        if (!med.endDate.isNullOrBlank() && todayIso > med.endDate) return@filter false
                        true
                    }
                    TreatmentType.CONTINUOUS -> true
                }
            }
            .forEach { med ->
                val horarios = if (med.horarios.isNotEmpty()) med.horarios else listOf("08:00")
                horarios.forEach { hora ->
                    val dones = history.filter { h ->
                        h.medId == med.id &&
                            h.hora == hora &&
                            h.createdAt.startsWith(todayIso) &&
                            h.status == "confirmed"
                    }
                    val done = dones.firstOrNull()
                    result.add(
                        ScheduledDose(
                            id = "${med.id}-${hora.replace(":", "")}",
                            medId = med.id,
                            nome = med.nome,
                            dosagem = med.dosagem,
                            unidade = med.unidade,
                            cor = med.cor,
                            treatmentType = TreatmentType.fromCode(med.treatmentType),
                            hora = hora,
                            status = getDoseStatus(hora, done != null, nowTime),
                            histId = done?.id,
                            histIds = dones.map { it.id },
                            quantidadeUsada = dones.sumOf { it.quantidadeUsada }
                        )
                    )
                }
            }

        return result.sortedBy { it.hora }
    }

    fun getTreatmentProgress(med: Medication, today: LocalDate = LocalDate.now()): TreatmentProgress? {
        if (TreatmentType.fromCode(med.treatmentType) != TreatmentType.TEMPORARY) return null
        val startStr = med.startDate ?: return null
        val endStr = med.endDate ?: return null
        return try {
            val start = LocalDate.parse(startStr)
            val end = LocalDate.parse(endStr)
            val totalDays = max(1, ChronoUnit.DAYS.between(start, end).toInt() + 1)
            val rawDay = ChronoUnit.DAYS.between(start, today).toInt() + 1
            val dayNumber = min(totalDays, max(1, rawDay))
            val percent = min(100, ((dayNumber.toDouble() / totalDays) * 100).roundToInt())
            TreatmentProgress(
                dayNumber = dayNumber,
                totalDays = totalDays,
                percent = percent,
                isExpired = today.isAfter(end),
                notStarted = today.isBefore(start)
            )
        } catch (_: Exception) {
            null
        }
    }

    fun computeEndDate(startDateIso: String, days: Int): String {
        return try {
            val start = LocalDate.parse(startDateIso)
            start.plusDays(max(1, days).toLong() - 1).toString()
        } catch (_: Exception) {
            startDateIso
        }
    }

    fun computeStockForecasts(
        medications: List<Medication>,
        today: LocalDate = LocalDate.now()
    ): List<StockForecast> {
        return medications
            .filter { it.ativo && TreatmentType.fromCode(it.treatmentType) != TreatmentType.SOS }
            .map { med ->
                val dailyDoses = max(1, med.horarios.size)
                val daysLeft = max(0, med.quantidade / dailyDoses)
                val depletionDate = today.plusDays(daysLeft.toLong()).toString()
                StockForecast(
                    medId = med.id,
                    nome = med.nome,
                    dosagem = med.dosagem,
                    quantidade = med.quantidade,
                    dosesPerDay = dailyDoses,
                    daysRemaining = daysLeft,
                    depletionDate = depletionDate
                )
            }
            .sortedBy { it.daysRemaining }
    }

    fun greetingFor(nome: String?, hour: Int = LocalDateTime.now().hour): String {
        val salutation = when {
            hour < 12 -> "Bom dia"
            hour < 18 -> "Boa tarde"
            else -> "Boa noite"
        }
        val firstName = nome?.trim()?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() } ?: "Paciente"
        return "$salutation, $firstName"
    }
}
