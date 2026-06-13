'use client';
import { STATUS, C } from '@/lib/theme';
import { timeLabel } from '@/lib/doseUtils';

// ── Next Dose Hero ────────────────────────────────────────────────────────────
export function NextDoseHero({ dose, onConfirm, T, scale = 1 }) {
  const diff = Math.round((new Date() - (() => { const [h,m]=dose.hora.split(':').map(Number);const t=new Date();t.setHours(h,m,0,0);return t; })()) / -60000);
  const urgent = diff <= 20 && diff > -30;
  const st = STATUS[dose.status] || STATUS.scheduled;

  return (
    <div style={{
      borderRadius: 22, padding: 20, marginBottom: 16,
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${dose.cor}1a 0%, ${dose.cor}08 100%)`,
      border: `1.5px solid ${dose.cor}40`,
    }}>
      <div style={{ position: 'absolute', top: -24, right: -24, width: 110, height: 110, borderRadius: '50%', background: dose.cor + '0a', pointerEvents: 'none' }} />

      <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
        Próximo medicamento
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, flexShrink: 0, background: dose.cor + '28', border: `2px solid ${dose.cor}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💊</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 900, lineHeight: 1.15, marginBottom: 2 }}>{dose.nome}</p>
          <p style={{ color: T.sub, fontSize: 14 * scale }}>{dose.dosagem} · {dose.unidade}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ color: dose.cor, fontSize: 26 * scale, fontWeight: 900, lineHeight: 1 }}>{dose.hora}</p>
          <p className={urgent && diff > 0 ? 'anim-blink' : ''}
            style={{ color: urgent ? st.color : T.muted, fontSize: 12 * scale, fontWeight: 700, marginTop: 2 }}>
            {timeLabel(dose.hora)}
          </p>
        </div>
      </div>

      {dose.status !== 'confirmed' ? (
        <button
          onClick={() => onConfirm(dose)}
          aria-label={`Confirmar dose de ${dose.nome}`}
          style={{
            width: '100%', padding: '15px', borderRadius: 13, background: C.green,
            color: '#fff', fontSize: 16 * scale, fontWeight: 900, border: 'none',
            boxShadow: '0 4px 20px rgba(34,197,94,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >✓ Tomei agora</button>
      ) : (
        <div style={{ padding: '13px', borderRadius: 13, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ color: C.green, fontSize: 18 }}>✓</span>
          <span style={{ color: C.green, fontWeight: 700, fontSize: 15 * scale }}>Dose confirmada</span>
        </div>
      )}
    </div>
  );
}

// ── Daily Progress ────────────────────────────────────────────────────────────
export function DayProgress({ doses, T, scale = 1 }) {
  const total  = doses.length;
  const done   = doses.filter((d) => d.status === 'confirmed').length;
  const late   = doses.filter((d) => ['late', 'pending'].includes(d.status)).length;
  const missed = doses.filter((d) => d.status === 'missed').length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const col    = pct >= 80 ? C.green : pct >= 50 ? C.amber : C.red;

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700 }}>Progresso do dia</p>
        <span style={{ color: col, fontWeight: 900, fontSize: 18 * scale }}>{pct}%</span>
      </div>
      <div style={{ height: 10, borderRadius: 99, background: T.bg3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${col},${col}bb)`, width: `${pct}%`, transition: 'width .8s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <div style={{ display: 'flex' }}>
        {[
          { n: done,   l: 'Tomadas',   c: C.green },
          { n: late,   l: 'Pendentes', c: C.amber },
          { n: missed, l: 'Perdidas',  c: T.muted },
          { n: total,  l: 'Total',     c: T.sub   },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? `1px solid ${T.bdr}` : 'none' }}>
            <p style={{ color: s.c, fontSize: 20 * scale, fontWeight: 900 }}>{s.n}</p>
            <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 1 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
export function Timeline({ doses, onAction, T, scale = 1 }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: `linear-gradient(to bottom,${T.bdr},transparent)`, borderRadius: 2, pointerEvents: 'none' }} />
      {doses.map((dose, i) => {
        const st     = STATUS[dose.status] || STATUS.scheduled;
        const active = ['upcoming', 'pending', 'late'].includes(dose.status);
        return (
          <div
            key={dose.id}
            style={{ display: 'flex', gap: 14, marginBottom: i < doses.length - 1 ? 18 : 0, cursor: active ? 'pointer' : 'default' }}
            onClick={() => active && onAction(dose)}
            role={active ? 'button' : undefined}
            aria-label={active ? `Confirmar ${dose.nome}` : undefined}
            tabIndex={active ? 0 : undefined}
            onKeyDown={active ? (e) => e.key === 'Enter' && onAction(dose) : undefined}
          >
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: st.bg, border: `2px solid ${st.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, zIndex: 1, flexShrink: 0,
                boxShadow: active ? `0 0 14px ${st.color}55` : 'none',
              }}>
                {dose.status === 'confirmed' ? '✓' : dose.status === 'missed' ? '✕' : dose.status === 'late' ? '!' : '💊'}
              </div>
            </div>
            <div style={{ flex: 1, paddingTop: 9, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 15 * scale, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{dose.nome}</p>
                <p style={{ color: st.color, fontWeight: 800, fontSize: 13 * scale, flexShrink: 0 }}>{dose.hora}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11 * scale, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ color: T.muted, fontSize: 12 * scale }}>{dose.dosagem}</span>
                {active && <span style={{ color: T.sub, fontSize: 11 * scale, marginLeft: 'auto' }}>Toque →</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stock Bar ─────────────────────────────────────────────────────────────────
export function StockBar({ med, T, scale = 1 }) {
  const pct   = Math.min(100, (med.quantidade / 60) * 100);
  const col   = med.quantidade <= 5 ? C.red : med.quantidade <= 10 ? C.amber : C.green;
  const label = med.quantidade <= 2 ? '🚨 Urgente' : med.quantidade <= 5 ? '⚠ Muito baixo' : med.quantidade <= 10 ? '⚠ Baixo' : '';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: med.cor, flexShrink: 0 }} />
          <span style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 600 }}>{med.nome}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {label && <span style={{ color: col, fontSize: 10 * scale, fontWeight: 700 }}>{label}</span>}
          <span style={{ color: col, fontSize: 14 * scale, fontWeight: 800 }}>{med.quantidade}</span>
          <span style={{ color: T.muted, fontSize: 11 * scale }}>{med.unidade}s</span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: T.bg3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: col, width: `${pct}%`, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}
