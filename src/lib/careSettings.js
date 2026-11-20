/**
 * Regras e configurações clínicas de acompanhamento do paciente pelo cuidador.
 * Suporta escopo Global (toda a clínica), por Grupos de Pacientes (alas/perfis)
 * e Individual (por paciente).
 */

export const DEFAULT_CARE_SETTINGS = Object.freeze({
  overdue_notify_minutes: 60,
  require_caregiver_confirm: true,
  require_confirm_after_missed: true,
  require_confirm_undo: true,
  missed_dose_minutes: 180,
  allow_patient_med_edit: true,
  notify_low_stock: true,
  low_stock_threshold: 5,
  notify_sos_usage: true,
});

export const CARE_CONFIG_MODES = ['global', 'group', 'custom'];

export const GROUP_COLORS = [
  { id: '#3b82f6', label: 'Azul' },
  { id: '#6366f1', label: 'Índigo' },
  { id: '#10b981', label: 'Esmeralda' },
  { id: '#f59e0b', label: 'Âmbar' },
  { id: '#ec4899', label: 'Rosa' },
  { id: '#8b5cf6', label: 'Violeta' },
];

export const OVERDUE_NOTIFY_OPTIONS = [
  { minutes: 0, label: 'Desativado', shortLabel: 'Desativado' },
  { minutes: 15, label: '15 minutos de atraso', shortLabel: '15 min' },
  { minutes: 30, label: '30 minutos de atraso', shortLabel: '30 min' },
  { minutes: 45, label: '45 minutos de atraso', shortLabel: '45 min' },
  { minutes: 60, label: '1 hora de atraso (Padrão)', shortLabel: '1h' },
  { minutes: 90, label: '1h30 de atraso', shortLabel: '1h30' },
  { minutes: 120, label: '2 horas de atraso', shortLabel: '2h' },
  { minutes: 180, label: '3 horas de atraso', shortLabel: '3h' },
];

export const MISSED_DOSE_WINDOW_OPTIONS = [
  { minutes: 60, label: '1 hora após o previsto', shortLabel: '1h' },
  { minutes: 120, label: '2 horas após o previsto', shortLabel: '2h' },
  { minutes: 180, label: '3 horas após o previsto (Padrão)', shortLabel: '3h' },
  { minutes: 240, label: '4 horas após o previsto', shortLabel: '4h' },
  { minutes: 360, label: '6 horas após o previsto', shortLabel: '6h' },
];

export const CARE_MANAGEMENT_PRESETS = [
  {
    id: 'total_supervision',
    label: 'Supervisão Total',
    description: 'Ideal para idosos ou pacientes que precisam de aprovação em tudo e alerta rápido.',
    settings: {
      overdue_notify_minutes: 30,
      require_caregiver_confirm: true,
      require_confirm_after_missed: true,
      require_confirm_undo: true,
      missed_dose_minutes: 180,
      allow_patient_med_edit: false,
      notify_low_stock: true,
      low_stock_threshold: 7,
      notify_sos_usage: true,
    },
  },
  {
    id: 'standard',
    label: 'Padrão MediCare',
    description: 'Validação de doses pelo cuidador com notificação após 1h sem registro.',
    settings: {
      overdue_notify_minutes: 60,
      require_caregiver_confirm: true,
      require_confirm_after_missed: true,
      require_confirm_undo: true,
      missed_dose_minutes: 180,
      allow_patient_med_edit: true,
      notify_low_stock: true,
      low_stock_threshold: 5,
      notify_sos_usage: true,
    },
  },
  {
    id: 'assisted_autonomy',
    label: 'Autonomia Assistida',
    description: 'Paciente confirma no horário; exige aprovação apenas se passar do prazo (perdida) ou ao desfazer.',
    settings: {
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
  },
  {
    id: 'free_autonomy',
    label: 'Autonomia Livre',
    description: 'Paciente confirma e ajusta doses diretamente sem bloqueio; cuidador apenas acompanha alertas.',
    settings: {
      overdue_notify_minutes: 120,
      require_caregiver_confirm: false,
      require_confirm_after_missed: false,
      require_confirm_undo: false,
      missed_dose_minutes: 240,
      allow_patient_med_edit: true,
      notify_low_stock: true,
      low_stock_threshold: 5,
      notify_sos_usage: true,
    },
  },
];

function parseBool(val, fallback) {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === 1 || val === '1') return true;
  if (val === 'false' || val === 0 || val === '0') return false;
  return fallback;
}

