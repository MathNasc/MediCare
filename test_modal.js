const fs = require('fs');
let code = fs.readFileSync('src/components/modals/MedModal.jsx', 'utf8');

if (!code.includes("if (!form.nome || !form.nome.trim())")) {
  console.log("Validation missing");
}
