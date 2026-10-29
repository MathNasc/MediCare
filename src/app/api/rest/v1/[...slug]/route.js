import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { extractAuthenticatedUser } from '@/lib/oracleAuth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key, Prefer',
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
  'roles',
  'role_permissions',
]);

function sanitizeIdentifier(ident) {
  const clean = String(ident || '').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean)) {
    throw new Error(`Identificador SQL inválido: ${clean}`);
  }
  return clean;
}

function buildWhereClause(searchParams, values) {
  const clauses = [];

  for (const [rawKey, rawVal] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(rawKey)) continue;

    if (rawKey === 'or') {
      // Ex: (commercial_name.ilike.%dipirona%,active_ingredient.ilike.%dipirona%)
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
      clauses.push(`${col} = $${values.length}`);
    } else if (rawVal.startsWith('neq.')) {
      values.push(rawVal.slice(4));
      clauses.push(`${col} <> $${values.length}`);
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

async function handleRpcCall(client, fnName, args, userId) {
  switch (fnName) {
    case 'finish_expired_treatments': {
      const targetUser = args?.p_user_id || userId || null;
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await client.query(
        `UPDATE medicamentos
         SET status = 'concluido', finished_at = NOW(), ativo = FALSE
         WHERE treatment_type IN ('temporary', 'temporario')
           AND status = 'ativo'
           AND end_date IS NOT NULL
           AND end_date::text <> ''
           AND end_date::text < $1
           AND ($2::text IS NULL OR user_id::text = $2::text)
         RETURNING id`,
        [todayIso, targetUser]
      );
      return res.rowCount || 0;
    }

    case 'confirm_dose_retroactive': {
      const patientId = args.p_patient_id || userId;
      const medId = args.p_med_id;
      const hora = args.p_hora;
      const doseDate = args.p_dose_date;
      const newStatus = args.p_new_status || 'confirmed';
      const reason = args.p_reason || null;
      const actor = userId || patientId;

      const existing = await client.query(
        `SELECT * FROM historico_doses
         WHERE user_id::text = $1::text
           AND med_id::text = $2::text
           AND hora = $3
           AND (COALESCE(dose_date::text, LEFT(created_at::text, 10)) = $4)
         LIMIT 1`,
        [String(patientId), String(medId), String(hora), String(doseDate)]
      );

      if (existing.rowCount > 0) {
        const row = existing.rows[0];
        await client.query(
          `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
           VALUES ($1, $2, $3, 'dose_status_updated', $4::jsonb, $5::jsonb, $6)`,
          [
            crypto.randomUUID(),
            patientId,
            actor,
            JSON.stringify(row),
            JSON.stringify({ status: newStatus, hora, date: doseDate }),
            reason || 'Ajuste do próprio usuário',
          ]
        );
        await client.query(
          `UPDATE historico_doses
           SET status = $1, is_retroactive = TRUE, performed_by = $2, corrected_at = NOW(), correction_reason = $3
           WHERE id = $4`,
          [newStatus, actor, reason, row.id]
        );
        return { success: true, id: row.id, action: 'updated' };
      }

      const newId = crypto.randomUUID();
      const createdAtIso = `${doseDate}T${hora.length === 5 ? `${hora}:00` : hora}.000Z`;
      await client.query(
        `INSERT INTO historico_doses
           (id, med_id, user_id, hora, dose_date, status, atraso_minutos, performed_by, is_retroactive, corrected_at, created_at, correction_reason)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, TRUE, NOW(), $8, $9)`,
        [newId, medId, patientId, hora, doseDate, newStatus, actor, createdAtIso, reason]
      );
      await client.query(
        `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
         VALUES ($1, $2, $3, 'dose_confirmed_retroactively', NULL, $4::jsonb, $5)`,
        [
          crypto.randomUUID(),
          patientId,
          actor,
          JSON.stringify({ status: newStatus, hora, date: doseDate }),
          reason || 'Ajuste do próprio usuário',
        ]
      );
      return { success: true, id: newId, action: 'created' };
    }

    case 'list_audit_logs': {
      const patientId = args.p_patient_id || userId;
      const limit = Number(args.p_limit) || 50;
      const res = await client.query(
        `SELECT * FROM audit_logs
         WHERE patient_id::text = $1::text
         ORDER BY created_at DESC
         LIMIT $2`,
        [String(patientId), limit]
      );
      return res.rows;
    }

    case 'record_stock_movement': {
      const medId = args.p_medication_id;
      const movementType = args.p_movement_type || 'adjustment';
      const qtyBefore = Number(args.p_quantity_before ?? 0);
      const qtyAfter = Number(args.p_quantity_after ?? 0);
      const qtyChanged = qtyAfter - qtyBefore;

      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) {
        return { success: false, error: 'Medicamento não encontrado.' };
      }
      const med = medRes.rows[0];
      await client.query(`UPDATE medicamentos SET quantidade = $1, updated_at = NOW() WHERE id = $2`, [
        Math.round(qtyAfter),
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
               quantity_before, quantity_after, quantity_delta,
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

      return { success: true, movement_id: movId };
    }

    case 'list_stock_movements': {
      const medId = args.p_med_id || null;
      const limit = Number(args.p_limit) || 50;
      const params = [];
      const where = [];
      if (userId) {
        params.push(String(userId));
        where.push(`user_id::text = $${params.length}`);
      }
      if (medId) {
        params.push(String(medId));
        where.push(`medication_id::text = $${params.length}`);
      }
      params.push(limit);
      const sql = `SELECT *, COALESCE(quantity_changed, quantity_delta, quantity_after - quantity_before) AS quantity_changed
                   FROM stock_movements
                   ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY created_at DESC
                   LIMIT $${params.length}`;
      const res = await client.query(sql, params);
      return res.rows;
    }

    case 'get_stock_forecast': {
      const medId = args.p_med_id;
      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) return null;
      const m = medRes.rows[0];
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
      };
    }

    case 'get_all_stock_forecasts': {
      const medsRes = await client.query(
        `SELECT * FROM medicamentos
         WHERE ($1::text IS NULL OR user_id::text = $1::text)
           AND ativo = TRUE
           AND COALESCE(treatment_type, 'continuous') <> 'sos'`,
        [userId ? String(userId) : null]
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
      return list.sort((a, b) => a.days_remaining - b.days_remaining);
    }

    case 'accept_caregiver_invite': {
      const token = args.p_token;
      if (!userId) return { success: false, error: 'Autenticação necessária.' };
      const relRes = await client.query(
        `SELECT * FROM caregiver_relationships WHERE invite_token = $1 AND status = 'pending' LIMIT 1`,
        [String(token)]
      );
      if (relRes.rowCount === 0) return { success: false, error: 'Convite inválido ou expirado.' };
      const rel = relRes.rows[0];
      if (String(rel.patient_id) === String(userId)) {
        return { success: false, error: 'Você não pode aceitar seu próprio convite.' };
      }
      await client.query(
        `UPDATE caregiver_relationships
         SET caregiver_id = $1, status = 'active', accepted_at = NOW()
         WHERE id = $2`,
        [userId, rel.id]
      );
      return { success: true, relationship_id: rel.id, patient_id: rel.patient_id };
    }

    case 'revoke_caregiver': {
      const relId = args.p_relationship_id;
      const res = await client.query(
        `UPDATE caregiver_relationships
         SET status = 'revoked', revoked_at = NOW()
         WHERE id::text = $1::text
         RETURNING id`,
        [String(relId)]
      );
      return res.rowCount > 0;
    }

    case 'get_patient_summary': {
      const patientId = args.p_patient_id;
      const [profRes, medsRes, lastDoseRes] = await Promise.all([
        client.query(`SELECT id, nome, email, role, foto_url FROM profiles WHERE id::text = $1::text LIMIT 1`, [
          String(patientId),
        ]),
        client.query(`SELECT COUNT(*)::int AS cnt FROM medicamentos WHERE user_id::text = $1::text AND ativo = TRUE`, [
          String(patientId),
        ]),
        client.query(
          `SELECT hora, created_at AS at, status FROM historico_doses
           WHERE user_id::text = $1::text AND status = 'confirmed'
           ORDER BY created_at DESC LIMIT 1`,
          [String(patientId)]
        ),
      ]);
      return {
        profile: profRes.rows[0] || null,
        meds_count: medsRes.rows[0]?.cnt || 0,
        last_dose: lastDoseRes.rows[0] || null,
      };
    }

    case 'repeat_treatment': {
      const medId = args.p_med_id;
      const newStartDate = args.p_new_start_date;
      const medRes = await client.query(`SELECT * FROM medicamentos WHERE id::text = $1::text LIMIT 1`, [String(medId)]);
      if (medRes.rowCount === 0) throw new Error('Medicamento original não encontrado.');
      const m = medRes.rows[0];
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
      return newId;
    }

    case 'get_treatment_dashboard': {
      const uid = userId ? String(userId) : null;
      const medsRes = await client.query(
        `SELECT id, treatment_type, status, ativo FROM medicamentos WHERE ($1::text IS NULL OR user_id::text = $1::text)`,
        [uid]
      );
      const monthPrefix = new Date().toISOString().slice(0, 7);
      const histRes = await client.query(
        `SELECT med_id, created_at FROM historico_doses WHERE ($1::text IS NULL OR user_id::text = $1::text)`,
        [uid]
      );
      const sosIds = new Set(medsRes.rows.filter((m) => m.treatment_type === 'sos').map((m) => String(m.id)));
      const sosCount = histRes.rows.filter(
        (h) =>
          sosIds.has(String(h.med_id)) &&
          String(h.created_at instanceof Date ? h.created_at.toISOString() : h.created_at).startsWith(monthPrefix)
      ).length;

      return {
        continuous_count: medsRes.rows.filter((m) => (m.treatment_type || 'continuous') === 'continuous' && m.ativo)
          .length,
        active_treatments: medsRes.rows.filter((m) => m.treatment_type === 'temporary' && m.status === 'ativo').length,
        finished_treatments: medsRes.rows.filter((m) => m.treatment_type === 'temporary' && m.status === 'concluido')
          .length,
        sos_uses_this_month: sosCount,
      };
    }

    case 'search_medications': {
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
      return res.rows;
    }

    case 'change_role_with_pin': {
      const cleanFn = sanitizeIdentifier(fnName);
      const res = await client.query(`SELECT public.${cleanFn}($1, $2) AS result`, [args.p_pin, args.p_new_role]);
      return res.rows[0]?.result ?? false;
    }

    default: {
      const cleanFn = sanitizeIdentifier(fnName);
      const keys = Object.keys(args || {});
      const placeholders = keys.map((k, idx) => `${sanitizeIdentifier(k)} := $${idx + 1}`);
      const vals = keys.map((k) => args[k]);
      const res = await client.query(`SELECT * FROM public.${cleanFn}(${placeholders.join(', ')})`, vals);
      return res.rows.length === 1 && Object.keys(res.rows[0]).length === 1
        ? Object.values(res.rows[0])[0]
        : res.rows;
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function handleRestRequest(req, { params }) {
  const slug = (await params).slug || [];
  if (slug.length === 0) {
    return NextResponse.json({ error: ' Recurso não especificado' }, { status: 400, headers: corsHeaders });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json(
      { error: 'PostgreSQL Oracle ainda não configurado no servidor.' },
      { status: 503, headers: corsHeaders }
    );
  }

  const claims = extractAuthenticatedUser(req);
  const userId = claims?.sub || null;

  const client = await pool.connect();
  try {
    await ensureOraclePostgresSchema(client);
    if (userId) {
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(userId)]).catch(() => {});
    }

    // 1. Chamada RPC: POST /api/rest/v1/rpc/<fnName>
    if (slug[0] === 'rpc' && slug[1]) {
      const fnName = slug[1];
      const args = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const result = await handleRpcCall(client, fnName, args, userId);
      return NextResponse.json(result, { status: 200, headers: corsHeaders });
    }

    // 2. Operação CRUD em tabela: /api/rest/v1/<table>
    let table = sanitizeIdentifier(slug[0]);
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Tabela não autorizada: ${table}` }, { status: 403, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    const preferHeader = req.headers.get('prefer') || '';

    // GET
    if (req.method === 'GET') {
      const values = [];
      const whereSql = buildWhereClause(searchParams, values);

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
      const body = await req.json();
      const rows = Array.isArray(body) ? body : [body];
      const inserted = [];
      const isUpsert = preferHeader.includes('resolution=merge-duplicates');

      for (const item of rows) {
        const record = { ...item };
        if (!record.id && table !== 'role_permissions') {
          record.id = crypto.randomUUID();
        }
        if (table === 'caregiver_relationships' && !record.invite_token) {
          record.invite_token = crypto.randomBytes(24).toString('hex');
        }
        if (table === 'caregiver_relationships' && !record.invite_expires_at) {
          record.invite_expires_at = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
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
            .filter((c) => c !== 'id')
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
      const body = await req.json();
      const cols = Object.keys(body)
        .filter((k) => body[k] !== undefined)
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
      const values = [];
      const whereSql = buildWhereClause(searchParams, values);
      if (!whereSql) {
        return NextResponse.json({ error: 'Filtro obrigatório para DELETE' }, { status: 400, headers: corsHeaders });
      }
      const sql = `DELETE FROM ${table} ${whereSql} RETURNING *`;
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
