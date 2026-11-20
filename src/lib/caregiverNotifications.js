import crypto from 'crypto';
import webpush from 'web-push';
import {
  DEFAULT_CARE_SETTINGS,
  fetchCareSettingsMapForPatients,
  formatMinutesLabelPt,
} from '@/lib/careSettings';

const WEEKDAY_NAMES_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function toDeterministicUuid(rawId, prefix = 'medicare') {
  const str = String(rawId || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const seed = `${prefix}:${str || crypto.randomUUID()}`;
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
}

export function configureWebPush() {
  const pub = getVapidPublicKey();
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  const email = process.env.VAPID_CONTACT_EMAIL || 'suporte@medicare.app';
  if (pub && priv) {
    try {
      webpush.setVapidDetails(`mailto:${email}`, pub, priv);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function getLocalDateAndMinutes(timeZone = 'America/Sao_Paulo', dateRef = new Date()) {
  try {
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateRef);

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(dateRef);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const [y, m, d] = todayIso.split('-').map(Number);
    const weekdayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    return {
      todayIso,
      currentMinutes: hour * 60 + minute,
      weekdayIndex,
    };
  } catch {
    const shifted = new Date(dateRef.getTime() - 3 * 60 * 60 * 1000);
    return {
      todayIso: shifted.toISOString().slice(0, 10),
      currentMinutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
      weekdayIndex: shifted.getUTCDay(),
    };
  }
}

export function matchesMedicationWeekday(diasSemana, weekdayIndex) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) return true;
  const targetShort = WEEKDAY_NAMES_PT[weekdayIndex] || '';
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

export async function sendWebPushToUsers(client, userIds, payloadObj) {
  const cleanIds = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
  if (cleanIds.length === 0) return { sent: 0, failed: 0 };
  if (!configureWebPush()) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const subsRes = await client
    .query(`SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id::text = ANY($1::text[])`, [
      cleanIds,
    ])
    .catch(() => ({ rows: [] }));

  const payload = JSON.stringify(payloadObj);

  for (const sub of subsRes.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { urgency: 'high' }
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]).catch(() => {});
      }
    }
  }

  return { sent, failed };
}

/**
 * Notifica cuidadores ativos quando o paciente solicita confirmar ou desfazer uma dose.
 */
export async function notifyCaregiversOfDoseRequest(
  client,
  {
    patientId,
    patientName,
    caregiverRows = [],
    reqUuid,
    medNome,
    hora,
    doseDate,
    reason,
    isUndo = false,
    isNewOrReopened = true,
    deferPush = false,
    useSavepoint = false,
  }
) {
  const notifTitle = isUndo
    ? `Solicitação para Desfazer Dose — ${medNome}`
    : `Solicitação para Confirmar Dose — ${medNome}`;
  const notifMsg = isUndo
    ? `${patientName} solicitou desfazer a dose de ${medNome} (${hora} em ${doseDate}). Motivo: "${reason}".`
    : `${patientName} solicitou confirmar a dose de ${medNome} (${hora} em ${doseDate}). Motivo: "${reason}".`;

  const caregiverIds = [];
  for (const cgRow of caregiverRows) {
    if (!cgRow?.caregiver_id) continue;
    caregiverIds.push(String(cgRow.caregiver_id));
    const cgNotifId = toDeterministicUuid(`notif:cg:${cgRow.caregiver_id}:${reqUuid}`, `notif:${cgRow.caregiver_id}`);

    if (useSavepoint) {
      await client.query('SAVEPOINT sp_cg_req_notif').catch(() => {});
    }
    try {
      if (isNewOrReopened) {
        await client.query(
          `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
           VALUES ($1,$2,'cuidador',$3,$4,false)
           ON CONFLICT (id) DO UPDATE SET
             titulo = EXCLUDED.titulo,
             mensagem = EXCLUDED.mensagem,
             lida = false,
             created_at = NOW()`,
          [cgNotifId, cgRow.caregiver_id, notifTitle, notifMsg]
        );
      } else {
        await client.query(
          `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
           VALUES ($1,$2,'cuidador',$3,$4,false)
           ON CONFLICT (id) DO NOTHING`,
          [cgNotifId, cgRow.caregiver_id, notifTitle, notifMsg]
        );
      }
      if (useSavepoint) {
        await client.query('RELEASE SAVEPOINT sp_cg_req_notif').catch(() => {});
      }
    } catch {
      if (useSavepoint) {
        await client.query('ROLLBACK TO SAVEPOINT sp_cg_req_notif').catch(() => {});
        await client.query('RELEASE SAVEPOINT sp_cg_req_notif').catch(() => {});
      }
    }
  }

  const pendingPush =
    isNewOrReopened && caregiverIds.length > 0
      ? {
          userIds: caregiverIds,
          payload: {
            title: isUndo ? `↩️ Desfazer dose: ${medNome}` : `🔔 Confirmação de dose: ${medNome}`,
            body: `${patientName} pediu para ${isUndo ? 'desfazer' : 'confirmar'} ${medNome} (${hora}). Motivo: ${reason}`,
            tag: `cg-req-${reqUuid}`,
            url: '/cuidador',
          },
        }
      : null;

  if (pendingPush && !deferPush) {
    await sendWebPushToUsers(client, pendingPush.userIds, pendingPush.payload);
  }

  return {
    caregiverCount: caregiverIds.length,
    patientId,
    pendingPushes: pendingPush ? [pendingPush] : [],
  };
}

