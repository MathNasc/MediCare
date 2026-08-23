const now = new Date('2026-08-23T17:15:00Z'); // Current UTC time
const tz = 'America/Sao_Paulo';
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const parts = formatter.formatToParts(now);
const map = {};
parts.forEach(p => map[p.type] = p.value);
const nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}Z`);
const todayISO = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth()+1).padStart(2, '0')}-${String(nowLocal.getUTCDate()).padStart(2, '0')}`;
const dayOfWeek = nowLocal.getUTCDay() + 1;
console.log({ nowLocal: nowLocal.toISOString(), todayISO, dayOfWeek });
