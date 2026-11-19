import {
  formatDateBr,
  formatFullDateBr,
  isMedScheduledOnDate,
  getDayDetails,
  buildCalendarMonthData,
} from '@/lib/caregiverCalendar';

describe('caregiverCalendar helpers', () => {
  const baseMeds = [
    {
      id: 'med-1',
      nome: 'Hidantal',
      dosagem: '100mg',
      unidade: 'comprimido(s)',
      horarios: ['08:00', '20:00'],
      treatment_type: 'continuo',
      start_date: '2026-11-10',
      dias_semana: [],
      ativo: true,
    },
    {
      id: 'med-2',
      nome: 'Dipirona',
      dosagem: '500mg',
      unidade: 'comprimido(s)',
      horarios: [],
      treatment_type: 'sos',
      start_date: '2026-11-01',
      ativo: true,
    },
  ];

  test('formatDateBr and formatFullDateBr format ISO dates in Portuguese', () => {
    expect(formatDateBr('2026-11-18')).toBe('18/11/2026');
    expect(formatFullDateBr('2026-11-18')).toBe('Quarta-feira, 18/11/2026');
  });

  test('isMedScheduledOnDate respects start_date, end_date, weekdays, and excludes SOS meds', () => {
    expect(isMedScheduledOnDate(baseMeds[0], '2026-11-09')).toBe(false);
    expect(isMedScheduledOnDate(baseMeds[0], '2026-11-10')).toBe(true);
    expect(isMedScheduledOnDate(baseMeds[1], '2026-11-15')).toBe(false);

    const weekdayMed = {
      ...baseMeds[0],
      dias_semana: ['Seg', 'Qua', 'Sex'],
    };
    // 2026-11-18 is Wednesday (Qua), 2026-11-19 is Thursday (Qui)
    expect(isMedScheduledOnDate(weekdayMed, '2026-11-18')).toBe(true);
    expect(isMedScheduledOnDate(weekdayMed, '2026-11-19')).toBe(false);
  });

  test('getDayDetails separates scheduled doses, SOS doses, events, notes, and Brasilia-date stock movements', () => {
    const details = getDayDetails({
      dateIso: '2026-11-18',
      todayIso: '2026-11-18',
      currentMinutesOfDay: 10 * 60, // 10:00 BRT -> 08:00 is >60min overdue if unconfirmed
      medications: baseMeds,
      doseHistory: [
        {
          id: 'h-1',
          med_id: 'med-1',
          hora: '08:00',
          dose_date: '2026-11-18',
          status: 'confirmed',
          atraso_minutos: 25,
          confirmed_by_name: 'Rosangela',
        },
        {
          id: 'h-sos',
          med_id: 'med-2',
          hora: '14:30',
          dose_date: '2026-11-18',
          is_sos: true,
          status: 'confirmed',
          motivo: 'Uso SOS - dor de cabeça',
        },
      ],
      appointments: [
        { id: 'ev-1', date: '2026-11-18', time: '15:00', title: 'Neurologista', type: 'consulta' },
        { id: 'ev-st-1', date: '2026-11-18', title: 'Reposição: Hidantal', type: 'estoque' },
      ],
      calendarNotes: [
        { id: 'n-1', date: '2026-11-18', content: 'Paciente bem disposta', mood: 'Rotina' },
      ],
      stockMovements: [
        // 2026-11-19T01:30:00Z = 2026-11-18 22:30 BRT!
        {
          id: 'sm-1',
          med_id: 'med-1',
          quantity_delta: 30,
          reason: 'Reposição farmácia',
          created_at: '2026-11-19T01:30:00.000Z',
        },
      ],
    });

    expect(details.doses).toHaveLength(2);
    expect(details.doses[0]).toMatchObject({
      hora: '08:00',
      status: 'confirmed',
      atraso_minutos: 25,
    });
    expect(details.doses[1]).toMatchObject({
      hora: '20:00',
      status: 'pending',
    });
    expect(details.sosDoses).toHaveLength(1);
    expect(details.sosDoses[0].med_name).toBe('Dipirona');
    expect(details.events).toHaveLength(1);
    expect(details.events[0].title).toBe('Neurologista');
    expect(details.notes).toHaveLength(1);
    expect(details.stockMoves).toHaveLength(1);
  });

  test('buildCalendarMonthData computes grid dots, adherence %, monthly summary, and upcoming events', () => {
    const result = buildCalendarMonthData({
      year: 2026,
      monthIndex: 10, // November (0-indexed)
      todayIso: '2026-11-12',
      currentMinutesOfDay: 22 * 60,
      medications: baseMeds, // active starting 2026-11-10 (10, 11, 12 => 3 days * 2 doses = 6 expected)
      doseHistory: [
        { med_id: 'med-1', hora: '08:00', dose_date: '2026-11-10', status: 'confirmed', atraso_minutos: 0 },
        { med_id: 'med-1', hora: '20:00', dose_date: '2026-11-10', status: 'confirmed', atraso_minutos: 20 },
        { med_id: 'med-1', hora: '08:00', dose_date: '2026-11-11', status: 'confirmed', atraso_minutos: 0 },
        { med_id: 'med-2', hora: '11:00', dose_date: '2026-11-11', is_sos: true, status: 'confirmed' },
      ],
      appointments: [
        { id: 'ev-past', date: '2026-11-10', time: '09:00', title: 'Exame de sangue', type: 'exame' },
        { id: 'ev-future', date: '2026-11-20', time: '14:00', title: 'Retorno Clínico', type: 'consulta' },
      ],
      calendarNotes: [
        { id: 'n-1', date: '2026-11-11', content: 'Pressão 12x8', mood: 'Pressão/Glicemia' },
      ],
      stockMovements: [
        { id: 'sm-1', quantity_delta: 20, created_at: '2026-11-10T15:00:00.000Z' },
      ],
    });

    const day10 = result.cells.find((c) => !c.empty && c.dateIso === '2026-11-10');
    const day11 = result.cells.find((c) => !c.empty && c.dateIso === '2026-11-11');
    const day12 = result.cells.find((c) => !c.empty && c.dateIso === '2026-11-12');
    const day09 = result.cells.find((c) => !c.empty && c.dateIso === '2026-11-09');

    expect(day09.dayDoseStat).toBeNull();
    expect(day10).toMatchObject({ dayDoseStat: 'all_taken', hasEvent: true, hasStock: true });
    expect(day11).toMatchObject({ dayDoseStat: 'partial', hasSos: true, hasNote: true });
    expect(day12).toMatchObject({ dayDoseStat: 'missed', isToday: true });

    expect(result.monthSummary).toEqual({
      adherencePct: 50,
      totalExpected: 6,
      takenCount: 3,
      lateCount: 1,
      missedCount: 3,
      notesCount: 1,
      eventsCount: 2,
      sosCount: 1,
      restockCount: 1,
    });

    expect(result.upcomingEvents).toHaveLength(1);
    expect(result.upcomingEvents[0].title).toBe('Retorno Clínico');
  });
});
