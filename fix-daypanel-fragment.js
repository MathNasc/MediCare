const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

code = code.replace(/return \(\n\s*<div className="anim-fadeUp" style=\{\{ position: 'fixed', inset: 0, background: T\.bg1, zIndex: 300, overflowY: 'auto' \}\}>/g, 'return (\n    <>\n      <div className="anim-fadeUp" style={{ position: \'fixed\', inset: 0, background: T.bg1, zIndex: 300, overflowY: \'auto\' }}>');

code = code.replace(/      \{retroTarget && \(\n\s*<RetroactiveConfirmModal/g, '      </div>\n      {retroTarget && (\n        <RetroactiveConfirmModal');

code = code.replace(/          scale=\{scale\}\n\s*\/>\n\s*\)\}\n\s*<\/div>\n\s*\);\n\}/g, '          scale={scale}\n        />\n      )}\n    </>\n  );\n}');

fs.writeFileSync('src/screens/CalendarScreen.jsx', code);
console.log("Fixed JSX fragments");
