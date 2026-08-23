const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

const target = `  const handleSnooze = useCallback((dose) => {
    toast(\`⏰ Lembrete de \${dose.nome} em 15 minutos\`, 'info');
  }, [toast]);`;

const replacement = `  const handleSnooze = useCallback((dose) => {
    toast(\`⏰ Lembrete de \${dose.nome} em 15 minutos\`, 'info');
  }, [toast]);

  const handleDoseAction = useCallback((dose, type) => {
    const [h, m] = dose.hora.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(h, m, 0, 0);
    const diffMin = Math.round((scheduledTime - new Date()) / 60000);

    if (Math.abs(diffMin) > 60) {
      setTimeWarning({ dose, type, diffMin });
    } else {
      if (type === 'confirm') handleConfirmDose(dose);
      if (type === 'snooze') handleSnooze(dose);
    }
  }, [handleConfirmDose, handleSnooze]);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MainApp.jsx', code);
