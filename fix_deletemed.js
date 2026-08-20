const fs = require('fs');
let code = fs.readFileSync('src/screens/MedsScreen.jsx', 'utf8');

code = code.replace(/const handleConfirmDelete = async \(\) => \{[\s\S]*?if \(toast\) toast\(\`🗑 \$\{nome\} excluído\`, 'info'\);\s*\};/,
`const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const nome = deleteTarget.nome;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteMed(id);
      if (toast) toast(\`🗑 \${nome} excluído\`, 'info');
    } catch (err) {
      if (toast) toast(err.message || 'Erro ao excluir medicamento', 'err');
    }
  };`);

fs.writeFileSync('src/screens/MedsScreen.jsx', code);
