const fs = require('fs');
let code = fs.readFileSync('src/components/modals/MedModal.jsx', 'utf8');

code = code.replace(
  "disabled={saving || !form.nome.trim()}",
  "disabled={saving}"
);

code = code.replace(
  "background: !form.nome.trim() ? T.bg3 : 'linear-gradient(135deg,#3b82f6,#6366f1)',",
  "background: 'linear-gradient(135deg,#3b82f6,#6366f1)',"
);

code = code.replace(
  "color: !form.nome.trim() ? T.muted : '#fff', fontWeight: 800, fontSize: 16 * scale, border: 'none',",
  "color: '#fff', fontWeight: 800, fontSize: 16 * scale, border: 'none',"
);

code = code.replace(
  "boxShadow: form.nome.trim() ? '0 4px 20px rgba(59,130,246,.35)' : 'none',",
  "boxShadow: '0 4px 20px rgba(59,130,246,.35)',"
);

code = code.replace(
  "letterSpacing: '.3px', cursor: form.nome.trim() ? 'pointer' : 'not-allowed',",
  "letterSpacing: '.3px', cursor: 'pointer',"
);

// Safety for handleSave
code = code.replace(
  "if (!form.nome.trim()) { if (toast) toast('Informe o nome do medicamento', 'err'); return; }",
  "if (!form.nome || !form.nome.trim()) { if (toast) toast('Informe o nome do medicamento', 'err'); return; }"
);

fs.writeFileSync('src/components/modals/MedModal.jsx', code);
