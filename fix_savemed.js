const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

code = code.replace(/const handleSaveMed = useCallback\(\(form, horarios, dias\) => \{[\s\S]*?\}, \[saveMed, editMed, toast\]\);/,
`const handleSaveMed = useCallback(async (form, horarios, dias) => {
    if (!form.nome.trim()) { toast('Informe o nome do medicamento', 'err'); return; }
    try {
      await saveMed(form, horarios, dias, editMed?.id);
      toast(editMed ? \`✓ \${form.nome} atualizado!\` : \`✓ \${form.nome} adicionado!\`);
      setShowAdd(false);
      setEditMed(null);
    } catch (err) {
      toast(err.message || 'Não foi possível salvar o medicamento. Tente novamente.', 'err');
    }
  }, [saveMed, editMed, toast]);`);

fs.writeFileSync('src/components/MainApp.jsx', code);