function clampInt(val, min, max, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeConfigMode(val, fallback = 'global') {
  const clean = String(val || '').trim().toLowerCase();
  if (CARE_CONFIG_MODES.includes(clean)) return clean;
  return fallback;
}

export function normalizeCareSettings(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const requireConfirm = parseBool(src.require_caregiver_confirm, DEFAULT_CARE_SETTINGS.require_caregiver_confirm);
  return {
    overdue_notify_minutes: clampInt(src.overdue_notify_minutes, 0, 720, DEFAULT_CARE_SETTINGS.overdue_notify_minutes),
    require_caregiver_confirm: requireConfirm,
    require_confirm_after_missed: parseBool(
      src.require_confirm_after_missed,
      DEFAULT_CARE_SETTINGS.require_confirm_after_missed
    ),
    require_confirm_undo: parseBool(src.require_confirm_undo, DEFAULT_CARE_SETTINGS.require_confirm_undo),
    missed_dose_minutes: clampInt(src.missed_dose_minutes, 30, 720, DEFAULT_CARE_SETTINGS.missed_dose_minutes),
    allow_patient_med_edit: parseBool(src.allow_patient_med_edit, DEFAULT_CARE_SETTINGS.allow_patient_med_edit),
    notify_low_stock: parseBool(src.notify_low_stock, DEFAULT_CARE_SETTINGS.notify_low_stock),
    low_stock_threshold: clampInt(src.low_stock_threshold, 1, 50, DEFAULT_CARE_SETTINGS.low_stock_threshold),
    notify_sos_usage: parseBool(src.notify_sos_usage, DEFAULT_CARE_SETTINGS.notify_sos_usage),
  };
}

export function formatMinutesLabelPt(minutes) {
  const mins = Number(minutes || 0);
  if (mins <= 0) return 'Desativado';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Resolve as regras efetivas considerando a hierarquia:
 *   1) Grupo (quando config_mode === 'group' e o grupo existir)
 *   2) Global do cuidador/clínica (quando config_mode === 'global' ou sem regra individual)
 *   3) Personalizado do paciente (quando config_mode === 'custom')
 *   4) Padrão MediCare (fallback)
 */
export function resolveEffectiveCareSettings({ patientRow = null, groupRow = null, globalRow = null } = {}) {
  const requestedMode = patientRow ? normalizeConfigMode(patientRow.config_mode, 'custom') : 'global';

  if (requestedMode === 'group' && groupRow) {
    return {
      ...normalizeCareSettings(groupRow),
      config_mode: 'group',
      effective_source: 'group',
      group_id: groupRow.id ? String(groupRow.id) : null,
      group_name: groupRow.name || null,
      group_color: groupRow.color || '#3b82f6',
      updated_at: groupRow.updated_at || patientRow?.updated_at || null,
    };
  }

  if (requestedMode === 'custom' && patientRow) {
    return {
      ...normalizeCareSettings(patientRow),
      config_mode: 'custom',
      effective_source: 'custom',
      group_id: null,
      group_name: null,
      group_color: null,
      updated_at: patientRow.updated_at || null,
    };
  }

  if (globalRow) {
    return {
      ...normalizeCareSettings(globalRow),
      config_mode: 'global',
      effective_source: 'global',
      group_id: null,
      group_name: null,
      group_color: null,
      updated_at: globalRow.updated_at || patientRow?.updated_at || null,
    };
  }

  if (patientRow && requestedMode !== 'global') {
    // Fallback se grupo vinculado foi removido e não há global configurado
    return {
      ...normalizeCareSettings(patientRow),
      config_mode: 'global',
      effective_source: 'default',
      group_id: null,
      group_name: null,
      group_color: null,
      updated_at: patientRow.updated_at || null,
    };
  }

  return {
    ...DEFAULT_CARE_SETTINGS,
    config_mode: 'global',
    effective_source: 'default',
    group_id: null,
    group_name: null,
    group_color: null,
    updated_at: null,
  };
}

