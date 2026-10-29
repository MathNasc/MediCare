export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '820px', width: '100%', backgroundColor: '#131d31', borderRadius: '1.25rem', border: '1px solid #1e293b', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
        
        {/* Header Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.8125rem', color: '#60a5fa', marginBottom: '1.25rem', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
          Monorepo MediCare • Android & Cuidador Web
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff', marginBottom: '0.75rem' }}>
          Portal MediCare
        </h1>

        <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
          Ecossistema integrado de saúde para controle rigoroso de posologia, supervisão por cuidadores e persistência sincronizada no PostgreSQL na Oracle Cloud.
        </p>

        {/* Action Cards (Android APK + Cuidador Web) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          
          {/* Card 1: Cuidador Web */}
          <div style={{ backgroundColor: '#18243c', borderRadius: '1rem', border: '1px solid #2b3956', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'inline-flex', padding: '0.25rem 0.65rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                PWA RESPONSIVA • NOVO
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
                MediCare Cuidador Web
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Acompanhamento em tempo real, visualização de administrações, agenda e confirmação de doses retroativas.
              </p>
            </div>

            <a
              href="/cuidador"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '0.75rem',
                boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.4)',
                textAlign: 'center',
              }}
            >
              💻 Abrir MediCare Cuidador →
            </a>
          </div>

          {/* Card 2: Paciente Android APK */}
          <div style={{ backgroundColor: '#18243c', borderRadius: '1rem', border: '1px solid #2b3956', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'inline-flex', padding: '0.25rem 0.65rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                APLICATIVO ANDROID NATIVO
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
                MediCare Paciente (APK)
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Instalador nativo assinado (v2/v3) com notificações exatas AlarmManager e sincronização offline.
              </p>
            </div>

            <a
              href="/api/apk"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '0.75rem',
                boxShadow: '0 8px 16px -4px rgba(5, 150, 105, 0.4)',
                textAlign: 'center',
              }}
            >
              📥 Baixar APK Atualizado
            </a>
          </div>

        </div>

        {/* System Architecture Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Mobile
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#38bdf8' }}>
              Android Nativo (Kotlin)
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              AlarmManager, persistência local e interface otimizada para pacientes.
            </p>
          </div>

          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Web & PWA
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#a78bfa' }}>
              Cuidador Web (React)
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Acompanhamento de múltiplos pacientes, relatórios e auditoria.
            </p>
          </div>

          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Backend & BD
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#34d399' }}>
              Oracle Cloud (PostgreSQL 16)
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              APIs REST, procedimentos RPC e trilha de auditoria clínica.
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: '#64748b' }}>
          <span>MediCare Ecosystem • Etapa 2 Fundação Ativa</span>
          <span>Build: <code>MediCare-Paciente.apk</code></span>
        </div>

      </div>
    </main>
  );
}
