const fs = require('fs');
let code = fs.readFileSync('src/components/MainApp.jsx', 'utf8');

// Replace the block where !user renders the CaregiverInviteModal
const oldAuthBlock = `  if (!user) {
    return (
      <>
        <AuthScreen onLogin={login} T={T} />
        {invite.status && (
          <CaregiverInviteModal
            status={invite.status}
            invite={invite.invite}
            onAccept={invite.accept}
            onDismiss={invite.dismiss}
            T={T}
          />
        )}
      </>
    );
  }`;

const newAuthBlock = `  if (!user) {
    return (
      <>
        {invite.status && (
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', padding: '16px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span>🤝</span> Você tem um convite de cuidador. Faça login ou crie uma conta para aceitá-lo.
          </div>
        )}
        <AuthScreen onLogin={login} T={T} />
      </>
    );
  }`;

if (code.includes("if (!user) {")) {
  code = code.replace(oldAuthBlock, newAuthBlock);
  fs.writeFileSync('src/components/MainApp.jsx', code);
  console.log("Patched successfully");
} else {
  console.log("Could not find auth block");
}
