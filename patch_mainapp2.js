const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

const target1 = `  const handleSnooze = useCallback((dose) => {
    toast(\`⏰ Lembrete de \${dose.nome} em 15 minutos\`, 'info');
    snoozeDose(dose);
  }, [snoozeDose, toast]);`;

const target2 = `{quickDose && <QuickConfirm dose={quickDose} onConfirm={handleConfirmDose} onSnooze={handleSnooze} onClose={() => setQuickDose(null)} T={T} />}`;

const replacement1 = `  const handleSnooze = useCallback((dose) => {
    toast(\`⏰ Lembrete de \${dose.nome} em 15 minutos\`, 'info');
    snoozeDose(dose);
  }, [snoozeDose, toast]);

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

const replacement2 = `{timeWarning && (
        <TimeWarningModal
          dose={timeWarning.dose}
          type={timeWarning.type}
          diffMin={timeWarning.diffMin}
          onConfirm={() => {
            if (timeWarning.type === 'confirm') handleConfirmDose(timeWarning.dose);
            if (timeWarning.type === 'snooze') handleSnooze(timeWarning.dose);
            setTimeWarning(null);
          }}
          onClose={() => setTimeWarning(null)}
          T={T}
          scale={scale}
        />
      )}`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
code = code.replace("onQuickConfirm={setQuickDose}", "onQuickConfirm={(dose) => handleDoseAction(dose, 'confirm')} onSnooze={(dose) => handleDoseAction(dose, 'snooze')}");

fs.writeFileSync('src/components/MainApp.jsx', code);
