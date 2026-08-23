const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

// Remove import
code = code.replace("import { createPortal } from 'react-dom';\n", "");

// Replace createPortal calls
code = code.replace(/return createPortal\(/g, "return (");
code = code.replace(/<\/div>,\n\s*document\.getElementById\('root'\) \|\| document\.body\n\s*\);/g, "</div>\n  );");
// also match the ones without newlines
code = code.replace(/<\/div>,\s*document\.getElementById\('root'\) \|\| document\.body\s*\);/g, "</div>);");

// Just in case it's slightly different
const lines = code.split('\n');
let newLines = [];
let skipNext = false;
for (let i = 0; i < lines.length; i++) {
  if (skipNext && lines[i].includes("document.getElementById('root') || document.body")) {
    skipNext = false;
    continue;
  }
  if (lines[i].includes("    document.getElementById('root') || document.body")) {
    continue;
  }
  if (lines[i].trim() === "  );") {
    // Keep it
  }
  newLines.push(lines[i]);
}
code = newLines.join('\n');

fs.writeFileSync('src/screens/CalendarScreen.jsx', code);
