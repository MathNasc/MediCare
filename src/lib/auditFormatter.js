/**
 * Formatação amigável para registros da Trilha de Auditoria (audit_logs).
 * Traduz códigos técnicos de ação para linguagem clara para cuidadores e familiares.
 */

const ACTION_MAP = {
  dose_confirm_requested: {
    label: 'Solicitação para confirmar dose',
    category: 'Solicitação do Paciente',
    tone: 'amber',
  },
  dose_undo_requested: {
    label: 'Solicitação para desfazer dose',
    category: 'Solicitação do Paciente',
    tone: 'amber',
  },
  dose_confirmed_retroactively: {
    label: 'Dose confirmada fora do horário',
    category: 'Registro de Dose',
    tone: 'blue',
  },
  dose_confirmed_by_patient: {
    label: 'Dose tomada pelo paciente',
    category: 'Registro de Dose',
    tone: 'emerald',
  },
  dose_registered_by_caregiver: {
    label: 'Dose administrada pelo cuidador',
    category: 'Registro de Dose',
    tone: 'emerald',
  },
  dose_marked_missed: {
    label: 'Dose marcada como não administrada',
    category: 'Alerta de Dose',
    tone: 'rose',
  },
  dose_status_updated: {
    label: 'Horário ou status da dose alterado',
    category: 'Retificação',
    tone: 'indigo',
  },
  dose_reverted_to_pending: {
    label: 'Dose devolvida para pendente',
    category: 'Retificação',
    tone: 'amber',
  },
  dose_approval_approved: {
    label: 'Solicitação de dose aprovada pelo cuidador',
    category: 'Validação',
    tone: 'emerald',
  },
  dose_approval_rejected: {
    label: 'Solicitação de dose recusada pelo cuidador',
    category: 'Validação',
    tone: 'rose',
  },
  managed_patient_created: {
    label: 'Paciente dependente cadastrado',
    category: 'Cadastro',
    tone: 'blue',
  },
  patient_pairing_code_generated: {
    label: 'Código de ativação do celular gerado',
    category: 'Vinculação',
    tone: 'indigo',
  },
  stock_adjusted: {
    label: 'Estoque de medicamento atualizado',
    category: 'Estoque',
    tone: 'emerald',
  },
  caregiver_invited: {
    label: 'Convite de cuidador enviado',
    category: 'Vínculo',
    tone: 'blue',
  },
  caregiver_accepted: {
    label: 'Vínculo de cuidador aceito',
    category: 'Vínculo',
    tone: 'emerald',
  },
  caregiver_revoked: {
    label: 'Vínculo de cuidador encerrado',
    category: 'Vínculo',
    tone: 'rose',
  },
  care_settings_updated: {
    label: 'Regras de gerenciamento atualizadas',
    category: 'Gerenciamento',
    tone: 'indigo',
  },
  care_settings_global_updated: {
    label: 'Regras globais da clínica aplicadas',
    category: 'Gerenciamento Global',
    tone: 'indigo',
  },
  care_settings_group_updated: {
    label: 'Regras do grupo atualizadas',
    category: 'Gerenciamento por Grupo',
    tone: 'blue',
  },
  care_settings_bulk_applied: {
    label: 'Modo de gerenciamento atualizado em lote',
    category: 'Gerenciamento',
    tone: 'indigo',
  },
};

function parseJsonSafe(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return null;
}

function formatFallbackAction(rawAction) {
  const clean = String(rawAction || '').trim();
  if (!clean) return 'Registro de acompanhamento';
  const words = clean
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatIsoDateBr(rawDate) {
  if (!rawDate) return '';
  const m = String(rawDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(rawDate);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatAuditLogEntry(log) {
  const rawAction = String(log?.action || '').trim();
  const mapped = ACTION_MAP[rawAction] || {
    label: formatFallbackAction(rawAction),
    category: 'Auditoria',
    tone: 'slate',
  };

  const newVal = parseJsonSafe(log?.new_value) || {};
  const oldVal = parseJsonSafe(log?.old_value) || {};

  const medName =
    log?.med_name ||
    newVal.med_nome ||
    newVal.med_name ||
    oldVal.med_nome ||
    oldVal.med_name ||
    null;

  const scheduledTime =
    newVal.scheduled_time ||
    newVal.hora ||
    oldVal.hora ||
    null;

  const scheduledDate =
    newVal.scheduled_date ||
    newVal.dose_date ||
    oldVal.dose_date ||
    null;

  const actualTime = newVal.actual_administration_time || null;

  const actorRole = newVal.actor_role || '';
  const rawActorName = log?.actor_name || newVal.actor_name || '';
  let actorLabel = '';
  if (rawActorName) {
    actorLabel = rawActorName;
  } else if (actorRole === 'cuidador' || newVal.origin === 'caregiver_web') {
    actorLabel = 'Cuidador';
  } else if (actorRole === 'paciente' || newVal.origin === 'patient_app') {
    actorLabel = 'Paciente';
  }

  const contextParts = [];
  if (medName) {
    contextParts.push(scheduledTime ? `${medName} (${scheduledTime})` : medName);
  } else if (scheduledTime) {
    contextParts.push(`Horário previsto: ${scheduledTime}`);
  }
  if (actualTime && actualTime !== scheduledTime) {
    contextParts.push(`Tomado às ${actualTime}`);
  }
  if (scheduledDate) {
    contextParts.push(`Data: ${formatIsoDateBr(scheduledDate)}`);
  }

  return {
    title: mapped.label,
    category: mapped.category,
    tone: mapped.tone,
    contextSummary: contextParts.join(' · '),
    actorLabel,
    reason: log?.reason || 'Registro de acompanhamento',
  };
}
