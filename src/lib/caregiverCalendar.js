import { getBrazilDateIso } from '@/lib/brazilTime';

export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const WEEKDAYS_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const WEEKDAYS_FULL_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const WEEKDAY_TOKENS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function formatDateBr(dateIso) {
  const m = String(dateIso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(dateIso || '');
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatFullDateBr(dateIso) {
  const m = String(dateIso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(dateIso || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const wd = WEEKDAYS_FULL_PT[d.getUTCDay()] || '';
  return `${wd}, ${m[3]}/${m[2]}/${m[1]}`;
}

export function matchesMedWeekday(diasSemana, weekdayIndex) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) return true;
  const targetShort = WEEKDAY_TOKENS_PT[weekdayIndex] || '';
  return diasSemana.some((entry) => {
    if (typeof entry === 'number') return entry === weekdayIndex;
    const norm = String(entry || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (!norm) return false;
    if (/^\d+$/.test(norm)) return Number(norm) === weekdayIndex;
    return norm.startsWith(targetShort);
  });
}

export function extractDoseDateIso(doseRecord) {
  if (!doseRecord) return '';
  if (doseRecord.dose_date) {
    return String(doseRecord.dose_date).slice(0, 10);
  }
  if (doseRecord.created_at) {
    return getBrazilDateIso(doseRecord.created_at);
  }
  return '';
}

export function isStockEventRecord(ev) {
  if (!ev) return false;
  const tp = String(ev.type || ev.tipo || '').trim().toLowerCase();
  if (['estoque', 'stock', 'reposicao', 'reposição'].includes(tp)) return true;
  if (String(ev.id || '').startsWith('ev-st-')) return true;
  const title = String(ev.title || ev.titulo || '').trim();
  return /^(Reposição|Reposicao|Ajuste):/i.test(title);
}

export function isSosDoseRecord(h, medications = []) {
  const hora = String(h?.hora || h?.horario || '').trim().toUpperCase();
  if (hora === 'SOS' || Boolean(h?.is_sos)) return true;
  const med = medications.find((m) => String(m.id) === String(h?.med_id));
  if (med && String(med.treatment_type || '').toLowerCase() === 'sos') return true;
  const motivo = String(h?.motivo || h?.correction_reason || '').trim().toLowerCase();
  return motivo.startsWith('uso sos');
}

export function isMedScheduledOnDate(med, dateIso) {
  if (!med || !dateIso) return false;
  if (med.ativo === false) return false;
  if (String(med.treatment_type || '').toLowerCase() === 'sos') return false;

  const startBound = med.start_date
    ? String(med.start_date).slice(0, 10)
    : med.created_at
    ? getBrazilDateIso(med.created_at)
    : null;
  if (startBound && dateIso < startBound) return false;

  if (med.end_date && String(med.end_date).slice(0, 10) < dateIso) return false;

  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3) return true;
  const weekdayIndex = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0)).getUTCDay();
  return matchesMedWeekday(med.dias_semana, weekdayIndex);
}

export function getDayDetails({
  dateIso,
  todayIso,
  currentMinutesOfDay = 0,
  missedDoseMinutes = 60,
  medications = [],
  doseHistory = [],
  appointments = [],
  calendarNotes = [],
  stockMovements = [],
}) {
  const scheduledDoses = [];
  const dayHistory = doseHistory.filter((h) => extractDoseDateIso(h) === dateIso);
  const sosDoses = [];

  for (const h of dayHistory) {
    if (isSosDoseRecord(h, medications)) {
      const med = medications.find((m) => String(m.id) === String(h.med_id));
      sosDoses.push({
        id: h.id || `${h.med_id}-sos-${h.hora}`,
        med_id: h.med_id,
        med_name: med?.nome || 'Medicamento SOS',
        dosagem: med?.dosagem || '',
        hora: String(h.hora || h.horario || '').trim().slice(0, 5) || 'SOS',
        reason: h.correction_reason || h.motivo || 'Uso SOS',
        created_at: h.created_at || null,
      });
    }
  }

  for (const med of medications) {
    if (String(med.treatment_type || '').toLowerCase() === 'sos') continue;
    const horarios = Array.isArray(med.horarios) ? med.horarios : [];
    if (horarios.length === 0) continue;

    const scheduledForDay = isMedScheduledOnDate(med, dateIso);
    const medDayHist = dayHistory.filter(
      (h) => String(h.med_id) === String(med.id) && !isSosDoseRecord(h, medications)
    );

    if (!scheduledForDay && medDayHist.length === 0) continue;

    for (const rawHora of horarios) {
      const hora = String(rawHora || '').trim().slice(0, 5);
      if (!hora) continue;
      const [hh, mm] = hora.split(':').map((n) => Number(n) || 0);
      const scheduledMinutes = hh * 60 + mm;

      const match = medDayHist.find((h) => String(h.hora || h.horario || '').trim().slice(0, 5) === hora);
      const rawStatus = match ? String(match.status || '').toLowerCase() : 'pending';
      const isTaken = ['confirmed', 'tomado', 'tomada', 'late'].includes(rawStatus);
      const isMissed =
        ['missed', 'pulada'].includes(rawStatus) ||
        (!isTaken && dateIso < todayIso) ||
        (!isTaken && dateIso === todayIso && currentMinutesOfDay > scheduledMinutes + Math.max(30, Number(missedDoseMinutes || 60)));

      scheduledDoses.push({
        id: `${med.id}-${dateIso}-${hora}`,
        med_id: med.id,
        med_name: med.nome,
        dosagem: med.dosagem,
        unidade: med.unidade || 'unidade',
        hora,
        dose_date: dateIso,
        status: isTaken ? 'confirmed' : isMissed ? 'missed' : 'pending',
        raw_status: rawStatus,
        atraso_minutos: Number(match?.atraso_minutos || 0),
        confirmed_by_name: match?.confirmed_by_name || null,
        confirmed_by_role: match?.confirmed_by_role || null,
        correction_reason: match?.correction_reason || match?.motivo || null,
      });
    }
  }

  scheduledDoses.sort((a, b) => a.hora.localeCompare(b.hora));

  const dayEvents = appointments.filter(
    (ev) => !isStockEventRecord(ev) && String(ev.date || '').slice(0, 10) === dateIso
  );
  const dayNotes = calendarNotes.filter((n) => String(n.date || '').slice(0, 10) === dateIso);
  const dayStock = stockMovements.filter(
    (sm) => sm.created_at && getBrazilDateIso(sm.created_at) === dateIso
  );

  return {
    doses: scheduledDoses,
    sosDoses,
    events: dayEvents,
    notes: dayNotes,
    stockMoves: dayStock,
  };
}

