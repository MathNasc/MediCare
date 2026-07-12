'use client';
// src/components/modals/SOSQuickLogModal.jsx
// Registro rápido de uso de medicamento SOS (sob demanda).
// Horário preenchido automaticamente (editável), motivo e quantidade opcionais.

import { useState } from 'react';
import { C } from '@/lib/theme';

const REASON_SUGGESTIONS = ['Dor de cabeça', 'Febre', 'Dor no corpo', 'Alergia', 'Enjoo', 'Cólica'];

export function SOSQuickLogModal({ med, onConfirm, onClose, T, scale = 1 }) {
  const [hora, setHora]           = useState(new Date().toTimeString().slice(0, 5));
  const [motivo, setMotivo]       = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(med, { hora, motivo: motivo.trim() || null, quantidade });
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 900);
  };

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12,
    padding: '12px 14px', color: T.txt, fontSize: 14 * scale, width: '100%', outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Registrar uso de ${med.nome}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(14px)', zIndex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
    >
      <div
        className="anim-scaleIn"
        onClick={e => e.stopPropagation()}
        style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 24, width: '100%', maxWidth: 440, padding: 24, paddingBottom: 28 }}
      >
        {done ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div className="anim-checkPop" style={{ width: 64, height: 64, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 14px', boxShadow: '0 0 30px rgba(34,197,94,.5)' }}>✓</div>
            <p style={{ color: C.green, fontSize: 18 * scale, fontWeight: 800 }}>Registrado!</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: `${med.cor || '#3b82f6'}22`, border: `2px solid ${med.cor || '#3b82f6'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔵</div>
              <div>
                <p style={{ color: T.txt, fontWeight: 900, fontSize: 16 * scale }}>{med.nome}</p>
                <p style={{ color: T.sub, fontSize: 12 * scale }}>{med.dosagem} · Uso sob demanda (SOS)</p>
              </div>
            </div>

            <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>
              Horário
            </label>
            <input type="time" style={{ ...inp, marginBottom: 14 }} value={hora} onChange={e => setHora(e.target.value)} />

            <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>
              Motivo (opcional)
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {REASON_SUGGESTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setMotivo(r)}
                  style={{ padding: '6px 12px', borderRadius: 99, fontSize: 11 * scale, fontWeight: 600, border: `1.5px solid ${motivo === r ? '#3b82f6' : T.bdr}`, background: motivo === r ? 'rgba(59,130,246,.12)' : T.bg3, color: motivo === r ? '#3b82f6' : T.sub, cursor: 'pointer' }}
                >{r}</button>
              ))}
            </div>
            <input style={{ ...inp, marginBottom: 14 }} placeholder="Ex: Dor de cabeça após o almoço" value={motivo} onChange={e => setMotivo(e.target.value)} />

            <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>
              Quantidade
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} style={{ width: 40, height: 40, borderRadius: 10, background: T.bg3, border: `1px solid ${T.bdr}`, color: T.txt, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>−</button>
              <div style={{ flex: 1, textAlign: 'center', color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>{quantidade} {med.unidade}{quantidade !== 1 ? 's' : ''}</div>
              <button onClick={() => setQuantidade(q => q + 1)} style={{ width: 40, height: 40, borderRadius: 10, background: T.bg3, border: `1px solid ${T.bdr}`, color: T.txt, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving}
              style={{ width: '100%', padding: '15px', borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontSize: 15 * scale, fontWeight: 800, border: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)', cursor: 'pointer', marginBottom: 8, opacity: saving ? .7 : 1 }}
            >
              {saving ? 'Registrando…' : '✓ Registrar uso'}
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'none', color: T.muted, fontSize: 13, border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
