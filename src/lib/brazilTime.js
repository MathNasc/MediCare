export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

export function getBrazilDateIso(dateRef = new Date()) {
  const d = dateRef instanceof Date ? dateRef : new Date(dateRef);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: BRAZIL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
}

export function getBrazilMonthPrefix(dateRef = new Date()) {
  return getBrazilDateIso(dateRef).slice(0, 7);
}

export function addDaysBrazilDateIso(daysToAdd = 0, baseDate = new Date()) {
  const baseIso =
    typeof baseDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(baseDate.trim())
      ? baseDate.trim().slice(0, 10)
      : getBrazilDateIso(baseDate);
  const [y, m, d] = baseIso.split('-').map(Number);
  if (!y || !m || !d) return getBrazilDateIso();
  const utcMidday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0) + Number(daysToAdd || 0) * 86400000);
  return utcMidday.toISOString().slice(0, 10);
}

export function getBrazilTimeHm(dateRef = new Date()) {
  const d = dateRef instanceof Date ? dateRef : new Date(dateRef);
  if (Number.isNaN(d.getTime())) return '00:00';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: BRAZIL_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } catch {
    const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return shifted.toISOString().slice(11, 16);
  }
}

export function getBrazilMinutesOfDay(dateRef = new Date()) {
  const hm = getBrazilTimeHm(dateRef);
  const [hh, mm] = hm.split(':').map((n) => Number(n) || 0);
  return hh * 60 + mm;
}

export function parseBrazilDateTime(dateIso, hm = '00:00') {
  const cleanDate = String(dateIso || '').trim().slice(0, 10);
  const cleanHm = String(hm || '00:00').trim().slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(cleanHm)) {
    return new Date(NaN);
  }
  return new Date(`${cleanDate}T${cleanHm}:00-03:00`);
}

export function formatBrazilDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString('pt-BR', { timeZone: BRAZIL_TIME_ZONE });
  } catch {
    const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const iso = shifted.toISOString();
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}, ${iso.slice(11, 19)}`;
  }
}

export function formatBrazilTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('pt-BR', {
      timeZone: BRAZIL_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return getBrazilTimeHm(d);
  }
}