/**
 * Determina se uma ação do paciente exige solicitação de aprovação ao cuidador.
 */
export function shouldPatientRequireCaregiverApproval({
  careSettings,
  actionType = 'confirm', // 'confirm' | 'undo'
  isDoseMissed = false,
}) {
  const cfg = normalizeCareSettings(careSettings);
  if (actionType === 'undo') {
    return cfg.require_confirm_undo;
  }
  if (cfg.require_caregiver_confirm) {
    return true;
  }
  if (isDoseMissed) {
    return cfg.require_confirm_after_missed;
  }
  return false;
}

async function safeSelectPatientRow(client, patientId) {
  try {
    const res = await client.query(
      `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
              require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
              allow_patient_med_edit, notify_low_stock, low_stock_threshold,
              notify_sos_usage, config_mode, group_id, caregiver_id, updated_at
       FROM public.patient_care_settings
       WHERE patient_id::text = $1::text
       LIMIT 1`,
      [String(patientId)]
    );
    return res.rowCount > 0 ? res.rows[0] : null;
  } catch {
    // Fallback caso a migração 05 ainda não tenha adicionado config_mode/group_id
    try {
      const resLegacy = await client.query(
        `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
                require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                notify_sos_usage, updated_at
         FROM public.patient_care_settings
         WHERE patient_id::text = $1::text
         LIMIT 1`,
        [String(patientId)]
      );
      if (resLegacy.rowCount > 0) {
        return { ...resLegacy.rows[0], config_mode: 'custom', group_id: null, caregiver_id: null };
      }
    } catch {
      // Migração 04 também não aplicada ainda
    }
    return null;
  }
}

/**
 * Carrega as regras efetivas do paciente (resolvendo grupo/global/individual)
 * mais metadados de gerenciamento para a UI web.
 */
export async function fetchPatientCareRuleMeta(client, patientId, preferredCaregiverId = null) {
  if (!client || !patientId) {
    const fallback = resolveEffectiveCareSettings();
    return {
      effective: fallback,
      meta: {
        config_mode: 'global',
        group_id: null,
        group_name: null,
        group_color: null,
        effective_source: 'default',
        custom_settings: { ...DEFAULT_CARE_SETTINGS },
        updated_at: null,
      },
    };
  }

  const patientRow = await safeSelectPatientRow(client, patientId);

  let groupRow = null;
  if (patientRow?.group_id) {
    try {
      const grpRes = await client.query(
        `SELECT id, caregiver_id, name, description, color, overdue_notify_minutes,
                require_caregiver_confirm, require_confirm_after_missed, require_confirm_undo,
                missed_dose_minutes, allow_patient_med_edit, notify_low_stock,
                low_stock_threshold, notify_sos_usage, updated_at
         FROM public.caregiver_patient_groups
         WHERE id::text = $1::text
         LIMIT 1`,
        [String(patientRow.group_id)]
      );
      if (grpRes.rowCount > 0) {
        groupRow = grpRes.rows[0];
      }
    } catch {
      // tabela de grupos ainda não existe antes da migração 05
    }
  }

  let globalRow = null;
  const candidateCaregiverIds = [];
  if (preferredCaregiverId) candidateCaregiverIds.push(String(preferredCaregiverId));
  if (patientRow?.caregiver_id) candidateCaregiverIds.push(String(patientRow.caregiver_id));
  if (groupRow?.caregiver_id) candidateCaregiverIds.push(String(groupRow.caregiver_id));

  try {
    const cgLinks = await client.query(
      `SELECT caregiver_id
       FROM caregiver_relationships
       WHERE patient_id::text = $1::text
         AND status = 'active'
         AND caregiver_id IS NOT NULL
       ORDER BY created_at ASC`,
      [String(patientId)]
    );
    for (const r of cgLinks.rows || []) {
      if (r.caregiver_id) candidateCaregiverIds.push(String(r.caregiver_id));
    }
  } catch {
    // ignora
  }

  const uniqueCgIds = Array.from(new Set(candidateCaregiverIds.filter(Boolean)));
  if (uniqueCgIds.length > 0) {
    try {
      const globRes = await client.query(
        `SELECT caregiver_id, overdue_notify_minutes, require_caregiver_confirm,
                require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                notify_sos_usage, updated_at
         FROM public.caregiver_global_settings
         WHERE caregiver_id::text = ANY($1::text[])`,
        [uniqueCgIds]
      );
      if (globRes.rowCount > 0) {
        for (const cgId of uniqueCgIds) {
          const found = globRes.rows.find((row) => String(row.caregiver_id) === cgId);
          if (found) {
            globalRow = found;
            break;
          }
        }
      }
    } catch {
      // tabela global ainda não existe antes da migração 05
    }
  }

  const effective = resolveEffectiveCareSettings({ patientRow, groupRow, globalRow });
  return {
    effective,
    meta: {
      config_mode: effective.config_mode,
      group_id: effective.group_id,
      group_name: effective.group_name,
      group_color: effective.group_color,
      effective_source: effective.effective_source,
      custom_settings: patientRow ? normalizeCareSettings(patientRow) : { ...DEFAULT_CARE_SETTINGS },
      updated_at: effective.updated_at || null,
    },
  };
}

