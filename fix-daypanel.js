const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

const target = `<div onClick={onClose} className="bottom-sheet-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(14px)', zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp bottom-sheet-content" style={{ background: T.bg1, overflowY: 'auto', paddingBottom: 32 }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: \`1px solid \${T.bdr}\`, position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>{isFuture ? 'Programado' : 'Histórico'}</p>
              <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 900, textTransform: 'capitalize' }}>{label}</h3>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {filters.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: 'none', background: filter === f.id ? '#3b82f6' : T.bg3, color: filter === f.id ? '#fff' : T.sub, fontWeight: 700, fontSize: 11 * scale }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 16 }}>`;

const replacement = `<div className="anim-fadeUp" style={{ position: 'fixed', inset: 0, background: T.bg1, zIndex: 300, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px', borderBottom: \`1px solid \${T.bdr}\`, position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
        <div className="main-container" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>{isFuture ? 'Programado' : 'Histórico'}</p>
              <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 900, textTransform: 'capitalize' }}>{label}</h3>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {filters.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: 'none', background: filter === f.id ? '#3b82f6' : T.bg3, color: filter === f.id ? '#fff' : T.sub, fontWeight: 700, fontSize: 11 * scale }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="main-container" style={{ padding: '16px 16px 96px' }}>`;

if (code.includes('className="bottom-sheet-overlay"')) {
  // Let's use a regex just in case spaces don't match perfectly.
  const regex = /<div onClick=\{onClose\} className="bottom-sheet-overlay"[\s\S]*?<div style=\{\{ padding: 16 \}\}>/;
  code = code.replace(regex, replacement);
  
  // also need to replace the closing tags of the bottom sheet overlay
  const endingRegex = /<\/div>\s*<\/div>\s*<\/div>\s*\);/g;
  code = code.replace(endingRegex, '</div>\n    </div>\n  );');
  
  fs.writeFileSync('src/screens/CalendarScreen.jsx', code);
  console.log("Updated CalendarScreen DayPanel to fullscreen");
} else {
  console.log("Pattern not found");
}
