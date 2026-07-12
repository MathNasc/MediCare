import { STATUS } from './theme';

export function minutesTill(hora) {
  const [h, m] = hora.split(':').map(Number);
  const now = new Date(), target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target - now) / 60000);
}

export function timeLabel(hora) {
  const d = minutesTill(hora);
  if (d > 60)   return `em ${Math.round(d / 60)}h`;
  if (d > 0)    return `em ${d} min`;
  if (d === 0)  return 'agora';
  if (d > -60)  return `${Math.abs(d)} min atrás`;
  return `${Math.round(Math.abs(d) / 60)}h atrás`;
}

export function getDoseStatus(hora, confirmed) {
  if (confirmed) return 'confirmed';
  const d = minutesTill(hora);
  if (d > 15)   return 'scheduled';
  if (d > 0)    return 'upcoming';
  if (d > -30)  return 'pending';
  if (d > -120) return 'late';
  return 'missed';
}

// ─── Construção da lista de doses do dia ──────────────────────────────────────
// Considera o tipo de tratamento de cada medicamento:
//   - continuous: sempre gera doses programadas (comportamento original)
//   - temporary:  só gera doses se a data de hoje estiver dentro de
//                 [start_date, end_date] e o status ainda for 'ativo'
//   - sos:        NUNCA gera doses programadas/lembretes. Só aparece no
//                 histórico quando o próprio usuário registra o uso
//                 manualmente (ver AppContext.registerSOSUse).
export function buildDoses(medList, history) {
  const today = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);
  const result = [];

  medList
    .filter((m) => m.ativo)
    .filter((m) => {
      const type = m.treatment_type || 'continuous';
      if (type === 'sos') return false; // SOS nunca entra na agenda do dia
      if (type === 'temporary') {
        if (m.status && m.status !== 'ativo') return false;
        if (m.start_date && todayISO < m.start_date) return false;
        if (m.end_date && todayISO > m.end_date) return false;
      }
      return true;
    })
    .forEach((m) => {
      // Use a medicação's own saved horarios; fall back to a single default only if missing
      const horarios = Array.isArray(m.horarios) && m.horarios.length > 0
        ? m.horarios
        : ['08:00'];

      horarios.forEach((hora) => {
        const done = history.find(
          (h) =>
            h.med_id === m.id &&
            h.hora === hora &&
            new Date(h.created_at).toDateString() === today &&
            h.status === 'confirmed'
        );
        result.push({
          id:              `${m.id}-${hora.replace(':', '')}`,
          med_id:          m.id,
          nome:            m.nome,
          dosagem:         m.dosagem,
          unidade:         m.unidade,
          cor:             m.cor,
          treatment_type:  m.treatment_type || 'continuous',
          hora,
          status:  getDoseStatus(hora, !!done),
        });
      });
    });

  return result.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function greet(nome) {
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${s}, ${nome?.split(' ')[0] || 'Paciente'}`;
}