/**
 * Busca as configurações efetivas do paciente no PostgreSQL com fallback seguro.
 */
export async function fetchPatientCareSettings(client, patientId, options = {}) {
  if (!client || !patientId) {
    return { ...DEFAULT_CARE_SETTINGS };
  }
  const { effective } = await fetchPatientCareRuleMeta(client, patientId, options.caregiverId || null);
  return {
    ...normalizeCareSettings(effective),
    config_mode: effective.config_mode,
    group_id: effective.group_id,
    group_name: effective.group_name,
    effective_source: effective.effective_source,
    updated_at: effective.updated_at || null,
  };
}

/**
 * Busca em lote as regras efetivas de múltiplos pacientes para notificações/alertas.
 */
export async function fetchCareSettingsMapForPatients(client, patientIds = [], caregiversByPatient = null) {
  const map = new Map();
  const cleanIds = Array.from(new Set((patientIds || []).filter(Boolean).map(String)));
  if (!client || cleanIds.length === 0) return map;

  const patientRowsById = new Map();
  try {
    const pRes = await client.query(
      `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
              require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
              allow_patient_med_edit, notify_low_stock, low_stock_threshold,
              notify_sos_usage, config_mode, group_id, caregiver_id, updated_at
       FROM public.patient_care_settings
       WHERE patient_id::text = ANY($1::text[])`,
      [cleanIds]
    );
    for (const r of pRes.rows || []) {
      patientRowsById.set(String(r.patient_id), r);
    }
  } catch {
    try {
      const pLegacy = await client.query(
        `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
                require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                notify_sos_usage, updated_at
         FROM public.patient_care_settings
         WHERE patient_id::text = ANY($1::text[])`,
        [cleanIds]
      );
      for (const r of pLegacy.rows || []) {
        patientRowsById.set(String(r.patient_id), { ...r, config_mode: 'custom', group_id: null, caregiver_id: null });
      }
    } catch {
      // Migração 04 ainda não aplicada
    }
  }

  // Coleta IDs de grupos e cuidadores para busca em lote
  const groupIds = [];
  const caregiverIds = [];
  for (const pid of cleanIds) {
    const pRow = patientRowsById.get(pid);
    if (pRow?.group_id) groupIds.push(String(pRow.group_id));
    if (pRow?.caregiver_id) caregiverIds.push(String(pRow.caregiver_id));
    if (caregiversByPatient instanceof Map) {
      for (const cg of caregiversByPatient.get(pid) || []) {
        caregiverIds.push(String(cg));
      }
    }
  }

  const uniqueGroupIds = Array.from(new Set(groupIds));
  const groupsById = new Map();
  if (uniqueGroupIds.length > 0) {
    try {
      const gRes = await client.query(
        `SELECT id, caregiver_id, name, color, overdue_notify_minutes,
                require_caregiver_confirm, require_confirm_after_missed, require_confirm_undo,
                missed_dose_minutes, allow_patient_med_edit, notify_low_stock,
                low_stock_threshold, notify_sos_usage, updated_at
         FROM public.caregiver_patient_groups
         WHERE id::text = ANY($1::text[])`,
        [uniqueGroupIds]
      );
      for (const g of gRes.rows || []) {
        groupsById.set(String(g.id), g);
        if (g.caregiver_id) caregiverIds.push(String(g.caregiver_id));
      }
    } catch {
      // Migração 05 ainda não aplicada
    }
  }

  const uniqueCgIds = Array.from(new Set(caregiverIds));
  const globalByCaregiverId = new Map();
  if (uniqueCgIds.length > 0) {
    try {
      const glRes = await client.query(
        `SELECT caregiver_id, overdue_notify_minutes, require_caregiver_confirm,
                require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                notify_sos_usage, updated_at
         FROM public.caregiver_global_settings
         WHERE caregiver_id::text = ANY($1::text[])`,
        [uniqueCgIds]
      );
      for (const gl of glRes.rows || []) {
        globalByCaregiverId.set(String(gl.caregiver_id), gl);
      }
    } catch {
      // Migração 05 ainda não aplicada
    }
  }

  for (const pid of cleanIds) {
    const pRow = patientRowsById.get(pid) || null;
    const grpRow = pRow?.group_id ? groupsById.get(String(pRow.group_id)) || null : null;
    let glRow = null;
    if (pRow?.caregiver_id && globalByCaregiverId.has(String(pRow.caregiver_id))) {
      glRow = globalByCaregiverId.get(String(pRow.caregiver_id));
    } else if (caregiversByPatient instanceof Map) {
      for (const cg of caregiversByPatient.get(pid) || []) {
        if (globalByCaregiverId.has(String(cg))) {
          glRow = globalByCaregiverId.get(String(cg));
          break;
        }
      }
    }
    const effective = resolveEffectiveCareSettings({
      patientRow: pRow,
      groupRow: grpRow,
      globalRow: glRow,
    });
    map.set(pid, effective);
  }

  return map;
}

