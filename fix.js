const fs = require('fs');
let code = fs.readFileSync('src/screens/ProfileScreen.jsx', 'utf8');
code = code.replace(/document.body\n  \);\nimport/, "document.body\n  );\n}\n\nimport");
fs.writeFileSync('src/screens/ProfileScreen.jsx', code);
