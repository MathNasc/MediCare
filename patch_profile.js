const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');

// Add dark, toggle to props
code = code.replace("export function ProfileScreen({ T, scale, setFs, fsSize }) {", "export function ProfileScreen({ T, scale, setFs, fsSize, dark, toggle }) {");

// Find Preferences section and insert Theme Toggle
const targetPref = `<div style={{ padding: '16px', borderBottom: \`1px solid \${T.bdr}\` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🔤</span>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Tamanho da fonte</p>
              </div>`;

const newPref = `<div style={{ padding: '16px', borderBottom: \`1px solid \${T.bdr}\`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{dark ? '🌙' : '☀️'}</span>
                <div>
                  <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Tema {dark ? 'Escuro' : 'Claro'}</p>
                  <p style={{ color: T.muted, fontSize: 13 * scale }}>Toque para alternar o modo visual</p>
                </div>
              </div>
              <button onClick={toggle} style={{ background: T.bg2, border: \`1px solid \${T.bdr}\`, borderRadius: 12, padding: '10px 14px', color: T.txt, fontWeight: 700, fontSize: 13 * scale }}>
                Alternar
              </button>
            </div>
            <div style={{ padding: '16px', borderBottom: \`1px solid \${T.bdr}\` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🔤</span>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Tamanho da fonte</p>
              </div>`;

code = code.replace(targetPref, newPref);

fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
