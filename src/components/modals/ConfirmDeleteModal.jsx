'use client';
import { C } from '@/lib/theme';

export function ConfirmDeleteModal({ medName, onConfirm, onCancel, T, scale = 1 }) {
  return (
    <div
      onClick={onCancel}
      role="dialog" aria-modal="true" aria-label="Confirmar exclusão"
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
          borderRadius: 24, width: '100%', maxWidth: 420,
          padding: 24, paddingBottom: 28,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(239,68,68,.12)', border: '2px solid rgba(239,68,68,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 14px',
          }}>🗑</div>
          <p style={{ color: T.txt, fontSize: 19 * scale, fontWeight: 900, marginBottom: 8 }}>
            Excluir medicamento
          </p>
          <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.6 }}>
            Tem certeza que deseja excluir <strong style={{ color: T.txt }}>{medName}</strong>?
            <br />Esta ação não poderá ser desfeita.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            autoFocus
            style={{
              flex: 1, padding: '15px', borderRadius: 13,
              background: T.bg3, color: T.txt,
              fontSize: 15 * scale, fontWeight: 700, border: `1px solid ${T.bdr}`,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '15px', borderRadius: 13,
              background: C.red, color: '#fff',
              fontSize: 15 * scale, fontWeight: 800, border: 'none',
              boxShadow: '0 4px 20px rgba(239,68,68,.35)',
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
