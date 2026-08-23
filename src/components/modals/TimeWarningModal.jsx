import { C } from '@/lib/theme';

export function TimeWarningModal({ dose, type, diffMin, onConfirm, onClose, T, scale = 1 }) {
  const isEarly = diffMin > 0;
  const hours = Math.floor(Math.abs(diffMin) / 60);
  const mins = Math.abs(diffMin) % 60;
  
  const timeStr = [
    hours > 0 ? `${hours} hora${hours > 1 ? 's' : ''}` : '',
    mins > 0 ? `${mins} minuto${mins > 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(' e ');

  const title = isEarly ? 'Aviso de Adiantamento' : 'Aviso de Atraso';
  const desc = isEarly
    ? `Ainda faltam ${timeStr} para o horário programado de ${dose.nome} (${dose.hora}).`
    : `O horário de ${dose.nome} (${dose.hora}) passou há ${timeStr}.`;

  const confirmText = type === 'confirm' ? '✓ Sim, já tomei' : '⏰ Sim, adiar';

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true"
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
          padding: 28, paddingBottom: 36, textAlign: 'center'
        }}
      >
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: isEarly ? 'rgba(59,130,246,.15)' : 'rgba(245,158,11,.15)',
          color: isEarly ? '#3b82f6' : '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 16px',
        }}>
          {isEarly ? '⏱' : '⏰'}
        </div>
        
        <h3 style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 900, marginBottom: 8 }}>
          {title}
        </h3>
        
        <p style={{ color: T.sub, fontSize: 15 * scale, lineHeight: 1.5, marginBottom: 24 }}>
          {desc}<br/>
          Tem certeza que deseja {type === 'confirm' ? 'confirmar a dose' : 'adiar'} agora?
        </p>

        <button
          onClick={onConfirm}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: type === 'confirm' ? C.green : '#3b82f6', color: '#fff',
            fontSize: 16 * scale, fontWeight: 900, border: 'none',
            marginBottom: 10,
          }}
        >
          {confirmText}
        </button>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 13,
            background: T.bg3, color: T.sub,
            fontSize: 15 * scale, fontWeight: 600, border: 'none',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