/**
 * Retorna a visão consolidada da clínica/cuidador:
 * - Configurações globais (padrão para todos os pacientes)
 * - Grupos criados pelo cuidador (com lista de pacientes vinculados)
 * - Resumo de todos os pacientes acompanhados e seu modo ativo (global/grupo/personalizado)
 */
export async function fetchCaregiverManagementOverview(client, caregiverId) {
  if (!client || !caregiverId) {
    return {
      globalSettings: { ...DEFAULT_CARE_SETTINGS, is_configured: false, updated_at: null },
      groups: [],
      patientsOverview: [],
    };
  }

  const cgId = String(caregiverId);

  let globalRow = null;
  try {
    const glRes = await client.query(
      `SELECT caregiver_id, overdue_notify_minutes, require_caregiver_confirm,
              require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
              allow_patient_med_edit, notify_low_stock, low_stock_threshold,
              notify_sos_usage, updated_at
       FROM public.caregiver_global_settings
       WHERE caregiver_id::text = $1::text
       LIMIT 1`,
      [cgId]
    );
    if (glRes.rowCount > 0) globalRow = glRes.rows[0];
  } catch {
    // Migração 05 ainda não aplicada
  }

  const globalSettings = {
    ...normalizeCareSettings(globalRow || DEFAULT_CARE_SETTINGS),
    is_configured: Boolean(globalRow),
    updated_at: globalRow?.updated_at || null,
  };

  let groupRows = [];
  try {
    const grRes = await client.query(
      `SELECT id, caregiver_id, name, description, color, overdue_notify_minutes,
              require_caregiver_confirm, require_confirm_after_missed, require_confirm_undo,
              missed_dose_minutes, allow_patient_med_edit, notify_low_stock,
              low_stock_threshold, notify_sos_usage, created_at, updated_at
       FROM public.caregiver_patient_groups
       WHERE caregiver_id::text = $1::text
       ORDER BY LOWER(name) ASC, created_at ASC`,
      [cgId]
    );
    groupRows = grRes.rows || [];
  } catch {
    // Migração 05 ainda não aplicada
  }

  const groupsById = new Map();
  for (const g of groupRows) {
    groupsById.set(String(g.id), g);
  }

  const patRelRes = await client
    .query(
      `SELECT cr.patient_id, cr.relationship_label, cr.permission_level, p.nome
       FROM caregiver_relationships cr
       LEFT JOIN profiles p ON p.id::text = cr.patient_id::text
       WHERE cr.caregiver_id::text = $1::text
         AND cr.status = 'active'
         AND cr.patient_id IS NOT NULL
       ORDER BY LOWER(COALESCE(p.nome, 'Paciente')) ASC`,
      [cgId]
    )
    .catch(() => ({ rows: [] }));

  const linkedPatients = patRelRes.rows || [];
  const patientIds = linkedPatients.map((r) => String(r.patient_id));

  const patientSettingsRows = new Map();
  if (patientIds.length > 0) {
    try {
      const psRes = await client.query(
        `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
                require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                notify_sos_usage, config_mode, group_id, caregiver_id, updated_at
         FROM public.patient_care_settings
         WHERE patient_id::text = ANY($1::text[])`,
        [patientIds]
      );
      for (const r of psRes.rows || []) {
        patientSettingsRows.set(String(r.patient_id), r);
      }
    } catch {
      try {
        const psLegacy = await client.query(
          `SELECT patient_id, overdue_notify_minutes, require_caregiver_confirm,
                  require_confirm_after_missed, require_confirm_undo, missed_dose_minutes,
                  allow_patient_med_edit, notify_low_stock, low_stock_threshold,
                  notify_sos_usage, updated_at
           FROM public.patient_care_settings
           WHERE patient_id::text = ANY($1::text[])`,
          [patientIds]
        );
        for (const r of psLegacy.rows || []) {
          patientSettingsRows.set(String(r.patient_id), {
            ...r,
            config_mode: 'custom',
            group_id: null,
            caregiver_id: null,
          });
        }
      } catch {
        // Migração 04 ainda não aplicada
      }
    }
  }

  const groupMembersMap = new Map();
  for (const g of groupRows) {
    groupMembersMap.set(String(g.id), []);
  }

  const patientsOverview = linkedPatients.map((lp) => {
    const pid = String(lp.patient_id);
    const pRow = patientSettingsRows.get(pid) || null;
    const grpRow = pRow?.group_id ? groupsById.get(String(pRow.group_id)) || null : null;
    const effective = resolveEffectiveCareSettings({
      patientRow: pRow,
      groupRow: grpRow,
      globalRow,
    });
    if (effective.config_mode === 'group' && effective.group_id && groupMembersMap.has(effective.group_id)) {
      groupMembersMap.get(effective.group_id).push(pid);
    }
    return {
      patient_id: pid,
      nome: lp.nome || 'Paciente Vinculado',
      relationship_label: lp.relationship_label || 'Familiar / Acompanhado',
      permission_level: lp.permission_level || 'read_write',
      config_mode: effective.config_mode,
      group_id: effective.group_id,
      group_name: effective.group_name,
      group_color: effective.group_color,
      effective_source: effective.effective_source,
      settings: normalizeCareSettings(effective),
      updated_at: effective.updated_at || null,
    };
  });

  const groups = groupRows.map((g) => {
    const gid = String(g.id);
    const memberIds = groupMembersMap.get(gid) || [];
    return {
      id: gid,
      name: g.name,
      description: g.description || '',
      color: g.color || '#3b82f6',
      settings: normalizeCareSettings(g),
      member_count: memberIds.length,
      patient_ids: memberIds,
      updated_at: g.updated_at || null,
    };
  });

  return {
    globalSettings,
    groups,
    patientsOverview,
  };
}
