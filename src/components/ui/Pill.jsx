export function Pill({ children, color, bg, size = 'sm' }) {
  const s = size === 'sm'
    ? { fontSize: 11, padding: '2px 10px' }
    : { fontSize: 13, padding: '4px 14px' };
  return (
    <span style={{
      ...s, fontWeight: 700, borderRadius: 99,
      background: bg, color,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {children}
    </span>
  );
}
