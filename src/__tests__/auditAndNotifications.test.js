import { formatAuditLogEntry } from '@/lib/auditFormatter';
import {
  toDeterministicUuid,
  matchesMedicationWeekday,
  notifyCaregiversOfDoseRequest,
  checkOverdueDosesForCaregivers,
} from '@/lib/caregiverNotifications';
import {
  getBrazilDateIso,
  getBrazilTimeHm,
  getBrazilMinutesOfDay,
  parseBrazilDateTime,
  addDaysBrazilDateIso,
  formatBrazilTime,
} from '@/lib/brazilTime';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

describe('brazilTime (America/Sao_Paulo)', () => {
  test('keeps Brasilia calendar date and time when UTC has already crossed midnight (e.g. 21:25 BRT = 00:25 UTC next day)', () => {
    const utcAfterMidnight = new Date('2026-11-19T00:25:00.000Z');
    expect(getBrazilDateIso(utcAfterMidnight)).toBe('2026-11-18');
    expect(getBrazilTimeHm(utcAfterMidnight)).toBe('21:25');
    expect(getBrazilMinutesOfDay(utcAfterMidnight)).toBe(21 * 60 + 25);
    expect(formatBrazilTime(utcAfterMidnight)).toBe('21:25');
  });

  test('parseBrazilDateTime anchors HH:MM strictly to UTC-03:00', () => {
    const parsed = parseBrazilDateTime('2026-11-18', '21:25');
    expect(parsed.toISOString()).toBe('2026-11-19T00:25:00.000Z');
  });

  test('addDaysBrazilDateIso computes end date reliably without UTC drift', () => {
    expect(addDaysBrazilDateIso(6, '2026-11-18')).toBe('2026-11-24');
  });
});

describe('auditFormatter', () => {
  test('translates known audit actions into friendly Portuguese labels with context', () => {
    const formatted = formatAuditLogEntry({
      action: 'dose_confirmed_retroactively',
      reason: 'Administrada pelo cuidador',
      actor_name: 'Rosangela',
      med_name: 'Hidantal',
      new_value: {
        scheduled_time: '09:00',
        scheduled_date: '2026-11-18',
        actual_administration_time: '09:30',
        origin: 'caregiver_web',
      },
    });

    expect(formatted.title).toBe('Dose confirmada fora do horário');
    expect(formatted.category).toBe('Registro de Dose');
    expect(formatted.tone).toBe('blue');
    expect(formatted.contextSummary).toBe('Hidantal (09:00) · Tomado às 09:30 · Data: 18/11/2026');
    expect(formatted.actorLabel).toBe('Rosangela');
    expect(formatted.reason).toBe('Administrada pelo cuidador');
  });

  test('formats patient dose request and falls back gracefully on unknown snake_case actions', () => {
    const reqLog = formatAuditLogEntry({
      action: 'dose_confirm_requested',
      reason: 'Tomei com atraso',
      new_value: JSON.stringify({
        med_nome: 'Losartana',
        hora: '08:00',
        dose_date: '2026-11-18',
        origin: 'patient_app',
      }),
    });

    expect(reqLog.title).toBe('Solicitação para confirmar dose');
    expect(reqLog.category).toBe('Solicitação do Paciente');
    expect(reqLog.actorLabel).toBe('Paciente');
    expect(reqLog.contextSummary).toContain('Losartana (08:00)');

    const unknownLog = formatAuditLogEntry({
      action: 'custom_clinical_review',
      reason: 'Revisão periódica',
    });
    expect(unknownLog.title).toBe('Custom clinical review');
    expect(unknownLog.category).toBe('Auditoria');
  });
});

