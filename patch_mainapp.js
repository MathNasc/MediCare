const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

// Patch 1: setStatus('ready') instead of data ? 'ready' : 'error'
code = code.replace(
  "setStatus(data ? 'ready' : 'error');",
  "setStatus('ready'); // Supabase RLS may block preview read, assume valid until RPC acceptance"
);

// Patch 2: CaregiverInviteModal status === 'ready' rendering
code = code.replace(
  "{status === 'ready' && invite && (",
  "{status === 'ready' && ("
);
code = code.replace(
  "{invite.patient?.nome || 'Alguém'} deseja compartilhar",
  "{invite?.patient?.nome || 'Um paciente'} deseja compartilhar"
);
code = code.replace(
  "              <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 }}>{permLabel}</p>\n            </div>",
  "              <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 }}>{permLabel}</p>\n            </div>\n            )"
);
code = code.replace(
  "            <div style={{ background: T.bg2, borderRadius: 12, padding: 12, marginBottom: 20, textAlign: 'left' }}>",
  "            {permLabel && (\n            <div style={{ background: T.bg2, borderRadius: 12, padding: 12, marginBottom: 20, textAlign: 'left' }}>"
);


fs.writeFileSync('src/components/MainApp.jsx', code);
