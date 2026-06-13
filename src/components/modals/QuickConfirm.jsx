'use client';
import { useState } from 'react';
import { C } from '@/lib/theme';

export function QuickConfirm({ dose, onConfirm, onSnooze, onClose, T }) {
  const [done, setDone] = useState(false);

  const handle = () => {
    setDone(true);
    setTimeout(() => { onConfirm(dose); onClose(); }, 750);
  };

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Confirmar dose"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)',
        backdropFilter: 'blur(14px)', zIndex: 300,
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', padding: 16,
      }}
    >
      <div
        className="anim-scaleIn"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg1, border: `1px solid ${T.bdr}`,
          borderRadius: 28, width: '100%', maxWidth: 480,
          padding: 28, paddingBottom: 36,
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              className="anim-checkPop"
              style={{
                width: 76, height: 76, borderRadius: '50%',
                background: C.green, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 34, margin: '0 auto 16px',
                boxShadow: '0 0 40px rgba(34,197,94,.5)',
              }}
            >✓</div>
            <p style={{ color: C.green, fontSize: 22, fontWeight: 800 }}>Dose confirmada!</p>
            <p style={{ color: T.sub, fontSize: 14, marginTop: 4 }}>Ótimo trabalho 🌟</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: dose.cor + '28', border: `2px solid ${dose.cor}80`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28, margin: '0 auto 12px',
              }}>💊</div>
              <p style={{
                color: T.sub, fontSize: 13, fontWeight: 600,
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.6px',
              }}>Hora do medicamento</p>
              <p style={{ color: T.txt, fontSize: 23, fontWeight: 900, marginBottom: 3 }}>
                {dose.nome}
              </p>
              <p style={{ color: T.sub, fontSize: 15 }}>{dose.dosagem} · {dose.hora}</p>
            </div>

            <button
              className="anim-glow"
              onClick={handle}
              style={{
                width: '100%', padding: '18px', borderRadius: 14,
                background: C.green, color: '#fff',
                fontSize: 18, fontWeight: 900, border: 'none',
                boxShadow: '0 4px 24px rgba(34,197,94,.4)',
                marginBottom: 10, letterSpacing: '.3px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              ✓ Já tomei
            </button>

            <button
              onClick={() => { onSnooze(dose); onClose(); }}
              style={{
                width: '100%', padding: '14px', borderRadius: 13,
                background: T.bg3, color: T.sub,
                fontSize: 15, fontWeight: 600,
                border: `1px solid ${T.bdr}`, marginBottom: 8,
              }}
            >
              ⏰ Lembrar em 15 minutos
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                background: 'none', color: T.muted, fontSize: 13, border: 'none',
              }}
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
