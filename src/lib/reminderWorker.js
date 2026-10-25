import crypto from 'crypto';
import webpush from 'web-push';
import { getPgPool, ensureOraclePostgresSchema } from './oraclePostgres';

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_CONTACT_EMAIL || 'suporte@medicare.app';
  if (pub && priv) {
    webpush.setVapidDetails(`mailto:${email}`, pub, priv);
    return true;
  }
  return false;
}

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

  try {
    await ensureOraclePostgresSchema(client);
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

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

    if (!pushEnabled) {
      return {
        ok: true,
        expiredFinished,
        sent: 0,
        failed: 0,
        ignored: 0,
        note: 'VAPID keys não configuradas; encerramento de tratamentos temporários executado.',
      };
    }

    // 2. Buscar medicamentos ativos, assinaturas push e vínculos de cuidadores
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
        const [h, m] = String(hora).split(':').map(Number);
        if (isNaN(h) || isNaN(m)) continue;

        const doseTime = new Date(now);
        doseTime.setHours(h, m, 0, 0);
        const diffMin = Math.floor((now.getTime() - doseTime.getTime()) / 60000);

        let targetType = null;
        if (diffMin >= 0 && diffMin <= 4) targetType = 'DOSE';
        else if (diffMin >= 10 && diffMin <= 14) targetType = 'REMINDER_1';
        else if (diffMin >= 20 && diffMin <= 24) targetType = 'REMINDER_2';

        if (!targetType) continue;

        // Verifica se a dose já foi confirmada hoje
        const histCheck = await client.query(
          `SELECT id FROM historico_doses
           WHERE med_id = $1 AND hora = $2 AND dose_date = $3 AND status IN ('confirmed', 'tomado')
           LIMIT 1`,
          [med.id, hora, todayIso]
        );
        if (histCheck.rowCount > 0) {
          ignored++;
          continue;
        }

        // Verifica idempotência em notification_logs
        const logCheck = await client.query(
          `SELECT id FROM notification_logs
           WHERE med_id = $1 AND dose_hora = $2 AND data_referencia = $3 AND tipo = $4
           LIMIT 1`,
          [med.id, hora, todayIso, targetType]
        );
        if (logCheck.rowCount > 0) {
          ignored++;
          continue;
        }

        let title = `💊 ${med.nome}`;
        let body = `${med.dosagem || ''} · Horário: ${hora}`;
        if (targetType === 'REMINDER_1') {
          title = `⚠️ Lembrete de Dose: ${med.nome}`;
          body = `Você esqueceu? Dose agendada para ${hora}.`;
        } else if (targetType === 'REMINDER_2') {
          title = `🚨 Último Lembrete: ${med.nome}`;
          body = `Não esqueça de tomar o seu medicamento! (${hora})`;
        }

        const payload = JSON.stringify({
          title,
          body,
          tag: `dose-${med.id}-${hora}`,
          medId: med.id,
          hora,
          doseId: `${med.id}-${hora.replace(':', '')}`,
          url: `/?action=confirm&medId=${med.id}&hora=${hora}`,
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
              await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
            }
          }
        }

        if (targetType === 'REMINDER_2') {
          const patientName = patientNames.get(med.user_id) || 'Seu paciente';
          const cgPayload = JSON.stringify({
            title: `🚨 Paciente Atrasado: ${med.nome}`,
            body: `${patientName} esqueceu a dose das ${hora}.`,
            tag: `cg-dose-${med.id}-${hora}`,
            url: `/?tab=profile&view=caregiver_dash&cgTab=history`,
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
                  await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [cgSub.id]);
                }
              }
            }
          }
        }

        if (anySent || userSubs.length === 0) {
          await client.query(
            `INSERT INTO notification_logs (id, user_id, med_id, dose_hora, data_referencia, tipo)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [crypto.randomUUID(), med.user_id, med.id, hora, todayIso, targetType]
          );
        }
      }
    }

    return { ok: true, expiredFinished, sent, failed, ignored, timestamp: now.toISOString() };
  } finally {
    client.release();
  }
}
