const fs = require('fs');
let code = fs.readFileSync('src/components/modals/TimeWarningModal.jsx', 'utf8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/modals/TimeWarningModal.jsx', code);
