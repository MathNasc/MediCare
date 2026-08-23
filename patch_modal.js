const fs = require('fs');
let code = fs.readFileSync('src/components/modals/TimeWarningModal.jsx', 'utf8');

const target = `import { createPortal } from 'react-dom';
import { C } from '@/lib/theme';

export function TimeWarningModal({ dose, type, diffMin, onConfirm, onClose, T, scale = 1 }) {
  const isEarly = diffMin > 0;
  const hours = Math.floor(Math.abs(diffMin) / 60);
  const mins = Math.abs(diffMin) % 60;
  
  const timeStr = [
    hours > 0 ? \`\${hours} hora\${hours > 1 ? 's' : ''}\` : '',
    mins > 0 ? \`\${mins} minuto\${mins > 1 ? 's' : ''}\` : ''
  ].filter(Boolean).join(' e ');

  const title = isEarly ? 'Aviso de Adiantamento' : 'Aviso de Atraso';
  const desc = isEarly
    ? \`Ainda faltam \${timeStr} para o horário programado de \${dose.nome} (\${dose.hora}).\`
    : \`O horário de \${dose.nome} (\${dose.hora}) passou há \${timeStr}.\`;

  const confirmText = type === 'confirm' ? '✓ Sim, já tomei' : '⏰ Sim, adiar';

  return createPortal(`;

const replacement = `import { C } from '@/lib/theme';

export function TimeWarningModal({ dose, type, diffMin, onConfirm, onClose, T, scale = 1 }) {
  const isEarly = diffMin > 0;
  const hours = Math.floor(Math.abs(diffMin) / 60);
  const mins = Math.abs(diffMin) % 60;
  
  const timeStr = [
    hours > 0 ? \`\${hours} hora\${hours > 1 ? 's' : ''}\` : '',
    mins > 0 ? \`\${mins} minuto\${mins > 1 ? 's' : ''}\` : ''
  ].filter(Boolean).join(' e ');

  const title = isEarly ? 'Aviso de Adiantamento' : 'Aviso de Atraso';
  const desc = isEarly
    ? \`Ainda faltam \${timeStr} para o horário programado de \${dose.nome} (\${dose.hora}).\`
    : \`O horário de \${dose.nome} (\${dose.hora}) passou há \${timeStr}.\`;

  const confirmText = type === 'confirm' ? '✓ Sim, já tomei' : '⏰ Sim, adiar';

  return (`;

code = code.replace(target, replacement);

const target2 = `    </div>,
    document.getElementById('root') || document.body
  );
}`;
const replacement2 = `    </div>
  );
}`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/modals/TimeWarningModal.jsx', code);
