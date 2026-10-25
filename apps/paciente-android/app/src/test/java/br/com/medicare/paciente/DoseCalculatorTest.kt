package br.com.medicare.paciente

import br.com.medicare.paciente.domain.model.*
import br.com.medicare.paciente.domain.util.DoseCalculator
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class DoseCalculatorTest {

    @Test
    fun `getDoseStatus returns CONFIRMED when confirmed is true regardless of time`() {
        val status = DoseCalculator.getDoseStatus("08:00", confirmed = true, now = LocalTime.of(14, 0))
        assertEquals(DoseStatus.CONFIRMED, status)
    }

    @Test
    fun `getDoseStatus classifies SCHEDULED, UPCOMING, PENDING, LATE and MISSED accurately`() {
        val now = LocalTime.of(10, 0)
        assertEquals(DoseStatus.SCHEDULED, DoseCalculator.getDoseStatus("11:00", false, now))
        assertEquals(DoseStatus.UPCOMING, DoseCalculator.getDoseStatus("10:10", false, now))
        assertEquals(DoseStatus.PENDING, DoseCalculator.getDoseStatus("09:45", false, now))
        assertEquals(DoseStatus.LATE, DoseCalculator.getDoseStatus("08:30", false, now))
        assertEquals(DoseStatus.MISSED, DoseCalculator.getDoseStatus("07:00", false, now))
    }

    @Test
    fun `buildDailyDoses excludes SOS medications and expired temporary treatments`() {
        val today = LocalDate.of(2026, 10, 25)
        val meds = listOf(
            Medication(
                id = "m-cont",
                userId = "u1",
                nome = "Losartana",
                dosagem = "50mg",
                horarios = listOf("08:00", "20:00"),
                treatmentType = "continuous"
            ),
            Medication(
                id = "m-sos",
                userId = "u1",
                nome = "Dipirona",
                dosagem = "1g",
                horarios = listOf("08:00"),
                treatmentType = "sos"
            ),
            Medication(
                id = "m-exp",
                userId = "u1",
                nome = "Amoxicilina Expirada",
                dosagem = "500mg",
                horarios = listOf("12:00"),
                treatmentType = "temporary",
                startDate = "2026-10-01",
                endDate = "2026-10-07"
            )
        )

        val doses = DoseCalculator.buildDailyDoses(meds, emptyList(), today, LocalTime.of(9, 0))
        assertEquals(2, doses.size)
        assertTrue(doses.all { it.medId == "m-cont" })
    }

    @Test
    fun `computeStockForecasts calculates depletion date and orders by most urgent`() {
        val today = LocalDate.of(2026, 10, 25)
        val meds = listOf(
            Medication(
                id = "m1",
                userId = "u1",
                nome = "Med 30 dias",
                dosagem = "10mg",
                quantidade = 30,
                horarios = listOf("08:00"),
                treatmentType = "continuous"
            ),
            Medication(
                id = "m2",
                userId = "u1",
                nome = "Med 3 dias",
                dosagem = "20mg",
                quantidade = 6,
                horarios = listOf("08:00", "20:00"),
                treatmentType = "continuous"
            )
        )

        val forecasts = DoseCalculator.computeStockForecasts(meds, today)
        assertEquals(2, forecasts.size)
        assertEquals("m2", forecasts[0].medId)
        assertEquals(3, forecasts[0].daysRemaining)
        assertEquals("2026-10-28", forecasts[0].depletionDate)
    }
}
