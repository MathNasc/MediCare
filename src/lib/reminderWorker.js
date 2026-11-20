import crypto from 'crypto';
import webpush from 'web-push';
import {
  getPgPool,
  ensureOraclePostgresSchema,
  ensureCleanPgClient,
  safeReleasePgClient,
} from './oraclePostgres';
import {
  checkOverdueDosesForCaregivers,
  configureWebPush,
  getLocalDateAndMinutes,
} from './caregiverNotifications';

/**
 * Worker de Agendamento e Lembretes (Substituto nativo do pg_cron + Edge Function send-medication-reminders)
 * Projetado para consumo mínimo de CPU/RAM no Oracle Cloud Free Tier.
 */
export async function runMedicationReminderWorker() {
  const pool = getPgPool();
  if (!pool) {
    return { ok: false, skipped: true, reason: 'PostgreSQL Oracle ainda não configurado.' };
  }

  const pushEnabled = configureWebPush();
  const client = await pool.connect();

  let expiredFinished = 0;
  let sent = 0;
  let failed = 0;
  let ignored = 0;
  let caregiverOverdueAlerts = 0;

  try {
    await ensureCleanPgClient(client);
    await ensureOraclePostgresSchema(client);
    const { todayIso, currentMinutes } = getLocalDateAndMinutes('America/Sao_Paulo');

    // 1. Encerrar automaticamente tratamentos temporários vencidos
    const expRes = await client.query(
      `UPDATE medicamentos
       SET status = 'concluido', finished_at = NOW(), ativo = FALSE
       WHERE treatment_type IN ('temporary', 'temporario')
         AND status = 'ativo'
         AND end_date IS NOT NULL
         AND end_date <> ''
         AND end_date < $1
       RETURNING id`,
      [todayIso]
    );
    expiredFinished = expRes.rowCount || 0;

    // 2. Verificar doses não tomadas após 1h (+60 min) e gerar notificações + push para cuidadores
    const cgOverdue = await checkOverdueDosesForCaregivers(client, { timeZone: 'America/Sao_Paulo' }).catch(() => ({
      alertsCreated: 0,
      pushSent: 0,
    }));
    caregiverOverdueAlerts = cgOverdue.alertsCreated || 0;
    sent += cgOverdue.pushSent || 0;

    if (!pushEnabled) {
      return {
        ok: true,
        expiredFinished,
        caregiverOverdueAlerts,
        sent,
        failed: 0,
        ignored: 0,
        note: 'VAPID keys não configuradas; alertas persistentes de cuidador e encerramento de tratamentos executados.',
      };
    }

    // 3. Buscar medicamentos ativos, assinaturas push e vínculos de cuidadores para lembretes de dose
    const medsRes = await client.query(
      `SELECT id, user_id, nome, dosagem, unidade, quantidade, horarios, dias_semana, treatment_type, start_date, end_date
       FROM medicamentos
       WHERE ativo = TRUE`
    );

    const subsRes = await client.query(`SELECT * FROM push_subscriptions`);
    const subsByUser = new Map();
    for (const sub of subsRes.rows) {
      if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
      subsByUser.get(sub.user_id).push(sub);
    }

    const cgRes = await client.query(
      `SELECT patient_id, caregiver_id FROM caregiver_relationships WHERE status = 'active' AND caregiver_id IS NOT NULL`
    );
    const caregiversByPatient = new Map();
    for (const rel of cgRes.rows) {
      if (!caregiversByPatient.has(rel.patient_id)) caregiversByPatient.set(rel.patient_id, []);
      caregiversByPatient.get(rel.patient_id).push(rel.caregiver_id);
    }

    const profRes = await client.query(`SELECT id, nome FROM profiles`);
    const patientNames = new Map();
    for (const p of profRes.rows) {
      patientNames.set(p.id, p.nome);
    }

    for (const med of medsRes.rows) {
      if (med.treatment_type === 'sos') continue;

      const userSubs = subsByUser.get(med.user_id) || [];
      const caregiverIds = caregiversByPatient.get(med.user_id) || [];
      const hasCgSub = caregiverIds.some((cgId) => (subsByUser.get(cgId) || []).length > 0);

      if (userSubs.length === 0 && !hasCgSub) continue;

      const horarios = Array.isArray(med.horarios) ? med.horarios : [];
      for (const hora of horarios) {
        const match = String(hora || '').trim().slice(0, 5).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!match) continue;

        const scheduledMinutes = Number(match[1]) * 60 + Number(match[2]);
        const diffMin = currentMinutes - scheduledMinutes;

        let targetType = null;
        if (diffMin >= 0 && diffMin <= 4) targetType = 'DOSE';
        else if (diffMin >= 10 && diffMin <= 14) targetType = 'REMINDER_1';
        else if (diffMin >= 20 && diffMin <= 24) targetType = 'REMINDER_2';

        if (!targetType) continue;

        const cleanHora = `${match[1]}:${match[2]}`;
        const histCheck = await client.query(
          `SELECT id FROM historico_doses
           WHERE med_id::text = $1::text AND LEFT(COALESCE(hora, ''), 5) = $2 AND COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $3 AND status IN ('confirmed', 'tomado', 'late', 'missed')
           LIMIT 1`,
          [String(med.id), cleanHora, todayIso]
        );
        if (histCheck.rowCount > 0) {
          ignored++;
          continue;
        }

        const logCheck = await client.query(
          `SELECT id FROM notification_logs
           WHERE med_id::text = $1::text AND dose_hora = $2 AND data_referencia = $3 AND tipo = $4
           LIMIT 1`,
          [String(med.id), cleanHora, todayIso, targetType]
        );
        if (logCheck.rowCount > 0) {
          ignored++;
          continue;
        }

        let title = `💊 ${med.nome}`;
        let body = `${med.dosagem || ''} · Horário: ${cleanHora}`;
        if (targetType === 'REMINDER_1') {
          title = `⚠️ Lembrete de Dose: ${med.nome}`;
          body = `Você esqueceu? Dose agendada para ${cleanHora}.`;
        } else if (targetType === 'REMINDER_2') {
          title = `🚨 Último Lembrete: ${med.nome}`;
          body = `Não esqueça de tomar o seu medicamento! (${cleanHora})`;
        }

        const payload = JSON.stringify({
          title,
          body,
          tag: `dose-${med.id}-${cleanHora}`,
          medId: med.id,
          hora: cleanHora,
          doseId: `${med.id}-${cleanHora.replace(':', '')}`,
          url: `/?action=confirm&medId=${med.id}&hora=${cleanHora}`,
        });

        let anySent = false;
        for (const sub of userSubs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { urgency: 'high' }
            );
            sent++;
            anySent = true;
          } catch (err) {
            failed++;
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]).catch(() => {});
            }
          }
        }

        if (targetType === 'REMINDER_2') {
          const patientName = patientNames.get(med.user_id) || 'Seu paciente';
          const cgPayload = JSON.stringify({
            title: `⚠️ Dose Atrasada: ${med.nome}`,
            body: `${patientName} ainda não confirmou a dose das ${cleanHora}.`,
            tag: `cg-dose-${med.id}-${cleanHora}`,
            url: '/cuidador',
          });

          for (const cgId of caregiverIds) {
            for (const cgSub of subsByUser.get(cgId) || []) {
              try {
                await webpush.sendNotification(
                  { endpoint: cgSub.endpoint, keys: { p256dh: cgSub.p256dh, auth: cgSub.auth } },
                  cgPayload,
                  { urgency: 'high' }
                );
                sent++;
                anySent = true;
              } catch (err) {
                failed++;
                if (err?.statusCode === 404 || err?.statusCode === 410) {
                  await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [cgSub.id]).catch(() => {});
                }
              }
            }
          }
        }

        if (anySent || userSubs.length === 0) {
          await client
            .query(
              `INSERT INTO notification_logs (id, user_id, med_id, dose_hora, data_referencia, tipo)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [crypto.randomUUID(), med.user_id, med.id, cleanHora, todayIso, targetType]
            )
            .catch(() => {});
        }
      }
    }

    return {
      ok: true,
      expiredFinished,
      caregiverOverdueAlerts,
      sent,
      failed,
      ignored,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await safeReleasePgClient(client);
  }
}

export function ensureOverdueCaregiverScheduler() {
  if (typeof globalThis === 'undefined' || globalThis.__medicareReminderIntervalStarted) {
    return;
  }
  if (process.env.NODE_ENV === 'test') return;
  globalThis.__medicareReminderIntervalStarted = true;

  const timer = setInterval(() => {
    runMedicationReminderWorker().catch(() => {});
  }, 180_000);
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
}
