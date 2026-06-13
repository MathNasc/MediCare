'use client';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';

export function ProfileScreen({ T, scale, dark, toggle, fsSize, setFs }) {
  const { user, meds, history, logout } = useApp();

  const histConf = history.filter((h) => h.status === 'confirmed').length;
  const adhesion = history.length > 0 ? Math.round((histConf / history.length) * 100) : 0;
  const critical = meds.filter((m) => m.quantidade <= 5).length;

  return (
    <div className="anim-fadeUp">
      {/* Hero */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 24, textAlign: 'center', marginBottom: 14 }}>
        <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 12px', fontWeight: 900, color: '#fff', boxShadow: '0 8px 32px rgba(59,130,246,.4)' }}>
          {user?.nome?.[0]?.toUpperCase() || '👤'}
        </div>
        <p style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 800, marginBottom: 2 }}>{user?.nome}</p>
        <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 14 }}>{user?.email}</p>
        <span style={{ fontSize: 13 * scale, fontWeight: 700, padding: '6px 16px', borderRadius: 99, background: adhesion >= 80 ? C.greenBg : C.amberBg, color: adhesion >= 80 ? C.green : C.amber, border: `1px solid ${adhesion >= 80 ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}` }}>
          {adhesion}% de adesão ao tratamento
        </span>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { e: '💊', n: meds.length,   l: 'Meds'       },
          { e: '✓',  n: histConf,      l: 'Confirmadas' },
          { e: '📦', n: critical,      l: 'Críticos'    },
        ].map((s) => (
          <div key={s.l} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '14px 6px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, marginBottom: 4 }}>{s.e}</p>
            <p style={{ color: T.txt, fontSize: 19 * scale, fontWeight: 900 }}>{s.n}</p>
            <p style={{ color: T.muted, fontSize: 11 * scale }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Settings card */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, overflow: 'hidden', marginBottom: 14 }}>
        {/* Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: `1px solid ${T.bdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>{dark ? '🌙' : '☀️'}</span>
            <div>
              <p style={{ color: T.txt, fontWeight: 600, fontSize: 14 * scale }}>Tema</p>
              <p style={{ color: T.muted, fontSize: 12 * scale }}>{dark ? 'Modo escuro' : 'Modo claro'}</p>
            </div>
          </div>
          <button
            onClick={toggle}
            role="switch" aria-checked={dark}
            aria-label="Alternar tema"
            style={{ width: 52, height: 28, borderRadius: 99, background: dark ? '#3b82f6' : T.bg3, border: 'none', position: 'relative', transition: 'background .25s', flexShrink: 0 }}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: dark ? 27 : 3, transition: 'left .25s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
          </button>
        </div>

        {/* Font size */}
        <div style={{ padding: '15px 16px', borderBottom: `1px solid ${T.bdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>🔤</span>
            <p style={{ color: T.txt, fontWeight: 600, fontSize: 14 * scale }}>Tamanho da fonte</p>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[{ id: 'normal', l: 'Normal' }, { id: 'large', l: 'Grande' }, { id: 'xlarge', l: 'Maior' }].map((f) => (
              <button
                key={f.id}
                onClick={() => setFs(f.id)}
                aria-pressed={fsSize === f.id}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700, border: 'none', transition: 'all .15s', background: fsSize === f.id ? '#3b82f6' : T.bg2, color: fsSize === f.id ? '#fff' : T.sub, boxShadow: fsSize === f.id ? '0 2px 8px rgba(59,130,246,.4)' : 'none' }}
              >{f.l}</button>
            ))}
          </div>
        </div>

        {/* Accessibility info */}
        <div style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>♿</span>
          <div>
            <p style={{ color: T.txt, fontWeight: 600, fontSize: 14 * scale }}>Acessibilidade</p>
            <p style={{ color: T.muted, fontSize: 12 * scale }}>Botões 44px+ · Alto contraste · Leitor de tela</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: T.txt, fontWeight: 600, fontSize: 14 * scale }}>Notificações</p>
            <p style={{ color: T.muted, fontSize: 12 * scale }}>Lembretes automáticos de doses</p>
          </div>
          <button
            onClick={async () => {
              if (!('Notification' in window)) return alert('Notificações não suportadas neste navegador.');
              const r = await Notification.requestPermission();
              if (r === 'granted') alert('✓ Notificações ativadas!');
              else alert('Permissão negada. Ative nas configurações do navegador.');
            }}
            style={{ padding: '8px 14px', borderRadius: 10, background: C.blueBg, color: C.blue, fontWeight: 700, fontSize: 12 * scale, border: `1px solid ${C.blue}30` }}
          >
            Ativar
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontWeight: 700, fontSize: 15 * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        🚪 Sair da conta
      </button>

      <p style={{ textAlign: 'center', color: T.muted, fontSize: 11 * scale, marginTop: 16 }}>
        MediCare v2.0 · Seus dados são privados e seguros
      </p>
    </div>
  );
}