export function buildCalendarMonthData({
  year,
  monthIndex,
  todayIso,
  currentMinutesOfDay = 0,
  missedDoseMinutes = 60,
  medications = [],
  doseHistory = [],
  appointments = [],
  calendarNotes = [],
  stockMovements = [],
}) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const cells = [];
  let totalExpected = 0;
  let takenCount = 0;
  let lateCount = 0;
  let missedCount = 0;

  for (let idx = 0; idx < totalCells; idx += 1) {
    const dayNum = idx - firstDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ empty: true, key: `empty-${idx}` });
      continue;
    }

    const dateIso = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dateIso === todayIso;
    const isFuture = dateIso > todayIso;

    const details = getDayDetails({
      dateIso,
      todayIso,
      currentMinutesOfDay,
      missedDoseMinutes,
      medications,
      doseHistory,
      appointments,
      calendarNotes,
      stockMovements,
    });

    const dayTotal = details.doses.length;
    const dayTaken = details.doses.filter((d) => d.status === 'confirmed').length;
    const dayMissed = details.doses.filter((d) => d.status === 'missed').length;

    let dayDoseStat = null;
    if (dayTotal > 0 && dateIso <= todayIso) {
      if (dayTaken === dayTotal) {
        dayDoseStat = 'all_taken';
      } else if (dayTaken > 0) {
        dayDoseStat = 'partial';
      } else if (dayMissed > 0 || dateIso < todayIso) {
        dayDoseStat = 'missed';
      }
    }

    if (dateIso <= todayIso) {
      totalExpected += dayTotal;
      takenCount += dayTaken;
      lateCount += details.doses.filter(
        (d) => d.status === 'confirmed' && (d.raw_status === 'late' || d.atraso_minutos > 15)
      ).length;
      missedCount += dayMissed;
    }

    cells.push({
      empty: false,
      key: dateIso,
      dayNum,
      dateIso,
      isToday,
      isFuture,
      dayDoseStat,
      hasSos: details.sosDoses.length > 0,
      hasNote: details.notes.length > 0,
      hasEvent: details.events.length > 0,
      hasStock: details.stockMoves.some((sm) => Number(sm.quantity_delta ?? sm.quantity_changed ?? 0) > 0),
    });
  }

  const adherencePct = totalExpected > 0 ? Math.round((takenCount / totalExpected) * 100) : null;
  const notesCount = calendarNotes.filter((n) => String(n.date || '').startsWith(monthPrefix)).length;
  const eventsCount = appointments.filter(
    (ev) => !isStockEventRecord(ev) && String(ev.date || '').startsWith(monthPrefix)
  ).length;
  const sosCount = doseHistory.filter(
    (h) => extractDoseDateIso(h).startsWith(monthPrefix) && isSosDoseRecord(h, medications)
  ).length;
  const restockCount = stockMovements.filter((sm) => {
    const dIso = sm.created_at ? getBrazilDateIso(sm.created_at) : '';
    const delta = Number(sm.quantity_delta ?? sm.quantity_changed ?? 0);
    return dIso.startsWith(monthPrefix) && delta > 0;
  }).length;

  const upcomingEvents = appointments
    .filter((ev) => !isStockEventRecord(ev) && String(ev.date || '').slice(0, 10) >= todayIso)
    .sort((a, b) => {
      const cmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmp !== 0) return cmp;
      return String(a.time || '').localeCompare(String(b.time || ''));
    })
    .slice(0, 6);

  return {
    cells,
    monthSummary: {
      adherencePct,
      totalExpected,
      takenCount,
      lateCount,
      missedCount,
      notesCount,
      eventsCount,
      sosCount,
      restockCount,
    },
    upcomingEvents,
  };
}
