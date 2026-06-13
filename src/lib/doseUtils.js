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

export function buildDoses(medList, history) {
  const today = new Date().toDateString();
  const result = [];

  medList
    .filter((m) => m.ativo)
    .forEach((m) => {
      // Use the medication's own saved horarios; fall back to a single default only if missing
      const horarios = Array.isArray(m.horarios) && m.horarios.length > 0
        ? m.horarios
        : ['08:00'];

      horarios.forEach((hora, i) => {
        const done = history.find(
          (h) =>
            h.med_id === m.id &&
            h.hora === hora &&
            new Date(h.created_at).toDateString() === today &&
            h.status === 'confirmed'
        );
        result.push({
          id:      `${m.id}-${hora.replace(':', '')}`,
          med_id:  m.id,
          nome:    m.nome,
          dosagem: m.dosagem,
          unidade: m.unidade,
          cor:     m.cor,
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
