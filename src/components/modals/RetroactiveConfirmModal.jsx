'use client';
// src/components/modals/RetroactiveConfirmModal.jsx
// Modal para confirmação/correção retroativa de uma dose.
// Motivo é OBRIGATÓRIO quando quem corrige não é o próprio paciente (cuidador).
// Quando é o próprio paciente/independente corrigindo, o motivo é opcional.

import { useState } from 'react';
import { C } from '@/lib/theme';

const REASON_SUGGESTIONS = [
  'Paciente esqueceu de confirmar',
  'Confirmação feita em consulta',
  'Erro de registro',
  'Ajuste solicitado pelo paciente',
];

export function RetroactiveConfirmModal({
  dose,          // { nome, dosagem, hora, date, medId, patientId }
  requireReason, // true quando quem age é cuidador
  onConfirm,     // (reason) => Promise
  onClose,
  T,
  scale = 1,
}) {
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const canSubmit = !requireReason || reason.trim().length > 0;

  const handleConfirm = async () => {
    if (!canSubmit) {
      setError('Informe o motivo da alteração.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await onConfirm(reason.trim() || null);
    setSaving(false);
    if (result?.success === false) {
      setError(result.error || 'Não foi possível confirmar. Tente novamente.');
    }
  };

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`,
    borderRadius: 12, padding: '12px 14px',
    color: T.txt, fontSize: 14 * scale, width: '100%',
    resize: 'none', outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar medicamento retroativamente"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)',
        zIndex: 350, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="anim-fadeUp"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg1, borderRadius: '28px 28px 0 0',
          width: '100%', maxWidth: 480, padding: 24, paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: 'rgba(245,158,11,.15)', border: '2px solid rgba(245,158,11,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🕐</div>
            <div>
              <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 900, lineHeight: 1.25 }}>
                Confirmar medicamento retroativamente
              </h3>
              <p style={{ color: T.sub, fontSize: 12 * scale, marginTop: 3 }}>
                {dose?.nome} · {dose?.dosagem} · {dose?.hora}
              </p>
              <p style={{ color: T.muted, fontSize: 11 * scale }}>
                {dose?.date ? new Date(dose.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >×</button>
        </div>

        {/* Campo motivo */}
        <label style={{
          color: T.sub, fontSize: 11 * scale, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.6px',
          display: 'block', marginBottom: 8,
        }}>
          Motivo da alteração {requireReason && <span style={{ color: C.red }}>*</span>}
        </label>

        {/* Sugestões rápidas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {REASON_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setReason(s)}
              style={{
                padding: '6px 12px', borderRadius: 99, fontSize: 11 * scale, fontWeight: 600,
                border: `1.5px solid ${reason === s ? '#3b82f6' : T.bdr}`,
                background: reason === s ? 'rgba(59,130,246,.12)' : T.bg3,
                color: reason === s ? '#3b82f6' : T.sub, cursor: 'pointer',
              }}
            >{s}</button>
          ))}
        </div>

        <textarea
          rows={3}
          style={{ ...inp, marginBottom: 8 }}
          placeholder={requireReason ? 'Descreva o motivo (obrigatório)…' : 'Descreva o motivo (opcional)…'}
          value={reason}
          onChange={e => { setReason(e.target.value); setError(''); }}
        />

        {error && (
          <p style={{ color: C.red, fontSize: 12 * scale, marginBottom: 10 }}>{error}</p>
        )}

        {!requireReason && (
          <p style={{ color: T.muted, fontSize: 11 * scale, marginBottom: 10, lineHeight: 1.5 }}>
            Como você está corrigindo seu próprio registro, o motivo é opcional.
          </p>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: '15px', borderRadius: 13,
              background: T.bg3, color: T.sub,
              fontWeight: 700, fontSize: 14 * scale, border: `1px solid ${T.bdr}`,
              cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={saving || !canSubmit}
            style={{
              flex: 1.4, padding: '15px', borderRadius: 13,
              background: (!canSubmit || saving) ? T.bg3 : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: (!canSubmit || saving) ? T.muted : '#fff',
              fontWeight: 800, fontSize: 14 * scale, border: 'none',
              boxShadow: canSubmit && !saving ? '0 4px 20px rgba(59,130,246,.35)' : 'none',
              cursor: (!canSubmit || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Salvando…' : 'Salvar alteração'}
          </button>
        </div>
      </div>
    </div>
  );
}
