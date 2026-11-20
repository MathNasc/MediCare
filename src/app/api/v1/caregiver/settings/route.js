import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { connectPgOrFallback } from '@/lib/oracleProxy';
import { extractAuthenticatedUser, verifyActiveSessionInDb } from '@/lib/oracleAuth';
import {
  DEFAULT_CARE_SETTINGS,
  fetchCaregiverManagementOverview,
  fetchPatientCareRuleMeta,
  normalizeCareSettings,
  normalizeConfigMode,
} from '@/lib/careSettings';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function getCaregiverName(client, caregiverId, fallbackEmail = '') {
  const res = await client
    .query('SELECT nome FROM profiles WHERE id::text = $1::text LIMIT 1', [String(caregiverId)])
    .catch(() => ({ rows: [] }));
  return res.rows?.[0]?.nome || fallbackEmail || 'Cuidador';
}

async function upsertPatientCareRow(client, { patientId, caregiverId, mode, groupId, ruleValues }) {
  const vals = normalizeCareSettings(ruleValues);
  return client.query(
    `INSERT INTO public.patient_care_settings (
       patient_id, overdue_notify_minutes, require_caregiver_confirm,
       require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
       allow_patient_med_edit, notify_low_stock, low_stock_threshold,
       notify_sos_usage, config_mode, group_id, caregiver_id, updated_by, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, NOW(), NOW())
     ON CONFLICT (patient_id) DO UPDATE SET
       overdue_notify_minutes = EXCLUDED.overdue_notify_minutes,
       require_caregiver_confirm = EXCLUDED.require_caregiver_confirm,
       require_confirm_after_missed = EXCLUDED.require_confirm_after_missed,
       require_confirm_undo = EXCLUDED.require_confirm_undo,
       missed_dose_minutes = EXCLUDED.missed_dose_minutes,
       allow_patient_med_edit = EXCLUDED.allow_patient_med_edit,
       notify_low_stock = EXCLUDED.notify_low_stock,
       low_stock_threshold = EXCLUDED.low_stock_threshold,
       notify_sos_usage = EXCLUDED.notify_sos_usage,
       config_mode = EXCLUDED.config_mode,
       group_id = EXCLUDED.group_id,
       caregiver_id = EXCLUDED.caregiver_id,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      String(patientId),
      vals.overdue_notify_minutes,
      vals.require_caregiver_confirm,
      vals.require_confirm_after_missed,
      vals.require_confirm_undo,
      vals.missed_dose_minutes,
      vals.allow_patient_med_edit,
      vals.notify_low_stock,
      vals.low_stock_threshold,
      vals.notify_sos_usage,
      mode,
      mode === 'group' && groupId ? String(groupId) : null,
      String(caregiverId),
    ]
  );
}

export async function GET(req) {
  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/caregiver/settings');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
  if (!claims?.sub) {
    client.release();
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const rawPatientId = String(searchParams.get('patientId') || '').trim();
  if (rawPatientId && !UUID_REGEX.test(rawPatientId)) {
    client.release();
    return NextResponse.json({ error: 'patientId inválido.' }, { status: 400, headers: corsHeaders });
  }

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const requesterId = String(claims.sub);

    if (rawPatientId && requesterId.toLowerCase() !== rawPatientId.toLowerCase()) {
      const linkRes = await client.query(
        `SELECT permission_level
         FROM caregiver_relationships
         WHERE patient_id::text = $1::text
           AND caregiver_id::text = $2::text
           AND status = 'active'
         LIMIT 1`,
        [rawPatientId, requesterId]
      );
      if (linkRes.rowCount === 0) {
        return NextResponse.json(
          { error: 'Sem vínculo ativo autorizado com este paciente.' },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const overview = await fetchCaregiverManagementOverview(client, requesterId);

    if (rawPatientId) {
      const { effective, meta } = await fetchPatientCareRuleMeta(client, rawPatientId, requesterId);
      return NextResponse.json(
        {
          ok: true,
          patientId: rawPatientId,
          settings: {
            ...normalizeCareSettings(effective),
            updated_at: effective.updated_at || null,
          },
          meta,
          globalSettings: overview.globalSettings,
          groups: overview.groups,
          patientsOverview: overview.patientsOverview,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        settings: overview.globalSettings,
        meta: {
          config_mode: 'global',
          group_id: null,
          group_name: null,
          group_color: null,
          effective_source: overview.globalSettings.is_configured ? 'global' : 'default',
          custom_settings: { ...DEFAULT_CARE_SETTINGS },
        },
        globalSettings: overview.globalSettings,
        groups: overview.groups,
        patientsOverview: overview.patientsOverview,
      },
      { status: 200, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

async function handleSaveSettings(req) {
  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/caregiver/settings');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    client.release();
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    client.release();
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  const scope = String(body?.scope || 'patient').trim().toLowerCase();
  const caregiverId = String(claims.sub);
  const activePatientId = String(body?.patientId || searchParams.get('patientId') || '').trim();
  if (activePatientId && !UUID_REGEX.test(activePatientId)) {
    client.release();
    return NextResponse.json({ error: 'patientId inválido.' }, { status: 400, headers: corsHeaders });
  }

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const caregiverName = await getCaregiverName(client, caregiverId, claims.email);

    // -------------------------------------------------------------------------
    // ESCOPO 1: CONFIGURAÇÃO GLOBAL DA CLÍNICA / CUIDADOR
    // -------------------------------------------------------------------------
    if (scope === 'global') {
      const incoming = body?.settings && typeof body.settings === 'object' ? body.settings : body;
      const normalizedGlobal = normalizeCareSettings({
        ...DEFAULT_CARE_SETTINGS,
        ...incoming,
      });

      await client.query(
        `INSERT INTO public.caregiver_global_settings (
           caregiver_id, overdue_notify_minutes, require_caregiver_confirm,
           require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
           allow_patient_med_edit, notify_low_stock, low_stock_threshold,
           notify_sos_usage, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (caregiver_id) DO UPDATE SET
           overdue_notify_minutes = EXCLUDED.overdue_notify_minutes,
           require_caregiver_confirm = EXCLUDED.require_caregiver_confirm,
           require_confirm_after_missed = EXCLUDED.require_confirm_after_missed,
           require_confirm_undo = EXCLUDED.require_confirm_undo,
           missed_dose_minutes = EXCLUDED.missed_dose_minutes,
           allow_patient_med_edit = EXCLUDED.allow_patient_med_edit,
           notify_low_stock = EXCLUDED.notify_low_stock,
           low_stock_threshold = EXCLUDED.low_stock_threshold,
           notify_sos_usage = EXCLUDED.notify_sos_usage,
           updated_at = NOW()`,
        [
          caregiverId,
          normalizedGlobal.overdue_notify_minutes,
          normalizedGlobal.require_caregiver_confirm,
          normalizedGlobal.require_confirm_after_missed,
          normalizedGlobal.require_confirm_undo,
          normalizedGlobal.missed_dose_minutes,
          normalizedGlobal.allow_patient_med_edit,
          normalizedGlobal.notify_low_stock,
          normalizedGlobal.low_stock_threshold,
          normalizedGlobal.notify_sos_usage,
        ]
      );

      const applyToAll = Boolean(body?.applyToAll);
      let appliedCount = 0;

      if (applyToAll) {
        const activeLinksRes = await client.query(
          `SELECT patient_id, permission_level
           FROM caregiver_relationships
           WHERE caregiver_id::text = $1::text
             AND status = 'active'
             AND patient_id IS NOT NULL`,
          [caregiverId]
        );
        const editablePatientIds = (activeLinksRes.rows || [])
          .filter((r) => !['viewer', 'read_only'].includes(String(r.permission_level || '').toLowerCase()))
          .map((r) => String(r.patient_id));

        for (const pid of editablePatientIds) {
          await upsertPatientCareRow(client, {
            patientId: pid,
            caregiverId,
            mode: 'global',
            groupId: null,
            ruleValues: normalizedGlobal,
          });
          await client
            .query(
              `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
               VALUES ($1, $2, $3, 'care_settings_global_updated', '{}'::jsonb, $4::jsonb, $5)`,
              [
                crypto.randomUUID(),
                pid,
                caregiverId,
                JSON.stringify({
                  ...normalizedGlobal,
                  config_mode: 'global',
                  actor_name: caregiverName,
                  actor_role: 'cuidador',
                  origin: 'caregiver_web',
                }),
                'Regras globais da clínica aplicadas para todos os pacientes',
              ]
            )
            .catch(() => {});
          appliedCount += 1;
        }
      }

      const overview = await fetchCaregiverManagementOverview(client, caregiverId);
      let patientPayload = null;
      if (activePatientId) {
        patientPayload = await fetchPatientCareRuleMeta(client, activePatientId, caregiverId);
      }

      return NextResponse.json(
        {
          ok: true,
          scope: 'global',
          applyToAll,
          appliedCount,
          globalSettings: overview.globalSettings,
          groups: overview.groups,
          patientsOverview: overview.patientsOverview,
          settings: patientPayload
            ? { ...normalizeCareSettings(patientPayload.effective), updated_at: patientPayload.effective.updated_at }
            : overview.globalSettings,
          meta: patientPayload?.meta || null,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // ESCOPO 2: GRUPOS DE PACIENTES / ALAS DA CLÍNICA
    // -------------------------------------------------------------------------
    if (scope === 'group') {
      const groupId = String(body?.groupId || body?.group?.id || '').trim();
      const groupName = String(body?.name ?? body?.group?.name ?? '').trim();
      const groupDesc = String(body?.description ?? body?.group?.description ?? '').trim();
      const groupColor = String(body?.color ?? body?.group?.color ?? '#3b82f6').trim() || '#3b82f6';

      if (!groupName) {
        return NextResponse.json({ error: 'Informe um nome para o grupo de pacientes.' }, { status: 400, headers: corsHeaders });
      }
      if (groupId && !UUID_REGEX.test(groupId)) {
        return NextResponse.json({ error: 'groupId inválido.' }, { status: 400, headers: corsHeaders });
      }

      const incoming = body?.settings && typeof body.settings === 'object' ? body.settings : body?.group?.settings || body;
      const normalizedGroupRules = normalizeCareSettings({
        ...DEFAULT_CARE_SETTINGS,
        ...incoming,
      });

      let savedGroup;
      if (groupId) {
        const upRes = await client.query(
          `UPDATE public.caregiver_patient_groups
           SET name = $1,
               description = $2,
               color = $3,
               overdue_notify_minutes = $4,
               require_caregiver_confirm = $5,
               require_confirm_after_missed = $6,
               require_confirm_undo = $7,
               missed_dose_minutes = $8,
               allow_patient_med_edit = $9,
               notify_low_stock = $10,
               low_stock_threshold = $11,
               notify_sos_usage = $12,
               updated_at = NOW()
           WHERE id::text = $13::text
             AND caregiver_id::text = $14::text
           RETURNING *`,
          [
            groupName,
            groupDesc || null,
            groupColor,
            normalizedGroupRules.overdue_notify_minutes,
            normalizedGroupRules.require_caregiver_confirm,
            normalizedGroupRules.require_confirm_after_missed,
            normalizedGroupRules.require_confirm_undo,
            normalizedGroupRules.missed_dose_minutes,
            normalizedGroupRules.allow_patient_med_edit,
            normalizedGroupRules.notify_low_stock,
            normalizedGroupRules.low_stock_threshold,
            normalizedGroupRules.notify_sos_usage,
            groupId,
            caregiverId,
          ]
        );
        if (upRes.rowCount === 0) {
          return NextResponse.json({ error: 'Grupo não encontrado para este cuidador.' }, { status: 404, headers: corsHeaders });
        }
        savedGroup = upRes.rows[0];
      } else {
        const insRes = await client.query(
          `INSERT INTO public.caregiver_patient_groups (
             id, caregiver_id, name, description, color,
             overdue_notify_minutes, require_caregiver_confirm, require_confirm_after_missed,
             require_confirm_undo, missed_dose_minutes, allow_patient_med_edit,
             notify_low_stock, low_stock_threshold, notify_sos_usage, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
           RETURNING *`,
          [
            crypto.randomUUID(),
            caregiverId,
            groupName,
            groupDesc || null,
            groupColor,
            normalizedGroupRules.overdue_notify_minutes,
            normalizedGroupRules.require_caregiver_confirm,
            normalizedGroupRules.require_confirm_after_missed,
            normalizedGroupRules.require_confirm_undo,
            normalizedGroupRules.missed_dose_minutes,
            normalizedGroupRules.allow_patient_med_edit,
            normalizedGroupRules.notify_low_stock,
            normalizedGroupRules.low_stock_threshold,
            normalizedGroupRules.notify_sos_usage,
          ]
        );
        savedGroup = insRes.rows[0];
      }

      if (Array.isArray(body?.patientIds)) {
        const activeLinksRes = await client.query(
          `SELECT patient_id, permission_level
           FROM caregiver_relationships
           WHERE caregiver_id::text = $1::text
             AND status = 'active'
             AND patient_id IS NOT NULL`,
          [caregiverId]
        );
        const allowedSet = new Set(
          (activeLinksRes.rows || [])
            .filter((r) => !['viewer', 'read_only'].includes(String(r.permission_level || '').toLowerCase()))
            .map((r) => String(r.patient_id).toLowerCase())
        );

        const desiredIds = Array.from(
          new Set(
            body.patientIds
              .map((id) => String(id || '').trim().toLowerCase())
              .filter((id) => UUID_REGEX.test(id) && allowedSet.has(id))
          )
        );

        // Pacientes que saíram do grupo voltam a herdar o Global
        if (desiredIds.length > 0) {
          await client.query(
            `UPDATE public.patient_care_settings
             SET config_mode = 'global', group_id = NULL, caregiver_id = $1, updated_by = $1, updated_at = NOW()
             WHERE group_id::text = $2::text
               AND NOT (LOWER(patient_id::text) = ANY($3::text[]))`,
            [caregiverId, String(savedGroup.id), desiredIds]
          );
        } else {
          await client.query(
            `UPDATE public.patient_care_settings
             SET config_mode = 'global', group_id = NULL, caregiver_id = $1, updated_by = $1, updated_at = NOW()
             WHERE group_id::text = $2::text`,
            [caregiverId, String(savedGroup.id)]
          );
        }

        for (const pid of desiredIds) {
          await upsertPatientCareRow(client, {
            patientId: pid,
            caregiverId,
            mode: 'group',
            groupId: savedGroup.id,
            ruleValues: normalizedGroupRules,
          });
        }
      }

      // Registra auditoria para membros atuais do grupo
      const groupMembersRes = await client
        .query(`SELECT patient_id FROM public.patient_care_settings WHERE group_id::text = $1::text`, [
          String(savedGroup.id),
        ])
        .catch(() => ({ rows: [] }));
      for (const m of groupMembersRes.rows || []) {
        await client
          .query(
            `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
             VALUES ($1, $2, $3, 'care_settings_group_updated', '{}'::jsonb, $4::jsonb, $5)`,
            [
              crypto.randomUUID(),
              m.patient_id,
              caregiverId,
              JSON.stringify({
                ...normalizedGroupRules,
                config_mode: 'group',
                group_name: groupName,
                actor_name: caregiverName,
                actor_role: 'cuidador',
                origin: 'caregiver_web',
              }),
              `Grupo "${groupName}" atualizado no Painel de Gerenciamento`,
            ]
          )
          .catch(() => {});
      }

      const overview = await fetchCaregiverManagementOverview(client, caregiverId);
      let patientPayload = null;
      if (activePatientId) {
        patientPayload = await fetchPatientCareRuleMeta(client, activePatientId, caregiverId);
      }

      return NextResponse.json(
        {
          ok: true,
          scope: 'group',
          group: overview.groups.find((g) => g.id === String(savedGroup.id)) || {
            id: String(savedGroup.id),
            name: groupName,
            description: groupDesc,
            color: groupColor,
            settings: normalizedGroupRules,
          },
          globalSettings: overview.globalSettings,
          groups: overview.groups,
          patientsOverview: overview.patientsOverview,
          settings: patientPayload
            ? { ...normalizeCareSettings(patientPayload.effective), updated_at: patientPayload.effective.updated_at }
            : normalizedGroupRules,
          meta: patientPayload?.meta || null,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // ESCOPO 3: ATUALIZAÇÃO EM LOTE DE PACIENTES (Ex: selecionar vários para Global ou Grupo)
    // -------------------------------------------------------------------------
    if (scope === 'bulk_assign') {
      const targetMode = normalizeConfigMode(body?.config_mode, 'global');
      const targetGroupId = String(body?.group_id || '').trim();
      const rawPatientIds = Array.isArray(body?.patientIds) ? body.patientIds : [];
      if (rawPatientIds.length === 0) {
        return NextResponse.json({ error: 'Selecione ao menos um paciente.' }, { status: 400, headers: corsHeaders });
      }

      let groupRow = null;
      if (targetMode === 'group') {
        if (!UUID_REGEX.test(targetGroupId)) {
          return NextResponse.json({ error: 'Selecione um grupo válido.' }, { status: 400, headers: corsHeaders });
        }
        const gRes = await client.query(
          `SELECT * FROM public.caregiver_patient_groups WHERE id::text = $1::text AND caregiver_id::text = $2::text LIMIT 1`,
          [targetGroupId, caregiverId]
        );
        if (gRes.rowCount === 0) {
          return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404, headers: corsHeaders });
        }
        groupRow = gRes.rows[0];
      }

      const activeLinksRes = await client.query(
        `SELECT patient_id, permission_level
         FROM caregiver_relationships
         WHERE caregiver_id::text = $1::text
           AND status = 'active'
           AND patient_id IS NOT NULL`,
        [caregiverId]
      );
      const allowedSet = new Set(
        (activeLinksRes.rows || [])
          .filter((r) => !['viewer', 'read_only'].includes(String(r.permission_level || '').toLowerCase()))
          .map((r) => String(r.patient_id).toLowerCase())
      );

      const overviewBefore = await fetchCaregiverManagementOverview(client, caregiverId);
      const ruleSnapshot =
        targetMode === 'group' && groupRow
          ? normalizeCareSettings(groupRow)
          : targetMode === 'custom' && body?.settings
          ? normalizeCareSettings(body.settings)
          : normalizeCareSettings(overviewBefore.globalSettings);

      let updatedCount = 0;
      for (const rawPid of rawPatientIds) {
        const pid = String(rawPid || '').trim();
        if (!UUID_REGEX.test(pid) || !allowedSet.has(pid.toLowerCase())) continue;

        await upsertPatientCareRow(client, {
          patientId: pid,
          caregiverId,
          mode: targetMode,
          groupId: targetMode === 'group' ? targetGroupId : null,
          ruleValues: ruleSnapshot,
        });

        await client
          .query(
            `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
             VALUES ($1, $2, $3, 'care_settings_bulk_applied', '{}'::jsonb, $4::jsonb, $5)`,
            [
              crypto.randomUUID(),
              pid,
              caregiverId,
              JSON.stringify({
                ...ruleSnapshot,
                config_mode: targetMode,
                group_name: groupRow?.name || null,
                actor_name: caregiverName,
                actor_role: 'cuidador',
                origin: 'caregiver_web',
              }),
              targetMode === 'group'
                ? `Paciente incluído no grupo "${groupRow?.name || ''}"`
                : 'Paciente configurado para seguir regras globais',
            ]
          )
          .catch(() => {});
        updatedCount += 1;
      }

      const overview = await fetchCaregiverManagementOverview(client, caregiverId);
      let patientPayload = null;
      if (activePatientId) {
        patientPayload = await fetchPatientCareRuleMeta(client, activePatientId, caregiverId);
      }

      return NextResponse.json(
        {
          ok: true,
          scope: 'bulk_assign',
          updatedCount,
          globalSettings: overview.globalSettings,
          groups: overview.groups,
          patientsOverview: overview.patientsOverview,
          settings: patientPayload
            ? { ...normalizeCareSettings(patientPayload.effective), updated_at: patientPayload.effective.updated_at }
            : overview.globalSettings,
          meta: patientPayload?.meta || null,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // ESCOPO 4: POR PACIENTE INDIVIDUAL (global | group | custom)
    // -------------------------------------------------------------------------
    const patientId = activePatientId;
    if (!UUID_REGEX.test(patientId)) {
      return NextResponse.json({ error: 'Informe um patientId válido.' }, { status: 400, headers: corsHeaders });
    }

    const linkRes = await client.query(
      `SELECT id, permission_level
       FROM caregiver_relationships
       WHERE patient_id::text = $1::text
         AND caregiver_id::text = $2::text
         AND status = 'active'
       LIMIT 1`,
      [patientId, caregiverId]
    );

    if (linkRes.rowCount === 0) {
      return NextResponse.json(
        { error: 'Você não possui vínculo de cuidador ativo com este paciente.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const perm = String(linkRes.rows[0]?.permission_level || '').toLowerCase();
    if (perm === 'viewer' || perm === 'read_only') {
      return NextResponse.json(
        { error: 'Seu nível de permissão é somente visualização e não permite alterar regras do paciente.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const prevMetaWrap = await fetchPatientCareRuleMeta(client, patientId, caregiverId);
    const requestedMode = normalizeConfigMode(body?.config_mode, 'custom');
    const requestedGroupId = String(body?.group_id || '').trim();

    let verifiedGroup = null;
    if (requestedMode === 'group') {
      if (!UUID_REGEX.test(requestedGroupId)) {
        return NextResponse.json({ error: 'Selecione um grupo válido para este paciente.' }, { status: 400, headers: corsHeaders });
      }
      const grpCheck = await client.query(
        `SELECT * FROM public.caregiver_patient_groups
         WHERE id::text = $1::text AND caregiver_id::text = $2::text LIMIT 1`,
        [requestedGroupId, caregiverId]
      );
      if (grpCheck.rowCount === 0) {
        return NextResponse.json({ error: 'Grupo selecionado não encontrado.' }, { status: 404, headers: corsHeaders });
      }
      verifiedGroup = grpCheck.rows[0];
    }

    const incomingSettings = body?.settings && typeof body.settings === 'object' ? body.settings : body;
    // Se mudou para 'global' ou 'group', preserva as regras customizadas anteriores na linha como fallback
    const storedRuleColumns =
      requestedMode === 'custom'
        ? normalizeCareSettings({
            ...DEFAULT_CARE_SETTINGS,
            ...prevMetaWrap.meta.custom_settings,
            ...incomingSettings,
          })
        : normalizeCareSettings(prevMetaWrap.meta.custom_settings || prevMetaWrap.effective);

    await upsertPatientCareRow(client, {
      patientId,
      caregiverId,
      mode: requestedMode,
      groupId: requestedMode === 'group' ? verifiedGroup.id : null,
      ruleValues: storedRuleColumns,
    });

    const updatedMetaWrap = await fetchPatientCareRuleMeta(client, patientId, caregiverId);
    const overview = await fetchCaregiverManagementOverview(client, caregiverId);

    const defaultAuditReason =
      requestedMode === 'global'
        ? 'Paciente configurado para herdar as regras globais da clínica'
        : requestedMode === 'group'
        ? `Paciente vinculado ao grupo "${verifiedGroup?.name || ''}"`
        : 'Regras individuais personalizadas no Painel de Gerenciamento';
    const customReason = String(body?.reason || '').trim() || defaultAuditReason;

    await client
      .query(
        `INSERT INTO audit_logs (id, patient_id, performed_by, action, old_value, new_value, reason)
         VALUES ($1, $2, $3, 'care_settings_updated', $4::jsonb, $5::jsonb, $6)`,
        [
          crypto.randomUUID(),
          patientId,
          caregiverId,
          JSON.stringify(prevMetaWrap.effective),
          JSON.stringify({
            ...normalizeCareSettings(updatedMetaWrap.effective),
            config_mode: requestedMode,
            group_name: verifiedGroup?.name || null,
            actor_name: caregiverName,
            actor_role: 'cuidador',
            origin: 'caregiver_web',
          }),
          customReason,
        ]
      )
      .catch(() => {});

    return NextResponse.json(
      {
        ok: true,
        scope: 'patient',
        patientId,
        settings: {
          ...normalizeCareSettings(updatedMetaWrap.effective),
          updated_at: updatedMetaWrap.effective.updated_at || new Date().toISOString(),
        },
        meta: updatedMetaWrap.meta,
        globalSettings: overview.globalSettings,
        groups: overview.groups,
        patientsOverview: overview.patientsOverview,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json(
        {
          error:
            'As tabelas de gerenciamento global e grupos ainda não foram criadas neste banco. Execute "node scripts/run_migrations.js --apply" no servidor.',
        },
        { status: 503, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { error: err?.message || 'Erro ao salvar configurações do paciente.' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function PUT(req) {
  return handleSaveSettings(req);
}

export async function PATCH(req) {
  return handleSaveSettings(req);
}

export async function POST(req) {
  return handleSaveSettings(req);
}

export async function DELETE(req) {
  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/caregiver/settings');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    client.release();
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    client.release();
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const groupId = String(searchParams.get('groupId') || '').trim();
  const activePatientId = String(searchParams.get('patientId') || '').trim();
  if (!UUID_REGEX.test(groupId)) {
    client.release();
    return NextResponse.json({ error: 'Informe um groupId válido.' }, { status: 400, headers: corsHeaders });
  }

  const caregiverId = String(claims.sub);
  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE public.patient_care_settings
       SET config_mode = 'global', group_id = NULL, updated_by = $1, updated_at = NOW()
       WHERE group_id::text = $2::text`,
      [caregiverId, groupId]
    );

    const delRes = await client.query(
      `DELETE FROM public.caregiver_patient_groups
       WHERE id::text = $1::text
         AND caregiver_id::text = $2::text
       RETURNING id`,
      [groupId, caregiverId]
    );

    if (delRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404, headers: corsHeaders });
    }
    await client.query('COMMIT');

    const overview = await fetchCaregiverManagementOverview(client, caregiverId);
    let patientPayload = null;
    if (activePatientId && UUID_REGEX.test(activePatientId)) {
      patientPayload = await fetchPatientCareRuleMeta(client, activePatientId, caregiverId);
    }

    return NextResponse.json(
      {
        ok: true,
        deletedGroupId: groupId,
        globalSettings: overview.globalSettings,
        groups: overview.groups,
        patientsOverview: overview.patientsOverview,
        settings: patientPayload
          ? { ...normalizeCareSettings(patientPayload.effective), updated_at: patientPayload.effective.updated_at }
          : overview.globalSettings,
        meta: patientPayload?.meta || null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json(
      { error: err?.message || 'Erro ao excluir grupo.' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}
