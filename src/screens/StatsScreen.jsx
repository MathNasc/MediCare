'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Ring } from '@/components/ui/Ring';
import { StockBar } from '@/components/Dashboard';
import { C, WEEK } from '@/lib/theme';

// ─── Indicadores de tratamento (contínuos, ativos, concluídos, SOS do mês) ────
function TreatmentDashboard({ T, scale }) {
  const { getTreatmentDashboard } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    getTreatmentDashboard().then(d => { if (mounted) setData(d); });
    return () => { mounted = false; };
  }, [getTreatmentDashboard]);

  if (!data) return null;

  const cards = [
    { icon: '🟢', label: 'Medicamentos contínuos', value: data.continuous_count,    color: '#22c55e' },
    { icon: '🟡', label: 'Tratamentos ativos',      value: data.active_treatments,  color: '#f59e0b' },
    { icon: '✓',  label: 'Tratamentos concluídos',  value: data.finished_treatments, color: T.sub     },
    { icon: '🔵', label: 'SOS utilizados este mês',  value: data.sos_uses_this_month, color: '#3b82f6' },
  ];

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
      <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 14 }}>💊 Tratamentos</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: T.bg2, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>{c.icon}</span>
              <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, lineHeight: 1.3 }}>{c.label}</p>
            </div>
            <p style={{ color: c.color, fontSize: 24 * scale, fontWeight: 900 }}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsScreen({ T, scale }) {
  const { meds, history, doses } = useApp();

  const histConf  = history.filter((h) => h.status === 'confirmed').length;
  const adhesion  = history.length > 0 ? Math.round((histConf / history.length) * 100) : 0;
  const confirmed = doses.filter((d) => d.status === 'confirmed').length;
  const pending   = doses.filter((d) => ['pending', 'late'].includes(d.status)).length;
  const critical  = meds.filter((m) => m.quantidade <= 5).length;

  const weekData = WEEK.map((l, i) => ({
    l, v: history.filter((h) => new Date(h.created_at).getDay() === i && h.status === 'confirmed').length,
  }));
  const maxW     = Math.max(...weekData.map((d) => d.v), 1);
  const todayIdx = new Date().getDay();

  return (
    <div className="anim-fadeUp">
      <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Saúde em números</h2>

      {/* Adhesion hero */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 22, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ring value={adhesion} size={92} stroke={9}
            color={adhesion >= 80 ? C.green : adhesion >= 60 ? C.amber : C.red}
            trackColor={T.bg3} />
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <p style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 900, lineHeight: 1 }}>{adhesion}%</p>
          </div>
        </div>
        <div>
          <p style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 800, marginBottom: 4 }}>Taxa de adesão</p>
          <p style={{ color: T.sub, fontSize: 13 * scale, lineHeight: 1.5 }}>{histConf} de {history.length} doses confirmadas</p>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12 * scale, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: adhesion >= 80 ? C.greenBg : adhesion >= 60 ? C.amberBg : C.redBg, color: adhesion >= 80 ? C.green : adhesion >= 60 ? C.amber : C.red }}>
              {adhesion >= 80 ? '🌟 Excelente' : adhesion >= 60 ? '⚡ Bom progresso' : '💪 Vamos melhorar'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Hoje: tomadas',   v: confirmed,                    c: C.green },
          { l: 'Hoje: pendentes', v: pending,                      c: C.amber },
          { l: 'Meds ativos',     v: meds.filter((m) => m.ativo).length, c: C.blue },
          { l: 'Estoque crítico', v: critical,                     c: C.red   },
        ].map((s) => (
          <div key={s.l} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 600, marginBottom: 4, letterSpacing: '.3px', textTransform: 'uppercase' }}>{s.l}</p>
            <p style={{ color: s.c, fontSize: 28 * scale, fontWeight: 900 }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Indicadores de tratamento (contínuo/temporário/SOS) */}
      <TreatmentDashboard T={T} scale={scale} />

      {/* Weekly chart */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
        <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 14 }}>Doses confirmadas — semana</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, paddingTop: 16 }}>
          {weekData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {d.v > 0 && <p style={{ color: T.muted, fontSize: 9 * scale, fontWeight: 700 }}>{d.v}</p>}
              <div style={{ width: '100%', borderRadius: '5px 5px 0 0', background: d.v > 0 ? (i === todayIdx ? '#3b82f6' : '#6366f1') : T.bg3, height: `${Math.max(6, (d.v / maxW) * 56)}px`, transition: 'height .4s', outline: i === todayIdx ? '2px solid #3b82f660' : 'none' }} />
              <p style={{ color: i === todayIdx ? T.txt : T.muted, fontSize: 9 * scale, fontWeight: i === todayIdx ? 800 : 500 }}>{d.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
        <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 14 }}>📦 Controle de estoque</p>
        {meds.map((m) => <StockBar key={m.id} med={m} T={T} scale={scale} />)}
      </div>

      {/* History */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16 }}>
        <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 14 }}>Histórico recente</p>
        {history.length === 0 ? (
          <p style={{ color: T.sub, textAlign: 'center', padding: '16px 0', fontSize: 14 * scale }}>Confirme suas doses para ver o histórico</p>
        ) : (
          history.slice(0, 10).map((h) => {
            const med = meds.find((m) => m.id === h.med_id);
            const ok  = h.status === 'confirmed';
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${T.bdr}` }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ok ? C.green : C.red, fontWeight: 800, fontSize: 15 }}>
                  {ok ? '✓' : '✕'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {med?.nome || 'Medicamento'}
                    {med?.treatment_type === 'sos' && <span style={{ color: '#3b82f6', fontWeight: 700 }}> · SOS</span>}
                  </p>
                  <p style={{ color: T.muted, fontSize: 11 * scale }}>
                    {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {h.hora}{h.atraso_minutos > 0 ? ` · +${h.atraso_minutos}min` : ''}
                  </p>
                  {h.motivo && <p style={{ color: T.muted, fontSize: 11 * scale, fontStyle: 'italic' }}>Motivo: {h.motivo}</p>}
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? C.green : C.red, flexShrink: 0 }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
