const fs = require('fs');
let code = fs.readFileSync('src/app/layout.jsx', 'utf8');

code = code.replace(/capable: true,/g, 'capable: false,');
fs.writeFileSync('src/app/layout.jsx', code);
