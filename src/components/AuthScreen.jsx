'use client';
import { useState } from 'react';
import { AuthDB } from '@/lib/db';
import { ROLES } from '@/lib/permissions';

// ─── Seletor de papel (RBAC) exibido apenas no cadastro ───────────────────────
function RoleSelector({ value, onChange, T }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      <p style={{ color: T.sub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 2 }}>
        Como você vai usar o MediCare?
      </p>
      {Object.values(ROLES).map((r) => (
        <button
          key={r.code}
          type="button"
          onClick={() => onChange(r.code)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 12, textAlign: 'left',
            border: `2px solid ${value === r.code ? r.color : T.inpB}`,
            background: value === r.code ? `${r.color}12` : T.inp,
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: value === r.code ? r.color : T.txt, fontWeight: 700, fontSize: 14 }}>{r.label}</p>
            <p style={{ color: T.muted, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{r.description}</p>
          </div>
          {value === r.code && <span style={{ color: r.color, fontSize: 16, flexShrink: 0 }}>✓</span>}
        </button>
      ))}
    </div>
  );
}

export function AuthScreen({ onLogin, T }) {
  const [mode, setMode]   = useState('login');
  const [nome, setNome]   = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [role, setRole]   = useState('independente');
  const [err, setErr]     = useState('');
  const [load, setLoad]   = useState(false);

  const submit = async () => {
    setErr('');
    setLoad(true);

    // Pequeno delay apenas para manter a transição visual do "Aguarde...",
    // sem bloquear a Promise real de autenticação.
    await new Promise((r) => setTimeout(r, 200));

    try {
      if (mode === 'login') {
        const r = await AuthDB.login(email, pass);
        if (r.error) {
          setErr(r.error);
          setLoad(false);
          return;
        }
        onLogin(r.user);
      } else {
        if (!nome.trim()) {
          setErr('Informe seu nome');
          setLoad(false);
          return;
        }
        const r = await AuthDB.register(nome, email, pass, role);
        if (r.error) {
          setErr(r.error);
          setLoad(false);
          return;
        }
        onLogin(r.user);
      }
    } catch (e) {
      setErr('Erro ao autenticar. Tente novamente.');
      setLoad(false);
    }
    // Nota: não chamamos setLoad(false) no caminho de sucesso de propósito —
    // a troca de tela (onLogin) já desmonta este componente.
  };

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`,
    borderRadius: 12, padding: '15px 18px',
    color: T.txt, fontSize: 16, width: '100%',
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="anim-scaleIn" style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(59,130,246,.4)',
          }}>💊</div>
          <h1 style={{ color: T.txt, fontSize: 30, fontWeight: 900, letterSpacing: '-1px' }}>MediCare</h1>
          <p style={{ color: T.sub, fontSize: 15, marginTop: 6 }}>
            {mode === 'login' ? 'Bem-vindo de volta' : 'Cuide melhor da sua saúde'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 24, padding: 28, boxShadow: T.shadow }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: T.bg3, borderRadius: 12, padding: 4, marginBottom: 22 }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(''); }}
                aria-pressed={mode === m}
                disabled={load}
                style={{
                  flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, border: 'none',
                  background: mode === m ? T.bg1 : 'none',
                  color: mode === m ? T.txt : T.sub,
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                  transition: 'all .2s',
                  opacity: load ? .6 : 1,
                }}
              >
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {mode === 'register' && (
              <input style={inp} placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} disabled={load} />
            )}
            <input type="email" style={inp} placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={load} />
            <input type="password" style={inp} placeholder="Senha" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !load && submit()} disabled={load} />
          </div>

          {/* Seletor de papel — apenas no cadastro */}
          {mode === 'register' && (
            <div style={{ marginTop: 16 }}>
              <RoleSelector value={role} onChange={setRole} T={T} />
              <p style={{ color: T.muted, fontSize: 10, lineHeight: 1.5, marginTop: -4, marginBottom: 4 }}>
                Você poderá alterar isso depois em Perfil → Tipo de Perfil.
              </p>
            </div>
          )}

          {err && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)' }}>
              <p style={{ color: '#f87171', fontSize: 13, fontWeight: 500 }}>{err}</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={load}
            style={{
              marginTop: 18, width: '100%', padding: '16px', borderRadius: 13,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: '#fff', fontSize: 16, fontWeight: 800, border: 'none',
              boxShadow: '0 4px 20px rgba(59,130,246,.4)',
              opacity: load ? .7 : 1, letterSpacing: '.3px',
              cursor: load ? 'not-allowed' : 'pointer',
            }}
          >
            {load ? 'Aguarde…' : mode === 'login' ? 'Entrar com segurança →' : 'Criar minha conta →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', color: T.muted, fontSize: 12, marginTop: 18 }}>
          🔒 Dados armazenados com segurança no dispositivo
        </p>
      </div>
    </div>
  );
}
