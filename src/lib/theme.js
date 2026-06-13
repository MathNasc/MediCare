// ─── Design Tokens ────────────────────────────────────────────────────────────
export const C = {
  green: '#22c55e',   greenBg: '#052e16',
  amber: '#f59e0b',   amberBg: '#1c1200',
  red:   '#ef4444',   redBg:   '#1c0505',
  blue:  '#3b82f6',   blueBg:  '#0a1628',
  purple:'#8b5cf6',   purpleBg:'#2e1065',
};

export const PILL_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#f59e0b','#22c55e','#14b8a6','#06b6d4','#6366f1',
];

export const UNITS = ['comprimido','cápsula','ml','gotas','sachê','unidade'];
export const WEEK_S = ['D','S','T','Q','Q','S','S'];
export const WEEK   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const DEF_HOURS = ['08:00','14:00','20:00'];

// ─── Theme tokens per mode ────────────────────────────────────────────────────
export function TK(dark) {
  return {
    bg0:   dark ? '#0d1117' : '#f0f4f8',
    bg1:   dark ? '#161b22' : '#ffffff',
    bg2:   dark ? '#1c2333' : '#f8fafc',
    bg3:   dark ? '#21262d' : '#e8edf2',
    txt:   dark ? '#f0f4f8' : '#0d1117',
    sub:   dark ? '#8b949e' : '#475569',
    muted: dark ? '#6e7681' : '#94a3b8',
    bdr:   dark ? '#30363d' : '#e2e8f0',
    nav:   dark ? 'rgba(13,17,23,.96)'    : 'rgba(255,255,255,.96)',
    inp:   dark ? '#21262d' : '#ffffff',
    inpB:  dark ? '#30363d' : '#d1d5db',
    shadow:dark ? '0 8px 32px rgba(0,0,0,.5)' : '0 8px 32px rgba(0,0,0,.08)',
  };
}

// ─── Status config ────────────────────────────────────────────────────────────
export const STATUS = {
  scheduled: { label: 'Agendado',   color: '#8b949e', bg: 'rgba(139,148,158,.12)' },
  upcoming:  { label: 'Em breve',   color: '#3b82f6', bg: 'rgba(59,130,246,.15)'  },
  pending:   { label: 'Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,.15)'  },
  late:      { label: 'Atrasado',   color: '#ef4444', bg: 'rgba(239,68,68,.15)'   },
  missed:    { label: 'Perdida',    color: '#6e7681', bg: 'rgba(110,118,129,.12)' },
  confirmed: { label: 'Confirmada', color: '#22c55e', bg: 'rgba(34,197,94,.15)'   },
};
