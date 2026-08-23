const tz = 'America/Sao_Paulo';
const now = new Date('2026-08-23T16:00:00Z'); // Assuming 16:00 UTC, which is 13:00 SP time
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const parts = formatter.formatToParts(now);
const map = {};
parts.forEach(p => map[p.type] = p.value);
const nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}Z`);
console.log('nowLocal:', nowLocal.toISOString()); // Should be 2026-08-23T13:00:00Z

const hora = '12:58'; // User scheduled it for 12:58 local time
const [h, m] = hora.split(':').map(Number);
const doseTime = new Date(nowLocal);
doseTime.setUTCHours(h, m, 0, 0);

console.log('doseTime:', doseTime.toISOString());

const diffMin = Math.floor((nowLocal.getTime() - doseTime.getTime()) / 60000);
console.log('diffMin:', diffMin);