/**
 * Notifica cuidadores ativos quando o paciente registra uma dose SOS.
 */
export async function notifyCaregiversOfSosUsage(
  client,
  {
    patientId,
    patientName,
    caregiverIds = [],
    doseId,
    medNome,
    dosagem = '',
    hora,
    doseDate,
    reason = 'Uso SOS',
    deferPush = false,
    useSavepoint = false,
  }
) {
  const cleanCgIds = Array.from(new Set((caregiverIds || []).filter(Boolean).map(String)));
  if (cleanCgIds.length === 0) return { alertsCreated: 0, pushSent: 0, pendingPushes: [] };

  const title = `🆘 Uso SOS registrado — ${medNome}`;
  const body = `${patientName} utilizou ${medNome}${dosagem ? ` (${dosagem})` : ''} em modo SOS às ${hora} (${doseDate}). Motivo: ${reason}.`;

  let alertsCreated = 0;
  const newCgIds = [];

  for (const cgId of cleanCgIds) {
    const notifId = toDeterministicUuid(`sos:${cgId}:${doseId}`, `notif:${cgId}`);
    if (useSavepoint) {
      await client.query('SAVEPOINT sp_cg_sos_notif').catch(() => {});
    }
    let insRes = { rowCount: 0 };
    try {
      insRes = await client.query(
        `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
         VALUES ($1, $2, 'critico', $3, $4, FALSE)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [notifId, cgId, title, body]
      );
      if (useSavepoint) {
        await client.query('RELEASE SAVEPOINT sp_cg_sos_notif').catch(() => {});
      }
    } catch {
      if (useSavepoint) {
        await client.query('ROLLBACK TO SAVEPOINT sp_cg_sos_notif').catch(() => {});
        await client.query('RELEASE SAVEPOINT sp_cg_sos_notif').catch(() => {});
      }
    }

    if (insRes.rowCount > 0) {
      alertsCreated += 1;
      newCgIds.push(cgId);
    }
  }

  const pendingPush =
    newCgIds.length > 0
      ? {
          userIds: newCgIds,
          payload: {
            title,
            body,
            tag: `cg-sos-${doseId}`,
            url: '/cuidador',
          },
        }
      : null;

  let pushSent = 0;
  if (pendingPush && !deferPush) {
    const pushRes = await sendWebPushToUsers(client, pendingPush.userIds, pendingPush.payload);
    pushSent = pushRes.sent;
  }

  return {
    alertsCreated,
    pushSent,
    pendingPushes: pendingPush ? [pendingPush] : [],
  };
}

/**
 * Verifica doses previstas sem confirmação conforme o período configurado por paciente
 * no Painel de Gerenciamento e também alerta estoque baixo quando habilitado.
 */
export async function checkOverdueDosesForCaregivers(client, options = {}) {
  const { caregiverId = null, timeZone = 'America/Sao_Paulo', now = new Date() } = options;
  const { todayIso, currentMinutes, weekdayIndex } = getLocalDateAndMinutes(timeZone, now);

  const cgParams = [];
  let cgSql = `
    SELECT cr.patient_id, cr.caregiver_id, p.nome AS patient_name
    FROM caregiver_relationships cr
    LEFT JOIN profiles p ON p.id::text = cr.patient_id::text
    WHERE cr.status = 'active'
      AND cr.caregiver_id IS NOT NULL
  `;
  if (caregiverId) {
    cgParams.push(String(caregiverId));
    cgSql += ` AND cr.caregiver_id::text = $1::text`;
  }

  const cgRes = await client.query(cgSql, cgParams);
  if (cgRes.rowCount === 0) {
    return { alertsCreated: 0, pushSent: 0 };
  }

  const caregiversByPatient = new Map();
  const patientNames = new Map();
  for (const row of cgRes.rows) {
    const pid = String(row.patient_id);
    if (!caregiversByPatient.has(pid)) caregiversByPatient.set(pid, []);
    caregiversByPatient.get(pid).push(String(row.caregiver_id));
    if (row.patient_name) patientNames.set(pid, row.patient_name);
  }

  const patientIds = Array.from(caregiversByPatient.keys());
  if (patientIds.length === 0) {
    return { alertsCreated: 0, pushSent: 0 };
  }

  // Se filtramos por cuidador específico, ainda precisamos de TODOS os cuidadores ativos desses pacientes
  if (caregiverId) {
    const allCgRes = await client.query(
      `SELECT patient_id, caregiver_id FROM caregiver_relationships
       WHERE status = 'active' AND caregiver_id IS NOT NULL AND patient_id::text = ANY($1::text[])`,
      [patientIds]
    );
    for (const row of allCgRes.rows) {
      const pid = String(row.patient_id);
      const list = caregiversByPatient.get(pid) || [];
      if (!list.includes(String(row.caregiver_id))) {
        list.push(String(row.caregiver_id));
        caregiversByPatient.set(pid, list);
      }
    }
  }

  // Carrega configurações efetivas (Grupo -> Global -> Individual) de cada paciente
  const settingsByPatient = await fetchCareSettingsMapForPatients(client, patientIds, caregiversByPatient);

  const medsRes = await client.query(
    `SELECT id, user_id, nome, dosagem, unidade, quantidade, horarios, dias_semana, treatment_type, start_date, end_date, created_at
     FROM medicamentos
     WHERE user_id::text = ANY($1::text[])
       AND COALESCE(ativo, TRUE) = TRUE
       AND COALESCE(status, 'ativo') NOT IN ('cancelado', 'concluido')`,
    [patientIds]
  );

  let alertsCreated = 0;
  let pushSent = 0;

  for (const med of medsRes.rows) {
    const pid = String(med.user_id);
    const patientName = patientNames.get(pid) || 'Paciente';
    const cgIds = caregiversByPatient.get(pid) || [];
    if (cgIds.length === 0) continue;

    const patSettings = settingsByPatient.get(pid) || DEFAULT_CARE_SETTINGS;

    // 1. Verificação de estoque baixo configurada no Painel de Gerenciamento
    if (patSettings.notify_low_stock) {
      const qtyNum = Number(med.quantidade);
      if (Number.isFinite(qtyNum) && qtyNum <= patSettings.low_stock_threshold) {
        const stockLogCheck = await client
          .query(
            `SELECT id FROM notification_logs
             WHERE med_id::text = $1::text
               AND dose_hora = 'STOCK'
               AND data_referencia = $2
               AND tipo = 'CAREGIVER_LOW_STOCK'
             LIMIT 1`,
            [String(med.id), todayIso]
          )
          .catch(() => ({ rowCount: 0 }));

        if (stockLogCheck.rowCount === 0) {
          const stockTitle = `📦 Estoque baixo: ${med.nome}`;
          const unitLabel = med.unidade || 'unidades';
          const stockBody = `${patientName} está com apenas ${qtyNum} ${unitLabel} de ${med.nome} (limite configurado: ${patSettings.low_stock_threshold}).`;

          for (const cgId of cgIds) {
            const notifId = toDeterministicUuid(`lowstock:${cgId}:${med.id}:${todayIso}`, `notif:${cgId}`);
            const insRes = await client
              .query(
                `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
                 VALUES ($1, $2, 'estoque', $3, $4, FALSE)
                 ON CONFLICT (id) DO NOTHING
                 RETURNING id`,
                [notifId, cgId, stockTitle, stockBody]
              )
              .catch(() => ({ rowCount: 0 }));
            if (insRes.rowCount > 0) alertsCreated += 1;
          }

          const pushResult = await sendWebPushToUsers(client, cgIds, {
            title: stockTitle,
            body: stockBody,
            tag: `cg-lowstock-${med.id}-${todayIso}`,
            url: '/cuidador',
          });
          pushSent += pushResult.sent;

          await client
            .query(
              `INSERT INTO notification_logs (id, user_id, med_id, dose_hora, data_referencia, tipo)
               VALUES ($1, $2, $3, 'STOCK', $4, 'CAREGIVER_LOW_STOCK')
               ON CONFLICT DO NOTHING`,
              [crypto.randomUUID(), pid, med.id, todayIso]
            )
            .catch(() => {});
        }
      }
    }

    // 2. Verificação de doses previstas sem confirmação
    if (String(med.treatment_type || '').toLowerCase() === 'sos') continue;
    const overdueNotifyMinutes = Number(patSettings.overdue_notify_minutes ?? 60);
    if (overdueNotifyMinutes <= 0) continue;
    if (med.start_date && String(med.start_date).slice(0, 10) > todayIso) continue;
    if (med.end_date && String(med.end_date).slice(0, 10) < todayIso) continue;
    if (!matchesMedicationWeekday(med.dias_semana, weekdayIndex)) continue;

    const horarios = Array.isArray(med.horarios) ? med.horarios : [];
    const medCreatedInfo = med.created_at
      ? getLocalDateAndMinutes(timeZone, new Date(med.created_at))
      : null;
    const delayLabel = formatMinutesLabelPt(overdueNotifyMinutes);

    for (const rawHora of horarios) {
      const hora = String(rawHora || '').trim().slice(0, 5);
      const match = hora.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!match) continue;

      const scheduledMinutes = Number(match[1]) * 60 + Number(match[2]);
      const diffMin = currentMinutes - scheduledMinutes;

      if (diffMin < overdueNotifyMinutes) continue;
      if (medCreatedInfo && medCreatedInfo.todayIso === todayIso && medCreatedInfo.currentMinutes > scheduledMinutes) {
        continue;
      }

      const histCheck = await client.query(
        `SELECT id FROM historico_doses
         WHERE med_id::text = $1::text
           AND LEFT(COALESCE(hora, ''), 5) = $2
           AND COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $3
           AND status IN ('confirmed', 'tomado', 'tomada', 'late', 'missed', 'pulada')
         LIMIT 1`,
        [String(med.id), hora, todayIso]
      );
      if (histCheck.rowCount > 0) continue;

      const logCheck = await client.query(
        `SELECT id FROM notification_logs
         WHERE med_id::text = $1::text
           AND dose_hora = $2
           AND data_referencia = $3
           AND tipo IN ('CAREGIVER_OVERDUE_1H', 'CAREGIVER_OVERDUE')
         LIMIT 1`,
        [String(med.id), hora, todayIso]
      );
      if (logCheck.rowCount > 0) continue;

      const title = `⏰ Dose não confirmada (+${delayLabel}): ${med.nome}`;
      const body = `${patientName} ainda não tomou ${med.nome}${med.dosagem ? ` (${med.dosagem})` : ''} previsto para ${hora}.`;

      for (const cgId of cgIds) {
        const notifId = toDeterministicUuid(`overdue1h:${cgId}:${med.id}:${todayIso}:${hora}`, `notif:${cgId}`);
        const insRes = await client
          .query(
            `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
             VALUES ($1, $2, 'atraso', $3, $4, FALSE)
             ON CONFLICT (id) DO NOTHING
             RETURNING id`,
            [notifId, cgId, title, body]
          )
          .catch(() => ({ rowCount: 0 }));
        if (insRes.rowCount > 0) alertsCreated += 1;
      }

      const pushResult = await sendWebPushToUsers(client, cgIds, {
        title,
        body,
        tag: `cg-overdue-${med.id}-${hora}-${todayIso}`,
        url: '/cuidador',
      });
      pushSent += pushResult.sent;

      await client
        .query(
          `INSERT INTO notification_logs (id, user_id, med_id, dose_hora, data_referencia, tipo)
           VALUES ($1, $2, $3, $4, $5, 'CAREGIVER_OVERDUE')
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), pid, med.id, hora, todayIso]
        )
        .catch(() => {});
    }
  }

  return { alertsCreated, pushSent };
}
