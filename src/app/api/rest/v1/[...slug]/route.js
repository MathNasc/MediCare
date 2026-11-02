import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { forwardToOracleBackend } from '@/lib/oracleProxy';
import {
  canAccessPatientData,
  extractAuthenticatedUser,
  verifyActiveSessionInDb,
} from '@/lib/oracleAuth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key, Prefer',
};

const ALLOWED_TABLES = new Set([
  'profiles',
  'medicamentos',
  'historico_doses',
  'caregiver_relationships',
  'caregiver_notes',
  'caregiver_audit_log',
  'cuidadores',
  'notes',
  'calendar_notes',
  'health_events',
  'dose_observations',
  'medication_catalog',
  'custom_medications',
  'stock_movements',
  'audit_logs',
  'push_subscriptions',
  'notification_logs',
  'allergies',
  'health_conditions',
  'emergency_contacts',
  'healthcare_professionals',
  'documentos',
  'notificacoes',
  'adhesion_stats',
  'dose_corrections',
  'approval_requests',
  'roles',
  'role_permissions',
]);

const PUBLIC_READ_TABLES = new Set(['medication_catalog', 'roles', 'role_permissions']);

const PATIENT_ID_OWNER_TABLES = new Set([
  'audit_logs',
  'approval_requests',
  'caregiver_notes',
  'dose_corrections',
]);

function sanitizeIdentifier(ident) {
  const clean = String(ident || '').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean)) {
    throw new Error(`Identificador SQL inválido: ${clean}`);
  }
  return clean;
}

function getOwnerColumnForTable(table) {
  if (table === 'profiles') return 'id';
  if (PATIENT_ID_OWNER_TABLES.has(table)) return 'patient_id';
  return 'user_id';
}

function extractEqParam(searchParams, colName) {
  const raw = searchParams.get(colName);
  if (!raw) return null;
  if (raw.startsWith('eq.')) return raw.slice(3).trim();
  return null;
}

async function getAuthorizedPatientMap(client, userId) {
  const map = new Map();
  if (!userId) return map;
  map.set(String(userId), 'admin');

  const relRes = await client.query(
    `SELECT patient_id, caregiver_id, permission_level, status
     FROM caregiver_relationships
     WHERE (caregiver_id::text = $1::text AND status = 'active')
        OR (patient_id::text = $1::text AND status IN ('active', 'pending'))`,
    [String(userId)]
  );

  const linkedCaregiverIds = new Set();
  for (const r of relRes.rows) {
    if (String(r.caregiver_id) === String(userId) && r.status === 'active' && r.patient_id) {
      map.set(String(r.patient_id), r.permission_level || 'caregiver');
    }
    if (String(r.patient_id) === String(userId) && r.caregiver_id) {
      linkedCaregiverIds.add(String(r.caregiver_id));
    }
  }

  return { patientPermissions: map, linkedCaregiverIds };
}

function buildWhereClause(searchParams, values, extraClauses = []) {
  const clauses = [...extraClauses];

  for (const [rawKey, rawVal] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(rawKey)) continue;

    if (rawKey === 'or') {
      const inner = rawVal.replace(/^\(|\)$/g, '');
      const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
      const orParts = [];
      for (const part of parts) {
        const m = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.(ilike|eq)\.(.+)$/);
        if (m) {
          const col = sanitizeIdentifier(m[1]);
          const op = m[2];
          const val = m[3];
          values.push(val);
          orParts.push(`${col} ${op === 'ilike' ? 'ILIKE' : '='} $${values.length}`);
        }
      }
      if (orParts.length > 0) {
        clauses.push(`(${orParts.join(' OR ')})`);
      }
      continue;
    }

    const col = sanitizeIdentifier(rawKey);
    if (rawVal.startsWith('eq.')) {
      values.push(rawVal.slice(3));
      clauses.push(`${col}::text = $${values.length}::text`);
    } else if (rawVal.startsWith('neq.')) {
      values.push(rawVal.slice(4));
      clauses.push(`${col}::text <> $${values.length}::text`);
    } else if (rawVal.startsWith('gte.')) {
      values.push(rawVal.slice(4));
      clauses.push(`${col} >= $${values.length}`);
    } else if (rawVal.startsWith('lte.')) {
      values.push(rawVal.slice(4));
      clauses.push(`${col} <= $${values.length}`);
    } else if (rawVal.startsWith('ilike.')) {
      values.push(rawVal.slice(6));
      clauses.push(`${col} ILIKE $${values.length}`);
    } else if (rawVal.startsWith('fts.')) {
      values.push(`%${rawVal.slice(4)}%`);
      clauses.push(`${col}::text ILIKE $${values.length}`);
    } else if (rawVal.startsWith('in.(') && rawVal.endsWith(')')) {
      const inner = rawVal.slice(4, -1);
      const list = inner
        .split(',')
        .map((x) => x.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
      if (list.length === 0) {
        clauses.push('1 = 0');
      } else {
        values.push(list);
        clauses.push(`${col}::text = ANY($${values.length}::text[])`);
      }
    }
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

function computeDoseTimingAndRetroactivity({ doseDate, scheduledHora, actualAdminTime, isUpdatingExisting, explicitRetroactive }) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const cleanDate = String(doseDate || todayIso).slice(0, 10);
  const cleanScheduled = String(scheduledHora || '08:00').trim().slice(0, 5);
  const cleanActual = actualAdminTime ? String(actualAdminTime).trim().slice(0, 5) : null;

  const scheduledDateObj = new Date(`${cleanDate}T${cleanScheduled}:00`);
  const actualDateObj = cleanActual
    ? new Date(`${cleanDate}T${cleanActual}:00`)
    : now;

  let delayMinutes = 0;
  if (!isNaN(scheduledDateObj.getTime()) && !isNaN(actualDateObj.getTime())) {
    delayMinutes = Math.max(0, Math.round((actualDateObj.getTime() - scheduledDateObj.getTime()) / 60000));
  }

  const isPastDate = cleanDate < todayIso;
  let minutesSinceScheduled = 0;
  if (!isNaN(scheduledDateObj.getTime())) {
    minutesSinceScheduled = Math.round((now.getTime() - scheduledDateObj.getTime()) / 60000);
  }

  // Não marca is_retroactive = true automaticamente apenas por ser cuidador:
  // Só é retroativo se for retificação de registro existente, data anterior a hoje,
  // registro efetuado mais de 60 min distante do horário previsto, ou se explicitamente indicado.
  const isRetroactive =
    typeof explicitRetroactive === 'boolean'
      ? Boolean(explicitRetroactive || isUpdatingExisting || isPastDate)
      : Boolean(isUpdatingExisting || isPastDate || Math.abs(minutesSinceScheduled) > 60);

  return {
    cleanDate,
    cleanScheduled,
    cleanActual: cleanActual || now.toTimeString().slice(0, 5),
    actualTimestampIso: !isNaN(actualDateObj.getTime()) ? actualDateObj.toISOString() : now.toISOString(),
    recordedAtIso: now.toISOString(),
    delayMinutes,
    isRetroactive,
  };
}

