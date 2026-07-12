// src/lib/treatmentTypes.js
// ─── Tipos de tratamento ───────────────────────────────────────────────────────
// Espelho client-side dos tipos definidos no banco (medicamentos.treatment_type).
// Centraliza ícones, cores, labels e cálculos de progresso usados em várias
// telas (MedsScreen, CalendarScreen, StatsScreen, MedModal).

export const TREATMENT_TYPES = {
  continuous: {
    code: 'continuous',
    label: 'Uso Contínuo',
    shortLabel: 'Contínuo',
    icon: '🟢',
    color: '#22c55e',
    bg: 'rgba(34,197,94,.12)',
    description: 'Utilizado continuamente, sem data de término. Gera lembretes diários.',
  },
  temporary: {
    code: 'temporary',
    label: 'Tratamento Temporário',
    shortLabel: 'Temporário',
    icon: '🟡',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,.12)',
    description: 'Utilizado durante um período específico. Encerra automaticamente ao final.',
  },
  sos: {
    code: 'sos',
    label: 'Uso Sob Demanda (SOS)',
    shortLabel: 'SOS',
    icon: '🔵',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,.12)',
    description: 'Utilizado apenas quando necessário. Não gera lembretes automáticos.',
  },
};

export function getTreatmentMeta(type) {
  return TREATMENT_TYPES[type] || TREATMENT_TYPES.continuous;
}

export const TREATMENT_STATUS = {
  ativo:     { label: 'Ativo',     color: '#22c55e' },
  pausado:   { label: 'Pausado',   color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#8b949e' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
};

export function getStatusMeta(status) {
  return TREATMENT_STATUS[status] || TREATMENT_STATUS.ativo;
}

/**
 * Calcula quantos dias um tratamento temporário terá, dado início e fim.
 */
export function calcTreatmentDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate + 'T00:00:00');
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * Calcula a data de término a partir da data de início + duração em dias.
 */
export function computeEndDate(startDate, days) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(start.getTime() + (Math.max(1, days) - 1) * 86400000);
  return end.toISOString().slice(0, 10);
}

/**
 * Retorna o progresso de um tratamento temporário: dia atual, total de dias,
 * percentual e se já expirou. Retorna null para tipos não-temporários.
 */
export function getTreatmentProgress(med) {
  if (med?.treatment_type !== 'temporary' || !med.start_date || !med.end_date) return null;

  const start = new Date(med.start_date + 'T00:00:00');
  const end   = new Date(med.end_date + 'T00:00:00');
  const now   = new Date(new Date().toDateString());

  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const rawDay    = Math.round((now - start) / 86400000) + 1;
  const dayNumber = Math.min(totalDays, Math.max(1, rawDay));
  const percent   = Math.min(100, Math.round((dayNumber / totalDays) * 100));
  const isExpired = now > end;
  const notStarted = now < start;

  return { dayNumber, totalDays, percent, isExpired, notStarted };
}

/**
 * Verifica (client-side, otimista) se um tratamento temporário já deveria
 * estar concluído. A garantia real acontece na RPC finish_expired_treatments.
 */
export function isTemporaryExpired(med) {
  if (med?.treatment_type !== 'temporary' || !med.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return med.end_date < today;
}
