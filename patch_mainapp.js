const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

// Replace QuickConfirm import
code = code.replace("import { QuickConfirm   } from '@/components/modals/QuickConfirm';", "import { TimeWarningModal } from '@/components/modals/TimeWarningModal';");

// Remove quickDose state and add timeWarning
code = code.replace("const [quickDose, setQuickDose] = useState(null);", "const [timeWarning, setTimeWarning] = useState(null);");

// Update deep link use
code = code.replace("if (dose && dose.status !== 'confirmed') setQuickDose(dose);", "if (dose && dose.status !== 'confirmed') handleDoseAction(dose, action === 'snooze' ? 'snooze' : 'confirm');");

// Update backbutton
code = code.replace("useBackButton(quickDose !== null, () => setQuickDose(null));", "useBackButton(timeWarning !== null, () => setTimeWarning(null));");

fs.writeFileSync('src/components/MainApp.jsx', code);
