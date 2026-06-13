'use client';
import { Ring } from '@/components/ui/Ring';
import { C } from '@/lib/theme';

const DEF_HOURS = ['08:00', '14:00', '20:00'];

export function MedDetail({ med, history, onClose, T, scale = 1 }) {
  const hist = history.filter((h) => h.med_id === med.id).slice(0, 8);
  const rate =
    hist.length > 0
      ? Math.round((hist.filter((h) => h.status === 'confirmed').length / hist.length) * 100)
      : 0;
  const stockPct = Math.min(100, (med.quantidade / 60) * 100);
  const stockCol = med.quantidade <= 5 ? C.red : med.quantidade <= 10 ? C.amber : C.green;

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={`Detalhes de ${med.nome}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(16px)', zIndex: 300,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="anim-fadeUp"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg1, borderRadius: '28px 28px 0 0',
          width: '100%', maxWidth: 480,
          maxHeight: '88vh', overflowY: 'auto', paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg,${med.cor}20,${med.cor}08)`,
          borderRadius: '28px 28px 0 0',
          padding: 22, borderBottom: `1px solid ${T.bdr}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 16,
              background: med.cor + '28', border: `2px solid ${med.cor}60`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>💊</div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: T.bg3, color: T.sub, fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
          <h2 style={{ color: T.txt, fontSize: 24 * scale, fontWeight: 900, marginBottom: 3 }}>{med.nome}</h2>
          <p style={{ color: T.sub, fontSize: 15 * scale }}>{med.dosagem} · {med.unidade}</p>
          {med.observacoes && (
            <p style={{
              color: T.muted, fontSize: 13 * scale, marginTop: 10,
              background: T.bg2, borderRadius: 10, padding: '8px 12px', lineHeight: 1.5,
            }}>{med.observacoes}</p>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: T.bg2, borderRadius: 16, padding: 14, textAlign: 'center' }}>
              <p style={{ color: T.muted, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Adesão</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ring value={rate} size={48} stroke={5}
                  color={rate >= 80 ? C.green : rate >= 60 ? C.amber : C.red}
                  trackColor={T.bg3} />
                <p style={{ color: T.txt, fontSize: 24 * scale, fontWeight: 900 }}>{rate}%</p>
              </div>
            </div>
            <div style={{ background: T.bg2, borderRadius: 16, padding: 14, textAlign: 'center' }}>
              <p style={{ color: T.muted, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Estoque</p>
              <p style={{ color: stockCol, fontSize: 30 * scale, fontWeight: 900, lineHeight: 1 }}>{med.quantidade}</p>
              <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 3 }}>{med.unidade}s</p>
            </div>
          </div>

          {/* Stock bar */}
          <div style={{ background: T.bg2, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: T.sub, fontSize: 13 * scale, fontWeight: 600 }}>Nível de estoque</p>
              <span style={{ color: stockCol, fontSize: 12 * scale, fontWeight: 700 }}>
                {med.quantidade <= 5 ? '⚠ Repor em breve' : med.quantidade <= 10 ? '⚡ Baixo' : '✓ OK'}
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 99, background: T.bg3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: stockCol, width: `${stockPct}%`, transition: 'width .5s',
              }} />
            </div>
          </div>

          {/* Horários */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: T.sub, fontSize: 12 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Horários</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {DEF_HOURS.map((h) => (
                <div key={h} style={{ flex: 1, background: T.bg2, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                  <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 800 }}>{h}</p>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          {hist.length > 0 && (
            <div>
              <p style={{ color: T.sub, fontSize: 12 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Histórico recente</p>
              {hist.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${T.bdr}` }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: h.status === 'confirmed' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: h.status === 'confirmed' ? C.green : C.red,
                    fontWeight: 800, fontSize: 14, flexShrink: 0,
                  }}>
                    {h.status === 'confirmed' ? '✓' : '✕'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: T.txt, fontSize: 13 * scale, fontWeight: 500 }}>
                      {h.hora} · {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                    {h.atraso_minutos > 0 && (
                      <p style={{ color: T.muted, fontSize: 11 * scale }}>+{h.atraso_minutos} min de atraso</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
