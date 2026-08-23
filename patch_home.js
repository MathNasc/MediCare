const fs = require('fs');
let code = fs.readFileSync('src/screens/HomeScreen.jsx', 'utf8');

// Remove theme toggle
const targetTheme = `<button
          onClick={toggle}
          aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          style={{ width: 44, height: 44, borderRadius: 13, background: T.bg1, border: \`1px solid \${T.bdr}\`, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {dark ? '☀️' : '🌙'}
        </button>`;
code = code.replace(targetTheme, "");

// Add onSnooze
code = code.replace("export function HomeScreen({ T, scale, onQuickConfirm, toggle, dark }) {", "export function HomeScreen({ T, scale, onQuickConfirm, onSnooze, toggle, dark }) {");
code = code.replace("<NextDoseHero dose={nextDose} onConfirm={onQuickConfirm} T={T} scale={scale} />", "<NextDoseHero dose={nextDose} onConfirm={onQuickConfirm} onSnooze={onSnooze} T={T} scale={scale} />");

fs.writeFileSync('src/screens/HomeScreen.jsx', code);
