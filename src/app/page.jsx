export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '780px', width: '100%', backgroundColor: '#131d31', borderRadius: '1.25rem', border: '1px solid #1e293b', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
        
        {/* Header Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.8125rem', color: '#60a5fa', marginBottom: '1.25rem', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
          Backend API & APK Distribution v2.0
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff', marginBottom: '0.75rem' }}>
          MediCare Paciente Android
        </h1>

        <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
          Ambiente central de serviços de saúde, sincronização em tempo real e distribuição do aplicativo nativo 
          para pacientes com suporte a notificações via AlarmManager e persistência PostgreSQL na Oracle Cloud.
        </p>

        {/* Download Card */}
        <div style={{ backgroundColor: '#1c2841', borderRadius: '1rem', border: '1px solid #2d3f63', padding: '1.75rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
              Baixar MediCare Paciente (APK)
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Instalador oficial compilado, validado e assinado (v1, v2, v3) pronto para Android.
            </p>
          </div>

          <a
            href="/api/apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.95rem',
              padding: '0.85rem 1.65rem',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
              transition: 'background-color 0.2s',
            }}
          >
            📥 Baixar APK Atualizado
          </a>
        </div>

        {/* System Architecture Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Aplicação Ativa
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#38bdf8' }}>
              Android Nativo (Kotlin / Java)
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              AlarmManager, persistência local e interface otimizada para pacientes.
            </p>
          </div>

          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Banco de Dados
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#a78bfa' }}>
              PostgreSQL Standalone
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Deploy isolado na Oracle Cloud com auditoria completa e criptografia.
            </p>
          </div>

          <div style={{ backgroundColor: '#18243c', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
              Backend & APIs
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#34d399' }}>
              Next.js API Engine
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Rotas REST em <code>/api/v1</code>, autenticação segura e IA Gemini.
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: '#64748b' }}>
          <span>MediCare Ecosystem — Diretriz Permanente Ativa</span>
          <span>Build: <code>MediCare-Paciente.apk</code></span>
        </div>

      </div>
    </main>
  );
}