async function handleRpcCall(client, fnName, args, userId) {
  if (fnName === 'search_medications') {
    const q = `%${String(args.query || '').trim()}%`;
    const limit = Number(args.result_limit) || 20;
    const res = await client.query(
      `SELECT * FROM medication_catalog
       WHERE commercial_name ILIKE $1
          OR active_ingredient ILIKE $1
          OR COALESCE(manufacturer, '') ILIKE $1
       ORDER BY commercial_name ASC
       LIMIT $2`,
      [q, limit]
    );
    return { status: 200, body: res.rows };
  }

  if (!userId) {
    return { status: 401, body: { success: false, error: 'Autenticação necessária.' } };
  }

  switch (fnName) {
    case 'finish_expired_treatments': {
      const targetUser = args?.p_user_id || userId;
      const allowed = await canAccessPatientData(client, userId, targetUser, 'caregiver');
      if (!allowed) {
        return { status: 403, body: { success: false, error: 'Acesso negado a este paciente.' } };
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await client.query(
        `UPDATE medicamentos
         SET status = 'concluido', finished_at = NOW(), ativo = FALSE
         WHERE treatment_type IN ('temporary', 'temporario')
           AND status = 'ativo'
           AND end_date IS NOT NULL
           AND end_date::text <> ''
           AND end_date::text < $1
           AND user_id::text = $2::text
         RETURNING id`,
        [todayIso, String(targetUser)]
      );
      return { status: 200, body: res.rowCount || 0 };
    }

    case 'record_dose_administration':
    case 'confirm_dose_retroactive': {
      const patientId = args.p_patient_id || userId;
      const medId = args.p_med_id;
      const hora = String(args.p_hora || '').trim();
      const doseDate = String(args.p_dose_date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const requestedStatus = String(args.p_new_status || 'confirmed').toLowerCase().trim();
      const reason = args.p_reason ? String(args.p_reason).trim() : null;
      const actor = userId;
      const isSelf = String(actor) === String(patientId);

      if (!medId || !hora) {
        return { status: 400, body: { success: false, error: 'Medicamento e horário previsto são obrigatórios.' } };
      }

      // 1. Valida autorização de acesso ao paciente
      const allowed = await canAccessPatientData(client, actor, patientId, 'caregiver');
      if (!allowed) {
        return { status: 403, body: { success: false, error: 'Acesso negado: você não possui vínculo ativo de cuidador para este paciente.' } };
      }

      // 2. Valida que o medicamento pertence ao paciente informado (previne IDOR por troca de med_id)
      const medRes = await client.query(
        `SELECT id, user_id, nome, quantidade FROM medicamentos WHERE id::text = $1::text LIMIT 1`,
        [String(medId)]
      );
      if (medRes.rowCount === 0 || String(medRes.rows[0].user_id) !== String(patientId)) {
        return {
          status: 403,
          body: { success: false, error: 'Medicamento inválido ou não pertencente ao paciente selecionado.' },
        };
      }

      // 3. Se for marcação como não tomada ('missed'), exige justificativa clínica
      if (requestedStatus === 'missed' && (!reason || reason.length < 3)) {
        return {
          status: 400,
          body: { success: false, error: 'Informe uma justificativa clínica para registrar a dose como não administrada.' },
        };
      }

      const actorProfRes = await client
        .query(`SELECT nome, role FROM profiles WHERE id::text = $1::text LIMIT 1`, [String(actor)])
        .catch(() => ({ rows: [] }));
      const actorName = actorProfRes.rows[0]?.nome || (isSelf ? 'Paciente' : 'Cuidador');
      const actorRole = isSelf ? actorProfRes.rows[0]?.role || 'paciente' : 'cuidador';
      const actionOrigin = args.p_origin || (isSelf ? 'patient_app' : 'caregiver_web');

      await client.query('BEGIN');
      try {
        const existing = await client.query(
          `SELECT * FROM historico_doses
           WHERE user_id::text = $1::text
             AND med_id::text = $2::text
             AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
             AND (COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $4)
           ORDER BY created_at DESC`,
          [String(patientId), String(medId), hora, doseDate]
        );

        if (requestedStatus === 'pending' || requestedStatus === 'pendente') {
          if (existing.rowCount > 0) {
            await client.query(
              `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
               VALUES ($1, $2, $3, 'dose_reverted_to_pending', $4::jsonb, $5::jsonb, $6)`,
              [
                crypto.randomUUID(),
                patientId,
                actor,
                JSON.stringify(existing.rows[0]),
                JSON.stringify({ status: 'pending', scheduled_time: hora, scheduled_date: doseDate, actor_role: actorRole, origin: actionOrigin }),
                reason || 'Dose revertida para pendente',
              ]
            );
          }

          await client.query(
            `DELETE FROM historico_doses
             WHERE user_id::text = $1::text
               AND med_id::text = $2::text
               AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
               AND COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $4`,
            [String(patientId), String(medId), hora, doseDate]
          );

          await client
            .query(
              `UPDATE approval_requests
               SET status = 'approved', updated_at = NOW()
               WHERE patient_id::text = $1::text
                 AND med_id::text = $2::text
                 AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
                 AND dose_date = $4
                 AND status = 'pending'`,
              [String(patientId), String(medId), hora, doseDate]
            )
            .catch(() => {});

          await client.query('COMMIT');
          return { status: 200, body: { success: true, action: 'deleted' } };
        }

        const timing = computeDoseTimingAndRetroactivity({
          doseDate,
          scheduledHora: hora,
          actualAdminTime: args.p_administered_time || args.p_hora_real || null,
          isUpdatingExisting: existing.rowCount > 0,
          explicitRetroactive: args.p_is_retroactive,
        });

        const finalStatus =
          requestedStatus === 'missed'
            ? 'missed'
            : requestedStatus === 'late'
            ? 'late'
            : 'confirmed';

        const delayToStore = finalStatus === 'missed' ? 0 : timing.delayMinutes;

        // Idempotência: se já existe registro com o mesmo status e mesmo motivo, evita duplicar operação e auditoria
        if (existing.rowCount > 0) {
          const primaryRow = existing.rows[0];
          // Remove eventuais linhas duplicadas antigas do mesmo slot
          if (existing.rowCount > 1 && hora.toUpperCase() !== 'SOS') {
            const extraIds = existing.rows.slice(1).map((r) => String(r.id));
            await client.query(`DELETE FROM historico_doses WHERE id::text = ANY($1::text[])`, [extraIds]);
          }

          const existingReason = primaryRow.correction_reason || primaryRow.motivo || null;
          if (
            primaryRow.status === finalStatus &&
            (existingReason || '') === (reason || '') &&
            String(primaryRow.performed_by || '') === String(actor)
          ) {
            await client.query('COMMIT');
            return {
              status: 200,
              body: {
                success: true,
                id: primaryRow.id,
                action: 'noop',
                idempotent: true,
                is_retroactive: primaryRow.is_retroactive,
                delay_minutes: primaryRow.atraso_minutos || 0,
              },
            };
          }

          await client.query(
            `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
             VALUES ($1, $2, $3, 'dose_status_updated', $4::jsonb, $5::jsonb, $6)`,
            [
              crypto.randomUUID(),
              patientId,
              actor,
              JSON.stringify(primaryRow),
              JSON.stringify({
                status: finalStatus,
                scheduled_date: timing.cleanDate,
                scheduled_time: timing.cleanScheduled,
                actual_administration_time: timing.cleanActual,
                recorded_at: timing.recordedAtIso,
                delay_minutes: delayToStore,
                is_retroactive: true,
                actor_id: actor,
                actor_name: actorName,
                actor_role: actorRole,
                origin: actionOrigin,
              }),
              reason || (isSelf ? 'Retificação pelo próprio usuário' : 'Retificação registrada pelo cuidador'),
            ]
          );

          await client.query(
            `UPDATE historico_doses
             SET status = $1,
                 atraso_minutos = $2,
                 is_retroactive = TRUE,
                 performed_by = $3,
                 confirmed_by_name = $4,
                 confirmed_by_role = $5,
                 corrected_at = NOW(),
                 correction_reason = $6,
                 motivo = COALESCE($6, motivo)
             WHERE id = $7`,
            [finalStatus, delayToStore, actor, actorName, actorRole, reason, primaryRow.id]
          );

          await client
            .query(
              `UPDATE approval_requests
               SET status = 'approved', updated_at = NOW()
               WHERE patient_id::text = $1::text
                 AND med_id::text = $2::text
                 AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
                 AND dose_date = $4
                 AND status = 'pending'`,
              [String(patientId), String(medId), hora, doseDate]
            )
            .catch(() => {});

          await client.query('COMMIT');
          return {
            status: 200,
            body: {
              success: true,
              id: primaryRow.id,
              action: 'updated',
              is_retroactive: true,
              delay_minutes: delayToStore,
              performed_by: actor,
              confirmed_by_role: actorRole,
              origin: actionOrigin,
            },
          };
        }

        const newId = crypto.randomUUID();
        await client.query(
          `INSERT INTO historico_doses (
             id, med_id, user_id, hora, dose_date, status, atraso_minutos,
             performed_by, confirmed_by_name, confirmed_by_role,
             is_retroactive, corrected_at, created_at, correction_reason, motivo
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $13)`,
          [
            newId,
            medId,
            patientId,
            timing.cleanScheduled,
            timing.cleanDate,
            finalStatus,
            delayToStore,
            actor,
            actorName,
            actorRole,
            timing.isRetroactive,
            timing.isRetroactive ? new Date().toISOString() : null,
            reason,
          ]
        );

        const auditAction =
          finalStatus === 'missed'
            ? 'dose_marked_missed'
            : timing.isRetroactive
            ? 'dose_confirmed_retroactively'
            : isSelf
            ? 'dose_confirmed_by_patient'
            : 'dose_registered_by_caregiver';

        await client.query(
          `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
           VALUES ($1, $2, $3, $4, NULL, $5::jsonb, $6)`,
          [
            crypto.randomUUID(),
            patientId,
            actor,
            auditAction,
            JSON.stringify({
              status: finalStatus,
              scheduled_date: timing.cleanDate,
              scheduled_time: timing.cleanScheduled,
              actual_administration_time: timing.cleanActual,
              recorded_at: timing.recordedAtIso,
              delay_minutes: delayToStore,
              is_retroactive: timing.isRetroactive,
              actor_id: actor,
              actor_name: actorName,
              actor_role: actorRole,
              origin: actionOrigin,
            }),
            reason || (isSelf ? 'Confirmação de dose pelo paciente' : 'Administração registrada pelo cuidador'),
          ]
        );

        await client
          .query(
            `UPDATE approval_requests
             SET status = 'approved', updated_at = NOW()
             WHERE patient_id::text = $1::text
               AND med_id::text = $2::text
               AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
               AND dose_date = $4
               AND status = 'pending'`,
            [String(patientId), String(medId), hora, doseDate]
          )
          .catch(() => {});

        await client.query('COMMIT');
        return {
          status: 200,
          body: {
            success: true,
            id: newId,
            action: 'created',
            is_retroactive: timing.isRetroactive,
            delay_minutes: delayToStore,
            performed_by: actor,
            confirmed_by_role: actorRole,
            origin: actionOrigin,
          },
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }

    case 'resolve_dose_approval': {
      const reqId = args.p_request_id || args.id;
      const decision = String(args.p_decision || args.status || 'approved').toLowerCase();
      const actor = userId;
      const reqRes = await client.query(`SELECT * FROM approval_requests WHERE id::text = $1::text LIMIT 1`, [
        String(reqId),
      ]);
      if (reqRes.rowCount === 0) {
        return { status: 404, body: { success: false, error: 'Solicitação não encontrada.' } };
      }
      const reqRow = reqRes.rows[0];

      const allowed = await canAccessPatientData(client, actor, reqRow.patient_id, 'caregiver');
      if (!allowed) {
        return { status: 403, body: { success: false, error: 'Acesso negado para aprovar solicitações deste paciente.' } };
      }

      const finalStatus = decision === 'rejected' || decision === 'rejeitado' ? 'rejected' : 'approved';
      await client.query('BEGIN');
      try {
        await client.query(`UPDATE approval_requests SET status = $1, updated_at = NOW() WHERE id = $2`, [
          finalStatus,
          reqRow.id,
        ]);

        if (finalStatus === 'approved') {
          const isUndo = reqRow.action_type === 'undo_dose' || reqRow.requested_status === 'pending';
          if (isUndo) {
            const delRes = await client.query(
              `DELETE FROM historico_doses
               WHERE user_id::text = $1::text
                 AND med_id::text = $2::text
                 AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
                 AND COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $4
               RETURNING id`,
              [String(reqRow.patient_id), String(reqRow.med_id), String(reqRow.hora), String(reqRow.dose_date)]
            );
            if (delRes.rowCount > 0) {
              await client
                .query(`UPDATE medicamentos SET quantidade = quantidade + 1, updated_at = NOW() WHERE id::text = $1::text`, [
                  String(reqRow.med_id),
                ])
                .catch(() => {});
            }
          } else {
            const newDoseId = crypto.randomUUID();
            await client.query(
              `DELETE FROM historico_doses
               WHERE user_id::text = $1::text
                 AND med_id::text = $2::text
                 AND LEFT(COALESCE(hora, ''), 5) = LEFT($3, 5)
                 AND COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $4`,
              [String(reqRow.patient_id), String(reqRow.med_id), String(reqRow.hora), String(reqRow.dose_date)]
            );
            await client.query(
              `INSERT INTO historico_doses
                 (id, med_id, user_id, hora, dose_date, status, atraso_minutos, performed_by, confirmed_by_role, is_retroactive, corrected_at, correction_reason, motivo)
               VALUES ($1, $2, $3, $4, $5, 'confirmed', 0, $6, 'cuidador', TRUE, NOW(), $7, $7)`,
              [
                newDoseId,
                reqRow.med_id,
                reqRow.patient_id,
                reqRow.hora,
                reqRow.dose_date,
                actor,
                reqRow.reason || 'Validado pelo cuidador',
              ]
            );
            await client
              .query(
                `UPDATE medicamentos SET quantidade = GREATEST(0, quantidade - 1), updated_at = NOW() WHERE id::text = $1::text`,
                [String(reqRow.med_id)]
              )
              .catch(() => {});
          }
        }
        await client.query('COMMIT');
        return { status: 200, body: { success: true, id: reqRow.id, status: finalStatus } };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }

    case 'list_audit_logs': {
      const patientId = args.p_patient_id || userId;
      const allowed = await canAccessPatientData(client, userId, patientId, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado à trilha de auditoria deste paciente.' } };
      }
      const limit = Math.max(1, Math.min(200, Number(args.p_limit) || 50));
      const res = await client.query(
        `SELECT * FROM audit_logs
         WHERE patient_id::text = $1::text
         ORDER BY created_at DESC
         LIMIT $2`,
        [String(patientId), limit]
      );
      return { status: 200, body: res.rows };
    }

    case 'record_stock_movement': {
      const medId = args.p_medication_id;
      const movementType = args.p_movement_type || 'adjustment';
      const qtyBefore = Number(args.p_quantity_before ?? 0);
      const qtyAfter = Number(args.p_quantity_after ?? 0);
      const qtyChanged = qtyAfter - qtyBefore;

      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) {
        return { status: 404, body: { success: false, error: 'Medicamento não encontrado.' } };
      }
      const med = medRes.rows[0];

      const allowed = await canAccessPatientData(client, userId, med.user_id, 'caregiver');
      if (!allowed) {
        return { status: 403, body: { success: false, error: 'Acesso negado ao estoque deste paciente.' } };
      }

      await client.query('BEGIN');
      try {
        await client.query(`UPDATE medicamentos SET quantidade = $1, updated_at = NOW() WHERE id = $2`, [
          Math.max(0, Math.round(qtyAfter)),
          med.id,
        ]);

        const movId = crypto.randomUUID();
        await client
          .query(
            `INSERT INTO stock_movements (
               id, medication_id, user_id, med_name, movement_type,
               quantity_before, quantity_changed, quantity_delta, quantity_after,
               purchase_price, purchase_location, batch, expiration_date, notes
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              movId,
              med.id,
              med.user_id,
              med.nome,
              movementType,
              qtyBefore,
              qtyChanged,
              qtyChanged,
              qtyAfter,
              args.p_purchase_price ?? null,
              args.p_purchase_location ?? null,
              args.p_batch ?? null,
              args.p_expiration_date || null,
              args.p_notes ?? null,
            ]
          )
          .catch(async () => {
            await client.query(
              `INSERT INTO stock_movements (
                 id, medication_id, user_id, movement_type,
                 quantity_before, quantity_after, quantity_changed,
                 purchase_price, purchase_location, batch, expiration_date, notes
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                movId,
                med.id,
                med.user_id,
                movementType,
                qtyBefore,
                qtyAfter,
                qtyChanged,
                args.p_purchase_price ?? null,
                args.p_purchase_location ?? null,
                args.p_batch ?? null,
                args.p_expiration_date || null,
                args.p_notes ?? null,
              ]
            );
          });

        await client.query('COMMIT');
        return { status: 200, body: { success: true, movement_id: movId } };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }

    case 'list_stock_movements': {
      const medId = args.p_med_id || null;
      let targetPatientId = args.p_patient_id || args.p_user_id || userId;
      if (medId) {
        const mRes = await client.query(`SELECT user_id FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [
          String(medId),
        ]);
        if (mRes.rowCount > 0) targetPatientId = mRes.rows[0].user_id;
      }
      const allowed = await canAccessPatientData(client, userId, targetPatientId, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado às movimentações de estoque deste paciente.' } };
      }

      const limit = Math.max(1, Math.min(200, Number(args.p_limit) || 50));
      const params = [String(targetPatientId)];
      const where = [`user_id::text = $1`];
      if (medId) {
        params.push(String(medId));
        where.push(`medication_id::text = $${params.length}`);
      }
      params.push(limit);
      const sql = `SELECT *, COALESCE(quantity_changed, quantity_delta, quantity_after - quantity_before) AS quantity_changed
                   FROM stock_movements
                   WHERE ${where.join(' AND ')}
                   ORDER BY created_at DESC
                   LIMIT $${params.length}`;
      const res = await client.query(sql, params);
      return { status: 200, body: res.rows };
    }

    case 'get_stock_forecast': {
      const medId = args.p_med_id;
      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) return { status: 200, body: null };
      const m = medRes.rows[0];
      const allowed = await canAccessPatientData(client, userId, m.user_id, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado a este medicamento.' } };
      }

      const horarios = Array.isArray(m.horarios) ? m.horarios : ['08:00'];
      const dosesPerDay = Math.max(1, horarios.length);
      const daysRemaining = Math.floor(Number(m.quantidade || 0) / dosesPerDay);
      const depDate = new Date();
      depDate.setDate(depDate.getDate() + daysRemaining);
      const depIso = depDate.toISOString().slice(0, 10);

      const mvsRes = await client.query(
        `SELECT created_at, COALESCE(quantity_changed, quantity_delta, quantity_after - quantity_before) AS delta
         FROM stock_movements
         WHERE medication_id::text = $1::text AND movement_type = 'purchase'
         ORDER BY created_at DESC`,
        [String(medId)]
      );
      const lastPurchase = mvsRes.rows[0]?.created_at
        ? new Date(mvsRes.rows[0].created_at).toISOString().slice(0, 10)
        : null;
      const monthPrefix = new Date().toISOString().slice(0, 7);
      const monthQty = mvsRes.rows
        .filter((r) => String(r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at).startsWith(monthPrefix))
        .reduce((acc, r) => acc + Number(r.delta || 0), 0);

      return {
        status: 200,
        body: {
          med_id: m.id,
          nome: m.nome,
          dosagem: m.dosagem,
          quantidade: m.quantidade,
          doses_per_day: dosesPerDay,
          days_remaining: daysRemaining,
          depletion_date: depIso,
          forecast_depletion_date: depIso,
          last_purchase_date: lastPurchase,
          month_quantity_purchased: monthQty,
          avg_purchase_duration_days: mvsRes.rows.length
            ? Math.round(
                mvsRes.rows.reduce((acc, r) => acc + Math.max(1, Number(r.delta || 0) / dosesPerDay), 0) /
                  mvsRes.rows.length
              )
            : null,
        },
      };
    }

    case 'get_all_stock_forecasts': {
      const targetUser = args.p_patient_id || args.p_user_id || userId;
      const allowed = await canAccessPatientData(client, userId, targetUser, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado a este paciente.' } };
      }

      const medsRes = await client.query(
        `SELECT * FROM medicamentos
         WHERE user_id::text = $1::text
           AND ativo = TRUE
           AND COALESCE(treatment_type, 'continuous') <> 'sos'`,
        [String(targetUser)]
      );
      const list = medsRes.rows.map((m) => {
        const horarios = Array.isArray(m.horarios) ? m.horarios : ['08:00'];
        const dosesPerDay = Math.max(1, horarios.length);
        const daysRemaining = Math.floor(Number(m.quantidade || 0) / dosesPerDay);
        const depDate = new Date();
        depDate.setDate(depDate.getDate() + daysRemaining);
        const depIso = depDate.toISOString().slice(0, 10);
        return {
          med_id: m.id,
          nome: m.nome,
          dosagem: m.dosagem,
          quantidade: m.quantidade,
          doses_per_day: dosesPerDay,
          days_remaining: daysRemaining,
          depletion_date: depIso,
          forecast_depletion_date: depIso,
        };
      });
      return { status: 200, body: list.sort((a, b) => a.days_remaining - b.days_remaining) };
    }

    case 'accept_caregiver_invite': {
      const token = String(args.p_token || '').trim();
      if (!token) {
        return { status: 400, body: { success: false, error: 'Informe o código de convite.' } };
      }
      const relRes = await client.query(
        `SELECT * FROM caregiver_relationships
         WHERE invite_token = $1
           AND status = 'pending'
           AND (invite_expires_at IS NULL OR invite_expires_at > NOW())
         LIMIT 1`,
        [token]
      );
      if (relRes.rowCount === 0) {
        return { status: 400, body: { success: false, error: 'Convite inválido ou expirado.' } };
      }
      const rel = relRes.rows[0];
      if (String(rel.patient_id) === String(userId)) {
        return { status: 400, body: { success: false, error: 'Você não pode aceitar seu próprio convite.' } };
      }
      await client.query(
        `UPDATE caregiver_relationships
         SET caregiver_id = $1, status = 'active', accepted_at = NOW()
         WHERE id = $2`,
        [userId, rel.id]
      );
      return { status: 200, body: { success: true, relationship_id: rel.id, patient_id: rel.patient_id } };
    }

    case 'revoke_caregiver': {
      const relId = args.p_relationship_id;
      const relCheck = await client.query(
        `SELECT id, patient_id, caregiver_id FROM caregiver_relationships WHERE id::text = $1::text LIMIT 1`,
        [String(relId)]
      );
      if (relCheck.rowCount === 0) {
        return { status: 404, body: false };
      }
      const rel = relCheck.rows[0];
      if (String(rel.patient_id) !== String(userId) && String(rel.caregiver_id) !== String(userId)) {
        return { status: 403, body: { error: 'Acesso negado: você não faz parte deste vínculo.' } };
      }
      const res = await client.query(
        `UPDATE caregiver_relationships
         SET status = 'revoked', revoked_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [rel.id]
      );
      return { status: 200, body: res.rowCount > 0 };
    }

    case 'create_managed_patient': {
      const nome = (args.p_nome || '').trim();
      if (!nome) {
        return { status: 400, body: { success: false, error: 'O nome do paciente é obrigatório.' } };
      }
      const relLabel = (args.p_relationship_label || '').trim() || 'Dependente';
      const cleanBloodType = args.p_blood_type ? String(args.p_blood_type).trim() : null;
      const cleanDob = args.p_dob ? String(args.p_dob).trim() : null;
      const cleanSex = args.p_sex ? String(args.p_sex).trim() : null;
      const cleanPhone = args.p_phone ? String(args.p_phone).trim() : null;

      if (cleanDob && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
        return { status: 400, body: { success: false, error: 'Data de nascimento inválida. Use o formato AAAA-MM-DD.' } };
      }

      const patientId = crypto.randomUUID();
      const fakeEmail = `paciente-${patientId.slice(0, 8)}@medicare.local`;

      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO app_users (id, email, password_hash, raw_user_meta_data)
           VALUES ($1, $2, 'managed_account_no_password', $3::jsonb)`,
          [patientId, fakeEmail, JSON.stringify({ nome, role: 'paciente', is_managed: true, managed_by: userId })]
        );

        await client.query(
          `INSERT INTO profiles (id, nome, email, role, blood_type, dob, sex, phone)
           VALUES ($1, $2, $3, 'paciente', $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             nome = EXCLUDED.nome,
             role = 'paciente',
             blood_type = EXCLUDED.blood_type,
             dob = EXCLUDED.dob,
             sex = EXCLUDED.sex,
             phone = EXCLUDED.phone`,
          [patientId, nome, fakeEmail, cleanBloodType, cleanDob, cleanSex, cleanPhone]
        );

        const relId = crypto.randomUUID();
        await client.query(
          `INSERT INTO caregiver_relationships (id, patient_id, caregiver_id, permission_level, status, relationship_label, accepted_at)
           VALUES ($1, $2, $3, 'admin', 'active', $4, NOW())`,
          [relId, patientId, userId, relLabel]
        );

        await client.query(
          `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
           VALUES ($1, $2, $3, 'managed_patient_created', NULL, $4::jsonb, $5)`,
          [
            crypto.randomUUID(),
            patientId,
            userId,
            JSON.stringify({ nome, relationship_label: relLabel, blood_type: cleanBloodType, dob: cleanDob }),
            'Cadastro de paciente dependente realizado pelo cuidador',
          ]
        );
        await client.query('COMMIT');

        return { status: 200, body: { success: true, patient_id: patientId, relationship_id: relId } };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }

    case 'get_patient_summary': {
      const patientId = args.p_patient_id || userId;
      const allowed = await canAccessPatientData(client, userId, patientId, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado ao resumo deste paciente.' } };
      }
      const [profRes, medsRes, lastDoseRes] = await Promise.all([
        client.query(`SELECT id, nome, email, role, foto_url, blood_type, dob FROM profiles WHERE id::text = $1::text LIMIT 1`, [
          String(patientId),
        ]),
        client.query(`SELECT COUNT(*)::int AS cnt FROM medicamentos WHERE user_id::text = $1::text AND ativo = TRUE`, [
          String(patientId),
        ]),
        client.query(
          `SELECT hora, created_at AS at, status FROM historico_doses
           WHERE user_id::text = $1::text AND status IN ('confirmed', 'late')
           ORDER BY created_at DESC LIMIT 1`,
          [String(patientId)]
        ),
      ]);
      return {
        status: 200,
        body: {
          profile: profRes.rows[0] || null,
          meds_count: medsRes.rows[0]?.cnt || 0,
          last_dose: lastDoseRes.rows[0] || null,
        },
      };
    }

    case 'repeat_treatment': {
      const medId = args.p_med_id;
      const newStartDate = args.p_new_start_date;
      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) {
        return { status: 404, body: { error: 'Medicamento original não encontrado.' } };
      }
      const m = medRes.rows[0];
      const allowed = await canAccessPatientData(client, userId, m.user_id, 'caregiver');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado para repetir tratamento deste paciente.' } };
      }
      const days = Number(m.treatment_days) || 7;
      const start = new Date(`${newStartDate}T00:00:00`);
      const end = new Date(start.getTime() + Math.max(0, days - 1) * 86400000).toISOString().slice(0, 10);
      const newId = crypto.randomUUID();

      await client.query(
        `INSERT INTO medicamentos (
           id, user_id, nome, principio_ativo, fabricante, dosagem, quantidade,
           unidade, cor, observacoes, horarios, dias_semana, ativo,
           treatment_type, start_date, end_date, treatment_days, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,'temporary',$13,$14,$15,'ativo')`,
        [
          newId,
          m.user_id,
          m.nome,
          m.principio_ativo || null,
          m.fabricante || null,
          m.dosagem,
          m.quantidade,
          m.unidade,
          m.cor,
          m.observacoes,
          m.horarios,
          m.dias_semana,
          newStartDate,
          end,
          days,
        ]
      );
      return { status: 200, body: newId };
    }

    case 'get_treatment_dashboard': {
      const targetUser = args?.p_patient_id || args?.p_user_id || userId;
      const allowed = await canAccessPatientData(client, userId, targetUser, 'viewer');
      if (!allowed) {
        return { status: 403, body: { error: 'Acesso negado aos indicadores deste paciente.' } };
      }

      const medsRes = await client.query(
        `SELECT id, treatment_type, status, ativo FROM medicamentos WHERE user_id::text = $1::text`,
        [String(targetUser)]
      );
      const monthPrefix = new Date().toISOString().slice(0, 7);
      const histRes = await client.query(
        `SELECT med_id, created_at FROM historico_doses WHERE user_id::text = $1::text`,
        [String(targetUser)]
      );
      const sosIds = new Set(medsRes.rows.filter((m) => m.treatment_type === 'sos').map((m) => String(m.id)));
      const sosCount = histRes.rows.filter(
        (h) =>
          sosIds.has(String(h.med_id)) &&
          String(h.created_at instanceof Date ? h.created_at.toISOString() : h.created_at).startsWith(monthPrefix)
      ).length;

      return {
        status: 200,
        body: {
          continuous_count: medsRes.rows.filter((m) => (m.treatment_type || 'continuous') === 'continuous' && m.ativo)
            .length,
          active_treatments: medsRes.rows.filter((m) => m.treatment_type === 'temporary' && m.status === 'ativo').length,
          finished_treatments: medsRes.rows.filter((m) => m.treatment_type === 'temporary' && m.status === 'concluido')
            .length,
          sos_uses_this_month: sosCount,
        },
      };
    }

    case 'change_role_with_pin': {
      const cleanFn = sanitizeIdentifier(fnName);
      const res = await client.query(`SELECT public.${cleanFn}($1, $2) AS result`, [args.p_pin, args.p_new_role]);
      return { status: 200, body: res.rows[0]?.result ?? false };
    }

    default: {
      const cleanFn = sanitizeIdentifier(fnName);
      const keys = Object.keys(args || {});
      const placeholders = keys.map((k, idx) => `${sanitizeIdentifier(k)} := $${idx + 1}`);
      const vals = keys.map((k) => args[k]);
      const res = await client.query(`SELECT * FROM public.${cleanFn}(${placeholders.join(', ')})`, vals);
      const body =
        res.rows.length === 1 && Object.keys(res.rows[0]).length === 1
          ? Object.values(res.rows[0])[0]
          : res.rows;
      return { status: 200, body };
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function handleRestRequest(req, { params }) {
  const slug = (await params).slug || [];
  if (slug.length === 0) {
    return NextResponse.json({ error: 'Recurso não especificado' }, { status: 400, headers: corsHeaders });
  }

  const pool = getPgPool();
  if (!pool) {
    const slugStr = slug.join('/');
    return forwardToOracleBackend(req, `/api/rest/v1/${slugStr}`);
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }

  const userId = claims?.sub || null;

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    if (claims) {
      const sessionActive = await verifyActiveSessionInDb(client, claims);
      if (!sessionActive) {
        return NextResponse.json({ error: 'Sessão expirada ou revogada.' }, { status: 401, headers: corsHeaders });
      }
    }

    if (userId) {
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(userId)]).catch(() => {});
    }

    // 1. Chamada RPC: POST /api/rest/v1/rpc/<fnName>
    if (slug[0] === 'rpc' && slug[1]) {
      const fnName = slug[1];
      const args = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const rpcResult = await handleRpcCall(client, fnName, args, userId);
      return NextResponse.json(rpcResult.body, { status: rpcResult.status, headers: corsHeaders });
    }

    // 2. Operação CRUD em tabela: /api/rest/v1/<table>
    const table = sanitizeIdentifier(slug[0]);
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Tabela não autorizada: ${table}` }, { status: 403, headers: corsHeaders });
    }

    const isPublicRead = req.method === 'GET' && PUBLIC_READ_TABLES.has(table);
    if (!isPublicRead && !userId) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para acessar ou modificar dados clínicos.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const preferHeader = req.headers.get('prefer') || '';
    const ownerCol = getOwnerColumnForTable(table);

    // Contexto de autorização do usuário autenticado
    const authCtx = userId
      ? await getAuthorizedPatientMap(client, userId)
      : { patientPermissions: new Map(), linkedCaregiverIds: new Set() };
    const authorizedPatientIds = Array.from(authCtx.patientPermissions.keys());

    // GET
    if (req.method === 'GET') {
      const values = [];
      const extraClauses = [];

      if (!isPublicRead) {
        if (table === 'caregiver_relationships') {
          const reqPatientId = extractEqParam(searchParams, 'patient_id');
          const reqCaregiverId = extractEqParam(searchParams, 'caregiver_id');
          if (reqPatientId && String(reqPatientId) !== String(userId) && !authCtx.patientPermissions.has(String(reqPatientId))) {
            return NextResponse.json(
              { error: 'Acesso negado aos vínculos deste paciente.' },
              { status: 403, headers: corsHeaders }
            );
          }
          if (reqCaregiverId && String(reqCaregiverId) !== String(userId)) {
            return NextResponse.json(
              { error: 'Acesso negado aos vínculos de outro cuidador.' },
              { status: 403, headers: corsHeaders }
            );
          }
          values.push(String(userId));
          extraClauses.push(`(patient_id::text = $${values.length}::text OR caregiver_id::text = $${values.length}::text)`);
        } else if (table === 'cuidadores') {
          values.push(String(userId));
          extraClauses.push(`(paciente_id::text = $${values.length}::text OR cuidador_id::text = $${values.length}::text)`);
        } else if (table === 'profiles') {
          const allowedProfileIds = Array.from(
            new Set([...authorizedPatientIds, ...Array.from(authCtx.linkedCaregiverIds)])
          );
          const reqId = extractEqParam(searchParams, 'id');
          if (reqId && !allowedProfileIds.includes(String(reqId))) {
            return NextResponse.json(
              { error: 'Acesso negado ao perfil solicitado (vínculo ativo inexistente).' },
              { status: 403, headers: corsHeaders }
            );
          }
          values.push(allowedProfileIds);
          extraClauses.push(`id::text = ANY($${values.length}::text[])`);
        } else if (table === 'caregiver_audit_log') {
          values.push(String(userId));
          extraClauses.push(`actor_id::text = $${values.length}::text`);
        } else {
          const requestedOwner = extractEqParam(searchParams, ownerCol);
          if (requestedOwner && !authCtx.patientPermissions.has(String(requestedOwner))) {
            return NextResponse.json(
              { error: 'Acesso negado: você não possui vínculo ativo com este paciente.' },
              { status: 403, headers: corsHeaders }
            );
          }

          // Se buscou um ID específico de registro (ex: id=eq.<med_id>), verifica se não pertence a outro paciente
          const requestedRecordId = extractEqParam(searchParams, 'id');
          if (requestedRecordId) {
            const ownerCheck = await client.query(
              `SELECT ${ownerCol} FROM ${table} WHERE id::text = $1::text LIMIT 1`,
              [String(requestedRecordId)]
            );
            if (
              ownerCheck.rowCount > 0 &&
              !authCtx.patientPermissions.has(String(ownerCheck.rows[0][ownerCol]))
            ) {
              return NextResponse.json(
                { error: 'Acesso negado ao registro solicitado.' },
                { status: 403, headers: corsHeaders }
              );
            }
          }

          values.push(authorizedPatientIds);
          extraClauses.push(`${ownerCol}::text = ANY($${values.length}::text[])`);
        }
      }

      const whereSql = buildWhereClause(searchParams, values, extraClauses);

      let orderSql = '';
      const rawOrder = searchParams.get('order');
      if (rawOrder) {
        const [orderCol, orderDir] = rawOrder.split('.');
        orderSql = `ORDER BY ${sanitizeIdentifier(orderCol)} ${orderDir === 'desc' ? 'DESC' : 'ASC'}`;
      }

      let limitSql = '';
      const rawLimit = searchParams.get('limit');
      if (rawLimit && !isNaN(Number(rawLimit))) {
        limitSql = `LIMIT ${Math.max(1, Math.min(1000, Number(rawLimit)))}`;
      }

      const sql = `SELECT * FROM ${table} ${whereSql} ${orderSql} ${limitSql}`;
      const res = await client.query(sql, values);
      return NextResponse.json(res.rows, { status: 200, headers: corsHeaders });
    }

    // POST (Insert ou Upsert)
    if (req.method === 'POST') {
      if (PUBLIC_READ_TABLES.has(table)) {
        return NextResponse.json({ error: 'Tabela somente leitura.' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const rows = Array.isArray(body) ? body : [body];
      const inserted = [];
      const isUpsert = preferHeader.includes('resolution=merge-duplicates');

      for (const item of rows) {
        const record = { ...item };
        if (!record.id && table !== 'role_permissions') {
          record.id = crypto.randomUUID();
        }

        // Validação de autorização no POST
        if (table === 'caregiver_relationships') {
          const targetPat = record.patient_id || userId;
          if (String(targetPat) !== String(userId)) {
            return NextResponse.json(
              { error: 'Apenas o próprio paciente pode gerar convites de vínculo.' },
              { status: 403, headers: corsHeaders }
            );
          }
          record.patient_id = userId;
          if (!record.invite_token) {
            record.invite_token = crypto.randomBytes(24).toString('hex');
          }
          if (!record.invite_expires_at) {
            record.invite_expires_at = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
          }
        } else if (table === 'profiles') {
          const targetProfId = record.id || userId;
          const canEditProf = await canAccessPatientData(client, userId, targetProfId, 'admin');
          if (!canEditProf) {
            return NextResponse.json(
              { error: 'Acesso negado para criar ou alterar este perfil.' },
              { status: 403, headers: corsHeaders }
            );
          }
          record.id = targetProfId;
        } else {
          const targetOwnerId = record[ownerCol] || userId;
          const canWrite = await canAccessPatientData(client, userId, targetOwnerId, 'caregiver');
          if (!canWrite) {
            return NextResponse.json(
              { error: 'Acesso negado: permissão insuficiente ou vínculo inexistente com este paciente.' },
              { status: 403, headers: corsHeaders }
            );
          }
          record[ownerCol] = targetOwnerId;

          // Se referenciar um medicamento (med_id / medication_id), garante que pertence ao mesmo paciente
          const refMedId = record.med_id || record.medication_id;
          if (refMedId) {
            const medOwnerRes = await client.query(
              `SELECT user_id FROM medicamentos WHERE id::text = $1::text LIMIT 1`,
              [String(refMedId)]
            );
            if (medOwnerRes.rowCount === 0 || String(medOwnerRes.rows[0].user_id) !== String(targetOwnerId)) {
              return NextResponse.json(
                { error: 'Acesso negado: medicamento informado não pertence ao paciente alvo.' },
                { status: 403, headers: corsHeaders }
              );
            }
          }
        }

        if (table === 'historico_doses' && !record.dose_date) {
          record.dose_date = record.created_at
            ? String(record.created_at).slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        }

        const cols = Object.keys(record)
          .filter((k) => record[k] !== undefined)
          .map(sanitizeIdentifier);
        const vals = cols.map((c) => {
          const v = record[c];
          if (v !== null && typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
          return v;
        });
        const placeholders = cols.map((_, i) => `$${i + 1}`);

        let conflictClause = '';
        if (isUpsert) {
          const conflictTarget =
            table === 'push_subscriptions'
              ? 'endpoint'
              : table === 'cuidadores'
              ? 'paciente_id, cuidador_id'
              : 'id';
          const updatePairs = cols
            .filter((c) => c !== 'id' && c !== ownerCol)
            .map((c) => `${c} = EXCLUDED.${c}`);
          conflictClause = updatePairs.length
            ? `ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updatePairs.join(', ')}`
            : `ON CONFLICT DO NOTHING`;
        }

        const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ${conflictClause} RETURNING *`;
        const res = await client.query(sql, vals);
        if (res.rows[0]) inserted.push(res.rows[0]);
      }

      return NextResponse.json(inserted, { status: 201, headers: corsHeaders });
    }

    // PATCH (Update)
    if (req.method === 'PATCH') {
      if (PUBLIC_READ_TABLES.has(table)) {
        return NextResponse.json({ error: 'Tabela somente leitura.' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      // Impede troca maliciosa de titularidade (user_id / patient_id) via PATCH
      if (body[ownerCol] && !authCtx.patientPermissions.has(String(body[ownerCol]))) {
        return NextResponse.json(
          { error: 'Acesso negado: tentativa de transferir registro para paciente não autorizado.' },
          { status: 403, headers: corsHeaders }
        );
      }

      const checkValues = [];
      const checkWhereSql = buildWhereClause(searchParams, checkValues);
      if (!checkWhereSql) {
        return NextResponse.json({ error: 'Filtro obrigatório para atualização (PATCH).' }, { status: 400, headers: corsHeaders });
      }

      const targetRowsRes = await client.query(`SELECT * FROM ${table} ${checkWhereSql}`, checkValues);
      if (targetRowsRes.rowCount === 0) {
        const reqOwner = extractEqParam(searchParams, ownerCol);
        if (reqOwner && !authCtx.patientPermissions.has(String(reqOwner))) {
          return NextResponse.json({ error: 'Acesso negado a este paciente.' }, { status: 403, headers: corsHeaders });
        }
        return NextResponse.json([], { status: 200, headers: corsHeaders });
      }

      for (const row of targetRowsRes.rows) {
        if (table === 'caregiver_relationships') {
          if (String(row.patient_id) !== String(userId) && String(row.caregiver_id) !== String(userId)) {
            return NextResponse.json({ error: 'Acesso negado a este vínculo.' }, { status: 403, headers: corsHeaders });
          }
        } else {
          const rowOwner = row[ownerCol];
          const canUpdate = await canAccessPatientData(client, userId, rowOwner, 'caregiver');
          if (!canUpdate) {
            return NextResponse.json(
              { error: 'Acesso negado: você não possui permissão para alterar registros deste paciente.' },
              { status: 403, headers: corsHeaders }
            );
          }
        }
      }

      const cols = Object.keys(body)
        .filter((k) => body[k] !== undefined && k !== 'id')
        .map(sanitizeIdentifier);

      if (cols.length === 0) {
        return NextResponse.json([], { status: 200, headers: corsHeaders });
      }

      const values = cols.map((c) => {
        const v = body[c];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
        return v;
      });
      const setSql = cols.map((c, idx) => `${c} = $${idx + 1}`).join(', ');
      const whereSql = buildWhereClause(searchParams, values);

      const sql = `UPDATE ${table} SET ${setSql} ${whereSql} RETURNING *`;
      const res = await client.query(sql, values);
      return NextResponse.json(res.rows, { status: 200, headers: corsHeaders });
    }

    // DELETE
    if (req.method === 'DELETE') {
      if (PUBLIC_READ_TABLES.has(table) || table === 'audit_logs') {
        return NextResponse.json({ error: 'Deleção não permitida nesta tabela.' }, { status: 403, headers: corsHeaders });
      }

      const checkValues = [];
      const whereSql = buildWhereClause(searchParams, checkValues);
      if (!whereSql) {
        return NextResponse.json({ error: 'Filtro obrigatório para DELETE' }, { status: 400, headers: corsHeaders });
      }

      const targetRowsRes = await client.query(`SELECT * FROM ${table} ${whereSql}`, checkValues);
      if (targetRowsRes.rowCount === 0) {
        const reqOwner = extractEqParam(searchParams, ownerCol);
        if (reqOwner && !authCtx.patientPermissions.has(String(reqOwner))) {
          return NextResponse.json({ error: 'Acesso negado a este paciente.' }, { status: 403, headers: corsHeaders });
        }
        return NextResponse.json([], { status: 200, headers: corsHeaders });
      }

      for (const row of targetRowsRes.rows) {
        if (table === 'caregiver_relationships') {
          if (String(row.patient_id) !== String(userId) && String(row.caregiver_id) !== String(userId)) {
            return NextResponse.json({ error: 'Acesso negado a este vínculo.' }, { status: 403, headers: corsHeaders });
          }
        } else {
          const rowOwner = row[ownerCol];
          const canDelete = await canAccessPatientData(client, userId, rowOwner, 'caregiver');
          if (!canDelete) {
            return NextResponse.json(
              { error: 'Acesso negado: você não possui permissão para remover registros deste paciente.' },
              { status: 403, headers: corsHeaders }
            );
          }
        }
      }

      const values = [];
      const finalWhereSql = buildWhereClause(searchParams, values);
      const sql = `DELETE FROM ${table} ${finalWhereSql} RETURNING *`;
      const res = await client.query(sql, values);
      return NextResponse.json(res.rows, { status: 200, headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Método não suportado' }, { status: 405, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Erro ao executar operação REST/RPC no PostgreSQL Oracle' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function GET(req, ctx) {
  return handleRestRequest(req, ctx);
}

export async function POST(req, ctx) {
  return handleRestRequest(req, ctx);
}

export async function PATCH(req, ctx) {
  return handleRestRequest(req, ctx);
}

export async function DELETE(req, ctx) {
  return handleRestRequest(req, ctx);
}