describe('caregiverNotifications', () => {
  test('toDeterministicUuid returns valid UUID v4-like string consistently', () => {
    const a = toDeterministicUuid('abc', 'test');
    const b = toDeterministicUuid('abc', 'test');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('matchesMedicationWeekday handles numbers, abbreviations, and empty arrays', () => {
    expect(matchesMedicationWeekday([], 3)).toBe(true);
    expect(matchesMedicationWeekday(['Seg', 'Qua', 'Sex'], 3)).toBe(true);
    expect(matchesMedicationWeekday(['Seg', 'Qua', 'Sex'], 2)).toBe(false);
    expect(matchesMedicationWeekday([0, 6], 0)).toBe(true);
  });

  test('notifyCaregiversOfDoseRequest inserts persistent notifications with tipo cuidador', async () => {
    const queries = [];
    const mockClient = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 1 };
      }),
    };

    const result = await notifyCaregiversOfDoseRequest(mockClient, {
      patientId: '11111111-1111-4111-a111-111111111111',
      patientName: 'Marcela',
      caregiverRows: [{ caregiver_id: '22222222-2222-4222-a222-222222222222' }],
      reqUuid: '33333333-3333-4333-a333-333333333333',
      medNome: 'Hidantal',
      hora: '08:00',
      doseDate: '2026-11-18',
      reason: 'Estava dormindo',
      isUndo: false,
      isNewOrReopened: true,
    });

    expect(result.caregiverCount).toBe(1);
    const insertCall = queries.find((q) => q.sql.includes('INSERT INTO notificacoes'));
    expect(insertCall).toBeTruthy();
    expect(insertCall.sql).toContain("'cuidador'");
    expect(insertCall.params[2]).toContain('Hidantal');
    expect(insertCall.params[3]).toContain('Marcela');
  });

  test('checkOverdueDosesForCaregivers triggers atraso alert when dose is >= 60min overdue and unconfirmed', async () => {
    const insertedNotifs = [];
    const insertedLogs = [];

    // Escolhe um horário garantidamente >= 2h atrás em America/Sao_Paulo hoje
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const spTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(twoHoursAgo);
    // Só executa a verificação do horário se ainda estiver no mesmo dia civil SP (>= 02:00 SP)
    const [hh, mm] = spTime.split(':').map(Number);
    const createdYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const mockClient = {
      query: jest.fn(async (sql, params) => {
        if (sql.includes('FROM caregiver_relationships cr')) {
          return {
            rowCount: 1,
            rows: [
              {
                patient_id: '11111111-1111-4111-a111-111111111111',
                caregiver_id: '22222222-2222-4222-a222-222222222222',
                patient_name: 'Marcela',
              },
            ],
          };
        }
        if (sql.includes('FROM medicamentos')) {
          return {
            rowCount: 1,
            rows: [
              {
                id: '44444444-4444-4444-a444-444444444444',
                user_id: '11111111-1111-4111-a111-111111111111',
                nome: 'Hidantal',
                dosagem: '100mg',
                horarios: [hh >= 2 ? spTime : '00:01'],
                dias_semana: [],
                treatment_type: 'continuo',
                start_date: null,
                end_date: null,
                created_at: createdYesterday,
              },
            ],
          };
        }
        if (sql.includes('FROM historico_doses') || sql.includes('FROM notification_logs')) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.includes('INSERT INTO notificacoes')) {
          insertedNotifs.push({ sql, params });
          return { rowCount: 1, rows: [{ id: params[0] }] };
        }
        if (sql.includes('INSERT INTO notification_logs')) {
          insertedLogs.push({ sql, params });
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    const res = await checkOverdueDosesForCaregivers(mockClient);
    expect(res.alertsCreated).toBe(1);
    expect(insertedNotifs.length).toBe(1);
    expect(insertedNotifs[0].sql).toContain("'atraso'");
    expect(insertedNotifs[0].params[2]).toContain('Hidantal');
    expect(insertedNotifs[0].params[3]).toContain('Marcela');
    expect(insertedLogs.length).toBe(1);
    expect(mm).toBeGreaterThanOrEqual(0);
  });
});
