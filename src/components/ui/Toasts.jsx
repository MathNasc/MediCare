export function Toasts({ list }) {
  const icon  = { ok: '✓', warn: '⚠', err: '✕', info: 'ℹ' };
  const color = { ok: '#22c55e', warn: '#f59e0b', err: '#ef4444', info: '#3b82f6' };
  return (
    <div style={{
      position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      width: 'calc(100% - 32px)', maxWidth: 440, pointerEvents: 'none',
    }}>
      {list.map((t) => (
        <div key={t.id} className="anim-slideDown" style={{
          background: '#1c2333', border: `1px solid ${color[t.type]}33`,
          borderRadius: 14, padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: color[t.type], flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>
            {icon[t.type]}
          </div>
          <p style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
            {t.msg}
          </p>
        </div>
      ))}
    </div>
  );
}
