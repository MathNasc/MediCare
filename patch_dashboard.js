const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

const targetBtn = `{dose.status !== 'confirmed' ? (
        <button
          onClick={() => onConfirm(dose)}
          aria-label={\`Confirmar dose de \${dose.nome}\`}
          style={{
            width: '100%', padding: '15px', borderRadius: 13, background: C.green,
            color: '#fff', fontSize: 16 * scale, fontWeight: 900, border: 'none',
            boxShadow: '0 4px 20px rgba(34,197,94,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >✓ Tomei agora</button>
      ) : (`;

const replaceBtn = `{dose.status !== 'confirmed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => onConfirm(dose)}
            style={{ width: '100%', padding: '15px', borderRadius: 13, background: C.green, color: '#fff', fontSize: 16 * scale, fontWeight: 900, border: 'none', boxShadow: '0 4px 20px rgba(34,197,94,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >✓ Já tomei</button>
          <button
            onClick={() => onSnooze(dose)}
            style={{ width: '100%', padding: '13px', borderRadius: 13, background: T.bg3, color: T.sub, fontSize: 14 * scale, fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >⏰ Lembrar em 15 minutos</button>
        </div>
      ) : (`;

code = code.replace("export function NextDoseHero({ dose, onConfirm, T, scale = 1 }) {", "export function NextDoseHero({ dose, onConfirm, onSnooze, T, scale = 1 }) {");
code = code.replace(targetBtn, replaceBtn);

fs.writeFileSync('src/components/Dashboard.jsx', code);
