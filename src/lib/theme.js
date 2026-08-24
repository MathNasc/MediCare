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

export function TK(dark, hc) {
  if (hc) {
    return {
      bg0:   dark ? '#000000' : '#ffffff',
      bg1:   dark ? '#111111' : '#f9f9f9',
      bg2:   dark ? '#222222' : '#eeeeee',
      bg3:   dark ? '#444444' : '#dddddd',
      txt:   dark ? '#ffffff' : '#000000',
      sub:   dark ? '#dddddd' : '#222222',
      muted: dark ? '#aaaaaa' : '#555555',
      bdr:   dark ? '#444444' : '#cccccc',
      nav:   dark ? '#000000' : '#ffffff',
      inp:   dark ? '#111111' : '#ffffff',
      inpB:  dark ? '#666666' : '#999999',
      shadow:dark ? '0 8px 32px rgba(0,0,0,.8)' : '0 8px 32px rgba(0,0,0,.15)',
    };
  }
  return {
    bg0:   dark ? '#0f172a' : '#f8fafc',
    bg1:   dark ? '#1e293b' : '#ffffff',
    bg2:   dark ? '#334155' : '#f1f5f9',
    bg3:   dark ? '#475569' : '#e2e8f0',
    txt:   dark ? '#f8fafc' : '#0f172a',
    sub:   dark ? '#cbd5e1' : '#475569',
    muted: dark ? '#64748b' : '#94a3b8',
    bdr:   dark ? '#334155' : '#e2e8f0',
    nav:   dark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    inp:   dark ? '#1e293b' : '#ffffff',
    inpB:  dark ? '#475569' : '#cbd5e1',
    shadow:dark ? '0 8px 32px rgba(0,0,0,.4)' : '0 8px 32px rgba(0,0,0,.06)',
  };
}

export const STATUS = {
  scheduled: { label: 'Agendado',   color: '#8b949e', bg: 'rgba(139,148,158,.12)' },
  upcoming:  { label: 'Em breve',   color: '#3b82f6', bg: 'rgba(59,130,246,.15)'  },
  pending:   { label: 'Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,.15)'  },
  late:      { label: 'Atrasado',   color: '#ef4444', bg: 'rgba(239,68,68,.15)'   },
  missed:    { label: 'Perdida',    color: '#64748b', bg: 'rgba(100,116,139,.15)' },
  confirmed: { label: 'Confirmada', color: '#22c55e', bg: 'rgba(34,197,94,.15)'   },
};
