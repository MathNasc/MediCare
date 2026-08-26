const fs = require('fs');
let code = fs.readFileSync('src/screens/MedsScreen.jsx', 'utf8');

const cleanupFn = `
  const handleCleanup = async () => {
    if (!confirm('Deseja apagar os medicamentos duplicados de Sertralina?')) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.from('medicamentos').select('*').ilike('nome', 'Sertralina%');
      if (data && data.length > 1) {
        data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const toDelete = data.slice(1).map(x => x.id);
        await supabase.from('medicamentos').delete().in('id', toDelete);
        toast('Duplicatas apagadas, atualize a página!');
      } else {
        toast('Nenhuma duplicata encontrada');
      }
    } catch(e) {
      toast('Erro: ' + e.message, 'err');
    }
  };
`;

code = code.replace(
  "const handleConfirmDelete = async () => {",
  cleanupFn + "\n  const handleConfirmDelete = async () => {"
);

const btn = `
        <button onClick={handleCleanup} style={{ padding: '8px 12px', background: 'red', color: 'white', borderRadius: 8, border: 'none', fontSize: 12 }}>Limpar Duplicatas</button>
`;

code = code.replace(
  "<h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Meus medicamentos</h2>",
  "<h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Meus medicamentos</h2>\n" + btn
);

fs.writeFileSync('src/screens/MedsScreen.jsx', code);
