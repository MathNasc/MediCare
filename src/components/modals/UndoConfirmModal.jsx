export function UndoConfirmModal({ dose, onConfirm, onCancel, T, scale = 1 }) {
  if (!dose) return null;

  return (
    <div
      onClick={onCancel}
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)',
        backdropFilter: 'blur(14px)', zIndex: 300,
        /* flex-end */
        justifyContent: 'center', padding: 16,
      }}
    >
      <div
        className="anim-scaleIn"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg1, border: `1px solid ${T.bdr}`,
          borderRadius: 28, width: '100%', maxWidth: 480,
          padding: 28, paddingBottom: 36, textAlign: 'center'
        }}
      >
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'rgba(239,68,68,.15)',
          color: '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 16px',
        }}>
          ↩️
        </div>
        
        <h3 style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 900, marginBottom: 8 }}>
          Desfazer Confirmação
        </h3>
        
        <p style={{ color: T.sub, fontSize: 15 * scale, lineHeight: 1.5, marginBottom: 24 }}>
          Você marcou <strong>{dose.nome}</strong> ({dose.hora}) como tomado.<br/><br/>
          Deseja desfazer essa ação? Isso removerá o registro do histórico e devolverá o medicamento ao estoque.
        </p>

        <button
          onClick={onConfirm}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: '#ef4444', color: '#fff',
            fontSize: 16 * scale, fontWeight: 900, border: 'none',
            marginBottom: 10,
          }}
        >
          Desfazer agora
        </button>

        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '14px', borderRadius: 13,
            background: T.bg3, color: T.sub,
            fontSize: 15 * scale, fontWeight: 600, border: 'none',
          }}
        >
          Manter como tomado
        </button>
      </div>
    </div>
  );
}
