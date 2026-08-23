const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

// Ensure createPortal is imported
if (!code.includes("import { createPortal } from 'react-dom';")) {
  code = code.replace(
    "import { useState, useEffect, useCallback } from 'react';",
    "import { useState, useEffect, useCallback } from 'react';\nimport { createPortal } from 'react-dom';"
  );
}

// NoteModal
code = code.replace(
  "  return (\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36 }}>",
  "  return createPortal(\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36 }}>"
);
code = code.replace(
  "      </div>\n    </div>\n  );\n}\n\nfunction EventModal",
  "      </div>\n    </div>,\n    document.getElementById('root') || document.body\n  );\n}\n\nfunction EventModal"
);

// EventModal
code = code.replace(
  "  return (\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36, maxHeight: '90vh', overflowY: 'auto' }}>",
  "  return createPortal(\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36, maxHeight: '90vh', overflowY: 'auto' }}>"
);
code = code.replace(
  "      </div>\n    </div>\n  );\n}\n\nfunction DayPanel",
  "      </div>\n    </div>,\n    document.getElementById('root') || document.body\n  );\n}\n\nfunction DayPanel"
);

// DayPanel
code = code.replace(
  "  return (\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(14px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>",
  "  return createPortal(\n    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(14px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>\n      <div onClick={e => e.stopPropagation()} className=\"anim-fadeUp\" style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>"
);
code = code.replace(
  "        </div>\n      </div>\n    </div>\n  );\n}\n\nexport function CalendarScreen",
  "        </div>\n      </div>\n    </div>,\n    document.getElementById('root') || document.body\n  );\n}\n\nexport function CalendarScreen"
);

fs.writeFileSync('src/screens/CalendarScreen.jsx', code);
