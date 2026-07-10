// src/lib/permissions.js
// ─── Espelho client-side do RBAC ──────────────────────────────────────────────
// IMPORTANTE: isto é usado APENAS para ocultar/mostrar opções na interface.
// A validação real e obrigatória acontece no Supabase via RLS e funções
// security definer (ver migration 006_rbac_and_audit.sql). Nunca confiar
// apenas nestas checagens para decisões de segurança.

export const ROLES = {
  paciente: {
    code: 'paciente',
    label: 'Paciente',
    icon: '🧑',
    color: '#3b82f6',
    description: 'Registra seus próprios medicamentos e confirma doses. Não pode alterar confirmações após 24h nem editar registros feitos por cuidadores.',
  },
  cuidador: {
    code: 'cuidador',
    label: 'Cuidador',
    icon: '🤝',
    color: '#8b5cf6',
    description: 'Acompanha pacientes vinculados, recebe alertas e pode corrigir registros retroativos com justificativa.',
  },
  independente: {
    code: 'independente',
    label: 'Independente',
    icon: '⚙️',
    color: '#22c55e',
    description: 'Controle total sobre os próprios dados, sem restrição de tempo e sem depender de um cuidador.',
  },
};

// Espelha exatamente os seeds de role_permissions na migration 006
export const ROLE_PERMISSIONS = {
  paciente: [
    'meds.create', 'meds.edit_own',
    'dose.confirm', 'dose.edit_own_24h',
    'history.view', 'calendar.view', 'stats.view',
    'caregiver.share', 'notes.add_own',
  ],
  cuidador: [
    'patients.view_all', 'dose.confirm_for_patient',
    'dose.confirm_retroactive', 'dose.correct_retroactive',
    'calendar.view', 'history.view', 'notes.add_caregiver', 'alerts.receive',
  ],
  independente: [
    'meds.create', 'meds.edit_own', 'meds.delete_own',
    'dose.confirm', 'dose.edit_own_any_time', 'dose.confirm_retroactive_own',
    'history.view', 'history.edit_own', 'calendar.view', 'stats.view',
    'caregiver.share', 'notes.add_own',
  ],
};

/**
 * Verifica (client-side) se um papel possui uma permissão.
 * Uso: apenas para UI (mostrar/ocultar botões). A garantia real é a RLS.
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

/**
 * Verifica se uma dose específica ainda pode ser corrigida pelo próprio paciente,
 * considerando o papel e a janela de 24 horas. Espelha a regra do banco.
 */
export function canEditDoseAsSelf(role, doseDateTime, performedBy, userId) {
  if (performedBy && performedBy !== userId) return false; // feito por cuidador
  if (role === 'independente') return true;
  if (role === 'paciente') {
    const hoursElapsed = (Date.now() - new Date(doseDateTime).getTime()) / 36e5;
    return hoursElapsed <= 24;
  }
  return false;
}

export function getRoleMeta(role) {
  return ROLES[role] || ROLES.independente;
}
