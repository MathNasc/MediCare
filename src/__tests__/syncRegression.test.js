/**
 * @jest-environment node
 */

jest.mock('@/lib/oracleProxy', () => ({
  connectPgOrFallback: jest.fn(),
}));

jest.mock('@/lib/oraclePostgres', () => ({
  ensureOraclePostgresSchema: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/reminderWorker', () => ({
  ensureOverdueCaregiverScheduler: jest.fn(),
}));

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
}));

import { POST as syncPost } from '@/app/api/v1/sync/route';
import { connectPgOrFallback } from '@/lib/oracleProxy';
import webpush from 'web-push';
import {
  checkOverdueDosesForCaregivers,
  notifyCaregiversOfSosUsage,
} from '@/lib/caregiverNotifications';

const PATIENT_ID = '06b6da39-cc07-41ed-a417-7583927d1385';
const CAREGIVER_ID = '98e5cdc4-7866-43e5-9c90-ebb712ecd816';
const REL_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function createPgTxSimulator({
  failOnPatterns = [],
  existingCaregiverPair = false,
  pushSubscriptionRows = [{ id: 'sub-1', user_id: CAREGIVER_ID, endpoint: 'https://push.example/1', p256dh: 'p256', auth: 'auth' }],
  initialInTx = false,
  initialAborted = false,
} = {}) {
  let inTx = Boolean(initialInTx);
  let aborted = Boolean(initialAborted);
  const savepointStack = [];
  const callLog = [];

  const client = {
    release: jest.fn(),
    query: jest.fn(async (rawSql, params = []) => {
      const sql = String(rawSql || '').trim();
      const upper = sql.toUpperCase();
      callLog.push({ sql, params, inTx, aborted, savepoints: [...savepointStack] });

      if (upper === 'BEGIN') {
        inTx = true;
        aborted = false;
        savepointStack.length = 0;
        return { rows: [], rowCount: 0 };
      }
      if (upper === 'COMMIT') {
        if (aborted) {
          const err = new Error('current transaction is aborted, commands ignored until end of transaction block');
          err.code = '25P02';
          throw err;
        }
        inTx = false;
        savepointStack.length = 0;
        return { rows: [], rowCount: 0 };
      }
      if (upper === 'ROLLBACK') {
        inTx = false;
        aborted = false;
        savepointStack.length = 0;
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('SAVEPOINT ')) {
        const name = sql.slice(10).trim();
        savepointStack.push({ name, abortedBefore: aborted });
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('ROLLBACK TO SAVEPOINT ')) {
        const name = sql.slice(22).trim();
        const idx = savepointStack.map((s) => s.name).lastIndexOf(name);
        if (idx !== -1) {
          aborted = savepointStack[idx].abortedBefore;
          savepointStack.length = idx + 1;
        }
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('RELEASE SAVEPOINT ')) {
        const name = sql.slice(18).trim();
        const idx = savepointStack.map((s) => s.name).lastIndexOf(name);
        if (idx !== -1) {
          savepointStack.splice(idx, 1);
        }
        return { rows: [], rowCount: 0 };
      }

      if (inTx && aborted) {
        const err = new Error('current transaction is aborted, commands ignored until end of transaction block');
        err.code = '25P02';
        throw err;
      }

      for (const pattern of failOnPatterns) {
        if (pattern.match(sql, params)) {
          if (inTx) aborted = true;
          const err = new Error(pattern.message || 'Simulated DB constraint error');
          if (pattern.code) err.code = pattern.code;
          throw err;
        }
      }

      if (upper.includes('TXID_CURRENT_IF_ASSIGNED')) {
        return { rowCount: 1, rows: [{ txid: inTx ? 1 : null }] };
      }

      if (sql.includes('SELECT id FROM profiles WHERE id = $1')) {
        return { rowCount: 1, rows: [{ id: params[0] || PATIENT_ID }] };
      }
      if (sql.includes("table_name = 'medicamentos'") && sql.includes("column_name = 'horarios'")) {
        return { rowCount: 1, rows: [{ data_type: 'jsonb' }] };
      }
      if (sql.includes('patient_care_settings') || sql.includes('FROM care_settings')) {
        return {
          rowCount: 1,
          rows: [
            {
              patient_id: PATIENT_ID,
              config_mode: 'custom',
              group_id: null,
              caregiver_id: CAREGIVER_ID,
              overdue_notify_minutes: 60,
              require_caregiver_confirm: false,
              require_confirm_after_missed: true,
              require_confirm_undo: true,
              missed_dose_minutes: 180,
              allow_patient_med_edit: false,
              notify_low_stock: true,
              low_stock_threshold: 5,
              notify_sos_usage: true,
            },
          ],
        };
      }
      if (sql.includes('caregiver_patient_groups') || sql.includes('caregiver_global_settings')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT id, caregiver_id FROM caregiver_relationships')) {
        return { rowCount: 1, rows: [{ id: REL_ID, caregiver_id: CAREGIVER_ID }] };
      }
      if (sql.includes('SELECT id FROM caregiver_relationships WHERE patient_id = $1 AND caregiver_id = $2')) {
        return existingCaregiverPair
          ? { rowCount: 1, rows: [{ id: REL_ID }] }
          : { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT id, nome, dosagem, treatment_type FROM medicamentos WHERE id = $1')) {
        const isSos = String(params[0] || '').includes('2222');
        return {
          rowCount: 1,
          rows: [
            {
              id: params[0],
              nome: isSos ? 'Dipirona SOS' : 'Sertralina',
              dosagem: isSos ? '500mg' : '150mg',
              treatment_type: isSos ? 'sos' : 'continuous',
            },
          ],
        };
      }
      if (sql.includes('SELECT 1 FROM medicamentos WHERE id = $1')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (sql.includes('SELECT status, updated_at FROM approval_requests WHERE id = $1')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FROM push_subscriptions')) {
        return { rowCount: pushSubscriptionRows.length, rows: pushSubscriptionRows };
      }
      if (upper.startsWith('INSERT INTO NOTIFICACOES') && upper.includes('RETURNING ID')) {
        return { rowCount: 1, rows: [{ id: params[0] || 'notif-1' }] };
      }

      return { rows: [], rowCount: 1 };
    }),
  };

  return { client, callLog };
}

function buildPostRequest(payload) {
  return {
    method: 'POST',
    url: 'https://medicare-cuidador.duckdns.org/api/v1/sync',
    headers: {
      get: () => null,
    },
    async json() {
      return payload;
    },
  };
}

describe('Regressão de Sincronização (POST /api/v1/sync e Notificações)', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key-fixture';
    process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key-fixture';
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('sincroniza medicamentos SOS (horarios: []), normaliza "pulado" para "missed", grava solicitações e envia Web Push APENAS após COMMIT', async () => {
    const { client, callLog } = createPgTxSimulator({ existingCaregiverPair: true });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });

    let commitIndexDuringPush = -1;
    let pushCalledBeforeCommit = false;
    webpush.sendNotification.mockImplementation(async () => {
      const committed = callLog.some((c) => c.sql.toUpperCase() === 'COMMIT');
      if (!committed) pushCalledBeforeCommit = true;
      commitIndexDuringPush = callLog.findIndex((c) => c.sql.toUpperCase() === 'COMMIT');
      return { statusCode: 201 };
    });

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const payload = {
      user: {
        id: PATIENT_ID,
        nome: 'Maria Helena',
        role: 'paciente',
      },
      timezone: 'America/Sao_Paulo',
      meds: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nome: 'Sertralina',
          dosagem: '150mg',
          unidade: 'comprimido',
          quantidade: 16,
          horarios: ['09:00'],
          treatment_type: 'continuous',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nome: 'Dipirona SOS',
          dosagem: '500mg',
          unidade: 'comprimido',
          quantidade: 10,
          horarios: [],
          treatment_type: 'sos',
        },
      ],
      history: [
        {
          id: 'dose-sertralina-0900',
          med_id: '11111111-1111-4111-8111-111111111111',
          hora: '09:00',
          dose_date: today,
          status: 'pulado',
          atraso_minutos: 0,
          reason: 'Paciente recusou no horário',
        },
        {
          id: 'sos-dipirona-1',
          med_id: '22222222-2222-4222-8222-222222222222',
          hora: '10:30',
          dose_date: today,
          status: 'tomado',
          is_sos: true,
          motivo: 'Uso SOS - dor de cabeça',
        },
      ],
      pending_dose_requests: [
        {
          id: 'req-venvanse-0900',
          med_id: '33333333-3333-4333-8333-333333333333',
          med_nome: 'Venvanse',
          dose_date: today,
          hora: '09:00',
          requested_status: 'confirmed',
          action_type: 'confirm_dose',
          reason: 'Tomei com atraso',
          created_at_ms: Date.now(),
        },
      ],
      caregivers: [
        {
          id: REL_ID,
          caregiver_id: CAREGIVER_ID,
          status: 'Ativo',
          raw_status: 'active',
          permission_level: 'caregiver',
        },
      ],
    };

    const res = await syncPost(buildPostRequest(payload));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    // Verifica normalização de 'pulado' -> 'missed' no INSERT de historico_doses
    const histInserts = callLog.filter((c) => c.sql.includes('INSERT INTO historico_doses'));
    expect(histInserts).toHaveLength(2);
    expect(histInserts[0].params[5]).toBe('missed');
    expect(histInserts[1].params[5]).toBe('confirmed');

    // Verifica gravação da solicitação de aprovação e contadores retornados
    const approvalInserts = callLog.filter((c) => c.sql.includes('INSERT INTO approval_requests'));
    expect(approvalInserts).toHaveLength(1);
    expect(approvalInserts[0].params[4]).toBe('Venvanse');
    expect(approvalInserts[0].params[9]).toBe('Tomei com atraso');
    expect(json.counts?.pending_dose_requests).toBe(1);
    expect(json.counts?.approval_requests_saved).toBe(1);

    // Verifica COMMIT e push apenas pós-COMMIT
    expect(callLog.some((c) => c.sql.toUpperCase() === 'COMMIT')).toBe(true);
    expect(pushCalledBeforeCommit).toBe(false);
    expect(commitIndexDuringPush).toBeGreaterThan(-1);
    expect(webpush.sendNotification).toHaveBeenCalled();

    // Verifica que nenhum INSERT usou tipo inválido 'alerta'
    const invalidTipoNotifs = callLog.filter(
      (c) => c.sql.includes('INSERT INTO notificacoes') && c.sql.includes("'alerta'")
    );
    expect(invalidTipoNotifs).toHaveLength(0);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('mantém a transação íntegra via SAVEPOINT/ROLLBACK TO SAVEPOINT quando notificacoes, caregiver_notes e caregiver_relationships falham (sem erro 25P02)', async () => {
    const { client, callLog } = createPgTxSimulator({
      failOnPatterns: [
        {
          match: (sql) => sql.includes('INSERT INTO notificacoes'),
          message: 'violates check constraint "notificacoes_tipo_check"',
          code: '23514',
        },
        {
          match: (sql) => sql.includes('INSERT INTO caregiver_notes'),
          message: 'violates foreign key constraint "caregiver_notes_relationship_id_fkey"',
          code: '23503',
        },
        {
          match: (sql) => sql.includes('INSERT INTO caregiver_relationships'),
          message: 'duplicate key value violates unique constraint "caregiver_relationships_invite_token_key"',
          code: '23505',
        },
      ],
    });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });

    const payload = {
      user: {
        id: PATIENT_ID,
        nome: 'Maria Helena',
        role: 'paciente',
      },
      timezone: 'America/Sao_Paulo',
      meds: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nome: 'Hidantal',
          dosagem: '100mg',
          quantidade: 350,
          horarios: ['09:00'],
          treatment_type: 'continuous',
        },
      ],
      history: [
        {
          id: 'dose-hidantal-0900',
          med_id: '11111111-1111-4111-8111-111111111111',
          hora: '09:00',
          dose_date: '2026-11-20',
          status: 'tomado',
        },
      ],
      pending_dose_requests: [
        {
          id: 'req-venvanse-0900',
          med_id: '33333333-3333-4333-8333-333333333333',
          med_nome: 'Venvanse',
          dose_date: '2026-11-20',
          hora: '09:00',
          requested_status: 'confirmed',
          action_type: 'confirm_dose',
          reason: 'Tomei com atraso',
        },
      ],
      caregivers: [
        {
          id: 'cg-local-1',
          caregiver_id: CAREGIVER_ID,
          invite_code: 'DUPLICADO123',
          status: 'Ativo',
          raw_status: 'active',
        },
      ],
    };

    const res = await syncPost(buildPostRequest(payload));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(callLog.some((c) => c.sql.toUpperCase() === 'COMMIT')).toBe(true);
    expect(callLog.some((c) => c.sql.toUpperCase().startsWith('ROLLBACK TO SAVEPOINT '))).toBe(true);
    expect(callLog.some((c) => c.sql.toUpperCase() === 'ROLLBACK')).toBe(false);
  });

  it('usa tipos válidos ("critico" e "estoque") nas notificações de SOS e estoque baixo em caregiverNotifications', async () => {
    const queries = [];
    const mockClient = {
      query: jest.fn(async (sql, params) => {
        const s = String(sql || '');
        queries.push({ sql: s, params });
        if (s.includes('FROM caregiver_relationships cr')) {
          return { rowCount: 1, rows: [{ patient_id: PATIENT_ID, caregiver_id: CAREGIVER_ID, patient_name: 'Maria' }] };
        }
        if (s.includes('FROM care_settings')) return { rowCount: 0, rows: [] };
        if (s.includes('FROM care_groups')) return { rowCount: 0, rows: [] };
        if (s.includes('FROM patient_care_preferences')) return { rowCount: 0, rows: [] };
        if (s.includes('FROM medicamentos')) {
          return {
            rowCount: 1,
            rows: [
              {
                id: 'med-sos-1',
                user_id: PATIENT_ID,
                nome: 'Dipirona',
                dosagem: '500mg',
                unidade: 'comprimido',
                quantidade: 2,
                horarios: [],
                dias_semana: [],
                treatment_type: 'sos',
              },
            ],
          };
        }
        if (s.includes('FROM notification_logs')) return { rowCount: 0, rows: [] };
        if (s.includes('INSERT INTO notificacoes')) return { rowCount: 1, rows: [{ id: 'n-1' }] };
        if (s.includes('FROM push_subscriptions')) return { rowCount: 0, rows: [] };
        return { rowCount: 0, rows: [] };
      }),
    };

    await notifyCaregiversOfSosUsage(mockClient, {
      patientId: PATIENT_ID,
      patientName: 'Maria',
      caregiverIds: [CAREGIVER_ID],
      doseId: 'dose-sos-1',
      medNome: 'Dipirona',
      hora: '11:00',
      doseDate: '2026-11-20',
      deferPush: true,
      useSavepoint: true,
    });

    await checkOverdueDosesForCaregivers(mockClient, {
      now: new Date('2026-11-20T15:00:00Z'),
    });

    const notifInserts = queries.filter((q) => q.sql.includes('INSERT INTO notificacoes'));
    expect(notifInserts.some((q) => q.sql.includes("'critico'"))).toBe(true);
    expect(notifInserts.some((q) => q.sql.includes("'estoque'"))).toBe(true);
    expect(notifInserts.some((q) => q.sql.includes("'alerta'"))).toBe(false);
  });

  it('isola erros em datas/timestamps inválidos, item legado de histórico, health_events e stock_movements sem perder doses válidas ou aprovações', async () => {
    const { client, callLog } = createPgTxSimulator({
      failOnPatterns: [
        {
          match: (sql, params) =>
            sql.includes('INSERT INTO historico_doses') &&
            String(params?.[8] || '').includes('ITEM_QUEBRADO'),
          message: 'simulated constraint failure on single legacy history item',
          code: '23514',
        },
        {
          match: (sql) => sql.includes('INSERT INTO health_events'),
          message: 'simulated health_events constraint failure',
          code: '22007',
        },
        {
          match: (sql) => sql.includes('INSERT INTO stock_movements'),
          message: 'simulated stock_movements numeric overflow',
          code: '22003',
        },
      ],
    });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const payload = {
      user: {
        id: PATIENT_ID,
        nome: 'Marcela',
        role: 'paciente',
        dob: '2026-02-30',
      },
      timezone: 'America/Sao_Paulo',
      meds: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nome: 'Sertralina',
          dosagem: '150mg',
          quantidade: 9999999999999,
          treatment_days: 9999999999999,
          start_date: '2026-02-30',
          end_date: '2026-13-40',
          horarios: ['09:00'],
          treatment_type: 'continuous',
        },
      ],
      history: [
        {
          id: 'dose-broken-legacy',
          med_id: '11111111-1111-4111-8111-111111111111',
          hora: '25:99',
          dose_date: '2026-02-30',
          status: 'tomado',
          reason: 'ITEM_QUEBRADO',
          administered_at: 'not-a-timestamp',
        },
        {
          id: 'dose-sertralina-2355',
          med_id: '11111111-1111-4111-8111-111111111111',
          hora: '23:55',
          dose_date: today,
          status: 'tomado',
          atraso_minutos: 5,
          administered_at: 'data-invalida-locale',
        },
        {
          id: 'sos-clamp-check',
          med_id: '11111111-1111-4111-8111-111111111111',
          hora: '10:30',
          dose_date: today,
          status: 'tomado',
          is_sos: true,
          reason: 'Uso SOS - clamp int4',
          atraso_minutos: 99999999999,
          administered_at: 'data-invalida-locale',
        },
      ],
      events: [
        {
          id: 'ev-1',
          title: 'Consulta',
          date: today,
          time: '25:99',
        },
      ],
      stock_movements: [
        {
          id: 'sm-1',
          med_id: '11111111-1111-4111-8111-111111111111',
          quantity_before: 17,
          quantity_changed: -1,
          quantity_after: 16,
          created_at: 'not-valid',
        },
      ],
      pending_dose_requests: [
        {
          id: 'req-venvanse-0900',
          med_id: '33333333-3333-4333-8333-333333333333',
          med_nome: 'Venvanse',
          dose_date: today,
          hora: '09:00',
          requested_status: 'confirmed',
          action_type: 'confirm_dose',
          reason: 'Tomei com atraso',
        },
      ],
    };

    const res = await syncPost(buildPostRequest(payload));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(callLog.some((c) => c.sql.toUpperCase() === 'COMMIT')).toBe(true);
    expect(callLog.some((c) => c.sql.toUpperCase() === 'ROLLBACK')).toBe(false);

    // O medicamento teve datas inválidas sanitizadas para null e inteiros limitados a int4
    const medInsert = callLog.find((c) => c.sql.includes('INSERT INTO medicamentos'));
    expect(medInsert).toBeTruthy();
    expect(medInsert.params[10]).toBe(2147483647);
    expect(medInsert.params[16]).toBeNull();
    expect(medInsert.params[17]).toBeNull();
    expect(medInsert.params[18]).toBe(2147483647);

    // A dose válida e o uso SOS foram inseridos com administered_at null e atraso_minutos limitado a int4
    const validScheduledInsert = callLog.find(
      (c) => c.sql.includes('INSERT INTO historico_doses') && c.params?.[3] === '23:55'
    );
    expect(validScheduledInsert).toBeTruthy();
    expect(validScheduledInsert.params[13]).toBe(5);
    expect(validScheduledInsert.params[14]).toBeNull();

    const validSosInsert = callLog.find(
      (c) =>
        c.sql.includes('INSERT INTO historico_doses') &&
        String(c.params?.[8] || '').includes('Uso SOS - clamp int4')
    );
    expect(validSosInsert).toBeTruthy();
    expect(validSosInsert.params[13]).toBe(2147483647);
    expect(validSosInsert.params[14]).toBeNull();

    // A solicitação pendente ao cuidador foi preservada
    expect(callLog.some((c) => c.sql.includes('INSERT INTO approval_requests'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('registra console.error estruturado quando ocorre erro fatal na transação de sync', async () => {
    const { client } = createPgTxSimulator({
      failOnPatterns: [
        {
          match: (sql) => sql.includes('INSERT INTO profiles'),
          message: 'simulated fatal profiles failure',
          code: '22001',
        },
      ],
    });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await syncPost(
      buildPostRequest({
        user: { id: PATIENT_ID, nome: 'Marcela', role: 'paciente' },
        meds: [],
        history: [],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(errSpy).toHaveBeenCalledWith(
      '[sync] POST fatal error:',
      expect.objectContaining({
        userId: PATIENT_ID,
        code: '22001',
        message: 'simulated fatal profiles failure',
      })
    );
    errSpy.mockRestore();
  });

  it('salva solicitação de aprovação com caregiver_id=null quando o primeiro INSERT falha por FK', async () => {
    const { client, callLog } = createPgTxSimulator({
      failOnPatterns: [
        {
          match: (sql, params) =>
            sql.includes('INSERT INTO approval_requests') && params?.[2] === CAREGIVER_ID,
          message: 'insert or update on table "approval_requests" violates foreign key constraint "approval_requests_caregiver_id_fkey"',
          code: '23503',
        },
      ],
    });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const res = await syncPost(
      buildPostRequest({
        user: { id: PATIENT_ID, nome: 'Marcela', role: 'paciente' },
        timezone: 'America/Sao_Paulo',
        meds: [],
        history: [],
        pending_dose_requests: [
          {
            id: 'req-fk-fallback-1',
            med_id: '33333333-3333-4333-8333-333333333333',
            med_nome: 'Venvanse',
            dose_date: today,
            hora: '09:00',
            requested_status: 'confirmed',
            action_type: 'confirm_dose',
            reason: 'Tomei no horário correto',
            created_at_ms: Date.now(),
          },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.counts?.pending_dose_requests).toBe(1);
    expect(json.counts?.approval_requests_saved).toBe(1);

    const approvalInserts = callLog.filter((c) => c.sql.includes('INSERT INTO approval_requests'));
    expect(approvalInserts).toHaveLength(2);
    expect(approvalInserts[0].params[2]).toBe(CAREGIVER_ID);
    expect(approvalInserts[1].params[2]).toBeNull();
    expect(callLog.some((c) => c.sql.toUpperCase() === 'COMMIT')).toBe(true);
    warnSpy.mockRestore();
  });

  it('recupera automaticamente conexão do pool que chegou em transação abortada (25P02) antes do POST /api/v1/sync', async () => {
    const { client, callLog } = createPgTxSimulator({
      initialInTx: true,
      initialAborted: true,
    });
    connectPgOrFallback.mockResolvedValue({ client, fallbackResponse: null });

    const res = await syncPost(
      buildPostRequest({
        user: { id: PATIENT_ID, nome: 'Marcela', role: 'paciente' },
        timezone: 'America/Sao_Paulo',
        meds: [],
        history: [],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    const rollbackIdx = callLog.findIndex((c) => c.sql.toUpperCase() === 'ROLLBACK');
    const beginIdx = callLog.findIndex((c) => c.sql.toUpperCase() === 'BEGIN');
    const commitIdx = callLog.findIndex((c) => c.sql.toUpperCase() === 'COMMIT');

    expect(rollbackIdx).toBeGreaterThan(-1);
    expect(beginIdx).toBeGreaterThan(rollbackIdx);
    expect(commitIdx).toBeGreaterThan(beginIdx);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
