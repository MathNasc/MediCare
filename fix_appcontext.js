const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.jsx', 'utf8');

code = code.replace(/toastFn\('Erro ao confirmar dose', 'err'\)/, "toastFn(err.message || 'Erro ao confirmar dose', 'err')");
code = code.replace(/toastFn\('Erro ao confirmar retroativamente', 'err'\)/, "toastFn(err.message || 'Erro ao confirmar retroativamente', 'err')");
code = code.replace(/toastFn\('Erro ao registrar uso', 'err'\)/, "toastFn(err.message || 'Erro ao registrar uso', 'err')");
code = code.replace(/toastFn\('Erro ao registrar', 'err'\)/g, "toastFn(err.message || 'Erro ao registrar', 'err')");

fs.writeFileSync('src/context/AppContext.jsx', code);
