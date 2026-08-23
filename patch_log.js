const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

const target = `  const handleDoseAction = useCallback((dose, type) => {
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

const replacement = `  const handleDoseAction = useCallback((dose, type) => {
    console.log("handleDoseAction called!", { dose, type });
    const [h, m] = dose.hora.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(h, m, 0, 0);
    const diffMin = Math.round((scheduledTime - new Date()) / 60000);
    
    console.log("diffMin", diffMin);

    if (Math.abs(diffMin) > 60) {
      console.log("Setting time warning modal...");
      setTimeWarning({ dose, type, diffMin });
    } else {
      console.log("Action direct:", type);
      if (type === 'confirm') handleConfirmDose(dose);
      if (type === 'snooze') handleSnooze(dose);
    }
  }, [handleConfirmDose, handleSnooze]);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MainApp.jsx', code);
