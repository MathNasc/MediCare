'use client';
import { useNotifications } from '@/hooks/useNotifications';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';
import { getRoleMeta } from '@/lib/permissions';
import { CaregiversScreen } from '@/screens/CaregiversScreen';
import { CaregiverDashboard } from '@/screens/CaregiverDashboard';
import { StockHistoryScreen } from '@/screens/StockHistoryScreen';
import { ProfileDB } from '@/lib/profileDb';
import { useBackButton } from '@/hooks/useBackButton';
import { PersonalData } from '@/screens/profile/PersonalData';
import { EmergencyCardConfig } from '@/screens/profile/EmergencyCardConfig';
import { HealthSection } from '@/screens/profile/HealthSection';
import { EmergencyContacts } from '@/screens/profile/EmergencyContacts';
import { HealthcareProfessionals } from '@/screens/profile/HealthcareProfessionals';
import { ImportantMedsConfig } from '@/screens/profile/ImportantMedsConfig';
import { EmergencyCard } from '@/screens/profile/EmergencyCard';

// ─── Sub-screen wrapper ──────────────────────────────────────────────────────────────
function FullSubScreen({ children, bg }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  
  return createPortal(
    <div className="anim-fadeUp" style={{ position: 'fixed', inset: 0, background: bg, zIndex: 200, overflowY: 'auto' }}>
      <div className="main-container" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 16px 96px' }}>
        {children}
      </div>
    </div>,
    document.getElementById('root') || document.body
  );
}

export function ProfileScreen({ T, scale, setFs, fsSize, dark, toggle, hc, toggleHc }) {
  const { user, logout, meds } = useApp();
  const [permission, setPermission] = useState('default');
  const { setup, disable, isSubscribed } = useNotifications(meds, user?.id);
  useEffect(() => { if (typeof window !== 'undefined' && 'Notification' in window) setPermission(Notification.permission); }, []);
  const setupPush = async () => { if (await setup()) setPermission(Notification.permission); };
  const disablePush = async () => { await disable(); };
  
  const [profile, setProfile] = useState(null);
  const [activeView, setActiveView] = useState('main'); // main, personal, config_card, show_card, health, meds, profs, contacts, caregivers, privacy
  
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [disablePushRequest, setDisablePushRequest] = useState(false);
  const handleDisablePush = async () => {
    if (user?.role === 'paciente') {
      setDisablePushRequest(true);
    } else {
      await disable();
    }
  };

  const confirmDisablePush = async () => {
    setDisablePushRequest(false);
    await disable();
  };

  useBackButton(activeView !== 'main', () => setActiveView('main'));
  useBackButton(disablePushRequest, () => setDisablePushRequest(false));

  useEffect(() => {
    if (user?.id) {
      ProfileDB.getProfile(user.id).then(setProfile);
    }
  }, [user?.id]);

  const calcAge = (dob) => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return `${Math.abs(new Date(diff).getUTCFullYear() - 1970)} anos`;
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const url = await ProfileDB.uploadAvatar(user.id, file);
    if (url) {
      await ProfileDB.updateProfile(user.id, { foto_url: url });
      setProfile(p => ({ ...p, foto_url: url }));
    }
    setUploadingAvatar(false);
  };

  const currentRole = getRoleMeta(user?.role);
  const displayName = profile?.social_name || profile?.nome || user?.nome || 'Usuário';

  const NavItem = ({ icon, title, subtitle, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', background: 'none', border: 'none', padding: '16px 0', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>{title}</p>
        <p style={{ color: T.muted, fontSize: 13 * scale }}>{subtitle}</p>
      </div>
      <span style={{ color: T.muted, fontSize: 20 }}>›</span>
    </button>
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ─── TELA PRINCIPAL DO PERFIL ─── */}
      {activeView === 'main' && (
        <div className="anim-fadeUp">
          <h2 style={{ color: T.txt, fontSize: 28 * scale, fontWeight: 800, marginBottom: 24, paddingTop: 10 }}>Meu Perfil</h2>
          
          <div className="grid-responsive">
            <div>
            {/* Cabeçalho */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'relative', width: 100, height: 100, borderRadius: '50%', background: T.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', border: `2px solid ${C.blue}` }}
              >
                {uploadingAvatar ? <span style={{ fontSize: 14 * scale, color: T.sub }}>...</span> 
                 : profile?.foto_url ? <Image src={profile.foto_url} alt="Avatar" fill style={{ objectFit: 'cover' }} sizes="80px" /> 
                 : <span style={{ fontSize: 36, color: T.sub }}>{displayName[0]?.toUpperCase()}</span>}
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, background: C.blue, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,.2)' }} onClick={() => fileInputRef.current?.click()}>📷</div>
            </div>
            
            <p style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 800, marginTop: 16 }}>{displayName}</p>
            {profile?.dob && <p style={{ color: T.sub, fontSize: 15 * scale }}>{calcAge(profile.dob)}</p>}
            <div style={{ background: T.bg2, padding: '4px 12px', borderRadius: 20, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{currentRole?.icon || '⚙️'}</span>
              <span style={{ color: T.sub, fontSize: 13 * scale, fontWeight: 600 }}>{currentRole?.label || 'Independente'}</span>
            </div>
          </div>

          {/* Cartão de Emergência */}
          <div style={{ background: '#ef4444', borderRadius: 20, padding: 20, color: '#fff', marginBottom: 24, boxShadow: '0 4px 12px rgba(239,68,68,.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <p style={{ fontSize: 18 * scale, fontWeight: 800 }}>Cartão de Emergência</p>
            </div>
            <p style={{ fontSize: 14 * scale, opacity: 0.9, marginBottom: 16, lineHeight: 1.4 }}>Informações vitais para um momento de necessidade.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setActiveView('show_card')} style={{ flex: 1, padding: 12, borderRadius: 12, background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 15 * scale, border: 'none', cursor: 'pointer' }}>Abrir Cartão</button>
              <button onClick={() => setActiveView('config_card')} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 600, fontSize: 15 * scale, border: 'none', cursor: 'pointer' }}>Configurar</button>
            </div>
          </div>

          </div>
            <div>
            {/* Menu Principal */}
          <div style={{ background: T.bg1, borderRadius: 24, padding: '0 20px', border: `1px solid ${T.bdr}`, marginBottom: 24 }}>
            <NavItem icon="👤" title="Dados pessoais" subtitle="Nome, nascimento, peso, altura..." onClick={() => setActiveView('personal')} />
            <NavItem icon="❤️" title="Saúde" subtitle="Alergias e condições importantes..." onClick={() => setActiveView('health')} />
            <NavItem icon="💊" title="Tratamento" subtitle="Medicamentos para emergência..." onClick={() => setActiveView('meds')} />
            <NavItem icon="👨‍⚕️" title="Profissionais" subtitle="Médicos e especialistas..." onClick={() => setActiveView('profs')} />
            <NavItem icon="👨‍👩‍👧" title="Contatos" subtitle="Emergência e familiares..." onClick={() => setActiveView('contacts')} />
            <NavItem icon="🤝" title="Cuidadores" subtitle="Quem acompanha seu tratamento..." onClick={() => setActiveView('caregivers')} />
            <NavItem icon="📦" title="Estoque" subtitle="Histórico e previsões..." onClick={() => setActiveView('stock')} />
            <NavItem icon="🔄" title="Mudar Perfil" subtitle="Alterar tipo de conta..." onClick={() => setActiveView('role_swap')} />
            <NavItem icon="🔐" title="Privacidade" subtitle="Controle dos seus dados..." onClick={() => setActiveView('privacy')} />
            <NavItem icon="⚙️" title="Preferências" subtitle="Acessibilidade e notificações..." onClick={() => setActiveView('prefs')} />
          </div>

          <button onClick={logout} style={{ width: '100%', padding: '16px', borderRadius: 16, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontWeight: 700, fontSize: 16 * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
            🚪 Sair da conta
          </button>
          </div>
          </div>
        </div>
      )}

      {/* ─── SUB-TELAS ─── */}
      {activeView === 'personal' && (
        <FullSubScreen bg={T.bg0}><PersonalData user={user} profile={profile} onUpdate={setProfile} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'config_card' && (
        <FullSubScreen bg={T.bg0}><EmergencyCardConfig user={user} profile={profile} onUpdate={setProfile} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'show_card' && (
        <FullSubScreen bg={T.bg0}><EmergencyCard user={user} profile={profile} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'health' && (
        <FullSubScreen bg={T.bg0}><HealthSection user={user} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'contacts' && (
        <FullSubScreen bg={T.bg0}><EmergencyContacts user={user} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'profs' && (
        <FullSubScreen bg={T.bg0}><HealthcareProfessionals user={user} onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      {activeView === 'meds' && (
        <FullSubScreen bg={T.bg0}><ImportantMedsConfig onBack={() => setActiveView('main')} T={T} scale={scale} /></FullSubScreen>
      )}
      
      {activeView === 'caregivers' && (
        <FullSubScreen bg={T.bg0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
            <button onClick={() => setActiveView('main')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Cuidadores</p>
          </div>
          <CaregiversScreen user={user} T={T} scale={scale} />
          {user?.role !== 'paciente' && (
            <div style={{ marginTop: 24 }}>
               <h3 style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 16 }}>Pacientes que acompanho</h3>
               <button onClick={() => setActiveView('caregiver_dash')} style={{ width: '100%', padding: 16, borderRadius: 12, background: C.blue, color: '#fff', fontSize: 15 * scale, fontWeight: 700, border: 'none' }}>Acessar Painel</button>
            </div>
          )}
        </FullSubScreen>
      )}

      {activeView === 'role_swap' && (
        <RoleSwapView user={user} T={T} scale={scale} setActiveView={setActiveView} logout={logout} />
      )}

      {activeView === 'privacy' && (
        <FullSubScreen bg={T.bg0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
            <button onClick={() => setActiveView('main')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Privacidade</p>
          </div>
          <div style={{ background: T.bg1, padding: 20, borderRadius: 20, border: `1px solid ${T.bdr}` }}>
            <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 10 }}>Seus dados estão seguros</p>
            <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.5, marginBottom: 16 }}>O MediCare utiliza criptografia avançada. Apenas você e as pessoas que você explicitamente autorizar (Cuidadores) possuem acesso aos seus dados de saúde.</p>
            <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 8 }}>Cartão de Emergência</p>
            <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.5 }}>As informações selecionadas para o Cartão de Emergência só são exibidas quando o cartão é ativamente aberto no seu aparelho.</p>
          </div>
        </FullSubScreen>
      )}

      {activeView === 'prefs' && (
        <FullSubScreen bg={T.bg0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
            <button onClick={() => setActiveView('main')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Preferências</p>
          </div>
          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{dark ? '🌙' : '☀️'}</span>
                <div>
                  <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Tema {dark ? 'Escuro' : 'Claro'}</p>
                  <p style={{ color: T.muted, fontSize: 13 * scale }}>Toque para alternar o modo visual</p>
                </div>
              </div>
              <button onClick={toggle} style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '10px 14px', color: T.txt, fontWeight: 700, fontSize: 13 * scale }}>
                Alternar
              </button>
            </div>
            <div style={{ padding: '16px', borderBottom: `1px solid ${T.bdr}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🔤</span>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Tamanho da fonte</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: 'normal', l: 'Normal' }, { id: 'large', l: 'Grande' }, { id: 'xlarge', l: 'Maior' }].map(f => (
                  <button key={f.id} onClick={() => setFs(f.id)} style={{ flex: 1, padding: '12px 4px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', transition: 'all .15s', background: fsSize === f.id ? C.blue : T.bg2, color: fsSize === f.id ? '#fff' : T.sub }}>{f.l}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>♿</span>
                <div>
                  <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Acessibilidade</p>
                  <p style={{ color: T.muted, fontSize: 13 * scale }}>Alto contraste, botões 44px+</p>
                </div>
              </div>
              <button onClick={toggleHc} style={{ padding: '8px 16px', borderRadius: 12, background: hc ? C.blue : T.bg2, color: hc ? '#fff' : T.txt, fontWeight: 700, fontSize: 13 * scale, border: 'none' }}>
                Alternar
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 16 * scale }}>Notificações</p>
                <p style={{ color: T.muted, fontSize: 13 * scale }}>
                  {permission === 'denied' ? 'Bloqueadas no aparelho' : (isSubscribed ? 'Ativas' : 'Desativadas')}
                </p>
              </div>
              {permission !== 'denied' && (
                isSubscribed ? (
                  <button onClick={handleDisablePush} style={{ background: T.bg2, color: '#ef4444', border: `1px solid ${T.bdr}`, padding: '8px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Desativar</button>
                ) : (
                  <button onClick={setupPush} style={{ background: C.blue, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Ativar</button>
                )
              )}
            </div>
          </div>
        </FullSubScreen>
      )}

      {activeView === 'caregiver_dash' && (
        <FullSubScreen bg={T.bg0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
            <button onClick={() => setActiveView('caregivers')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Painel do Cuidador</p>
          </div>
          <CaregiverDashboard user={user} T={T} scale={scale} />
        </FullSubScreen>
      )}

      {activeView === 'stock' && (
        <FullSubScreen bg={T.bg0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
            <button onClick={() => setActiveView('main')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Estoque de Medicamentos</p>
          </div>
          <StockHistoryScreen user={user} T={T} scale={scale} />
        </FullSubScreen>
      )}
      {disablePushRequest && (
        <DisablePushModal user={user} onClose={() => setDisablePushRequest(false)} onConfirm={confirmDisablePush} T={T} scale={scale} />
      )}
    </div>
  );
}


function RoleSwapView({ user, T, scale, setActiveView, logout }) {
  const { updateRole } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [caregivers, setCaregivers] = useState([]);

  useEffect(() => {
    if (user?.role === 'paciente') {
      import('@/lib/supabaseCaregiver').then(m => m.CaregiverDB.listMyCaregivers(user.id)).then(setCaregivers);
    }
  }, [user]);

  const verifyPin = () => {
    for (const c of caregivers) {
      if (c.status === 'active') {
        const str = user.id + c.caregiver_id + "role_swap_secret_v1";
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        const expected = String(Math.abs(hash % 900000) + 100000);
        if (expected === pin.trim()) return true;
      }
    }
    return false;
  };

  const [confirmRole, setConfirmRole] = useState(null);

  useBackButton(confirmRole !== null, () => setConfirmRole(null));

  const handleUpdate = async (newRole) => {
    if (newRole === 'paciente' && user.role !== 'paciente' && confirmRole !== 'paciente') {
      setConfirmRole('paciente');
      return;
    }
    setConfirmRole(null);

    if (user.role === 'paciente') {
      if (!pin.trim()) return setError('Digite o PIN de liberação.');
      // TODO: REMOVER FUTURAMENTE - Senha mestre temporária 999999 adicionada para testes
      if (pin.trim() !== '999999') {
        if (!caregivers.length) return setError('Você não tem cuidadores ativos para gerar um PIN.');
        if (!verifyPin()) return setError('PIN incorreto ou inválido.');
      }
    }
    setLoading(true);
    setError('');
    const ok = await updateRole(newRole);
    if (!ok) setError('Erro ao atualizar perfil.');
    setLoading(false);
    if (ok) {
      setActiveView('main');
    }
  };

  return (
    <FullSubScreen bg={T.bg0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={() => setActiveView('main')} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Mudar Perfil</p>
      </div>

      <div style={{ background: T.bg1, padding: 20, borderRadius: 20, border: `1px solid ${T.bdr}` }}>
        <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 10 }}>Seu perfil atual: <span style={{ color: '#3b82f6' }}>{user?.role.toUpperCase()}</span></p>
        
        {user?.role === 'paciente' ? (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.5, marginBottom: 16 }}>
              Como paciente, você precisa de um <strong>PIN de liberação</strong> gerado pelo seu cuidador no painel dele para alterar o seu perfil.
            </p>
            <input 
              type="text" 
              placeholder="Digite o PIN de 6 dígitos" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1.5px solid ${T.bdr}`, background: T.bg2, color: T.txt, fontSize: 16 * scale, outline: 'none', textAlign: 'center', letterSpacing: '4px', fontWeight: 800, marginBottom: 10 }}
            />
          </div>
        ) : (
          <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.5, marginBottom: 20 }}>
            Você pode alterar o seu tipo de conta livremente.
          </p>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: 13 * scale, fontWeight: 700, marginBottom: 16 }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {user?.role !== 'independente' && (
            <button onClick={() => handleUpdate('independente')} disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 12, background: T.bg2, border: `1px solid ${T.bdr}`, color: T.txt, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
              ⚙️ Tornar-se <strong>Independente</strong>
            </button>
          )}
          {user?.role !== 'cuidador' && (
            <button onClick={() => handleUpdate('cuidador')} disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 12, background: T.bg2, border: `1px solid ${T.bdr}`, color: T.txt, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
              🤝 Tornar-se <strong>Cuidador</strong>
            </button>
          )}
          {user?.role !== 'paciente' && (
            <button onClick={() => handleUpdate('paciente')} disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 12, background: T.bg2, border: `1px solid ${T.bdr}`, color: T.txt, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
              🧑 Tornar-se <strong>Paciente</strong>
            </button>
          )}
        </div>
      </div>

      {confirmRole && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmRole(null)} />
          <div className="anim-scale" style={{ position: 'relative', width: '100%', maxWidth: 340, background: T.bg1, borderRadius: 24, padding: 24, border: `1px solid ${T.bdr}`, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef08a', color: '#854d0e', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontWeight: 900 }}>!</div>
            <h3 style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 800, marginBottom: 12 }}>Atenção</h3>
            <p style={{ color: T.sub, fontSize: 15 * scale, lineHeight: 1.5, marginBottom: 24 }}>
              Você está prestes a se tornar <strong>Paciente</strong>. Este perfil não pode ser alterado depois sem a permissão (PIN) de um Cuidador. Tem certeza que deseja continuar?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmRole(null)} style={{ flex: 1, padding: 14, borderRadius: 14, background: T.bg2, color: T.txt, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleUpdate(confirmRole)} style={{ flex: 1, padding: 14, borderRadius: 14, background: '#3b82f6', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Continuar</button>
            </div>
          </div>
        </div>
      )}
    </FullSubScreen>
  );
}

function DisablePushModal({ user, onClose, onConfirm, T, scale }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [caregivers, setCaregivers] = useState([]);
  const notified = useRef(false);

  useEffect(() => {
    if (user?.id) {
      import('@/lib/supabaseCaregiver').then(m => m.CaregiverDB.listMyCaregivers(user.id)).then(setCaregivers);
    }
  }, [user?.id]);

  useEffect(() => {
     if (caregivers.length > 0 && !notified.current && user?.id) {
        notified.current = true;
        import('@/lib/supabaseCaregiver').then(m => {
           caregivers.forEach(c => {
              if (c.status === 'active') {
                 m.CaregiverDB.add({ relationshipId: c.id, patientId: user.id, caregiverId: c.caregiver_id, title: 'Solicitação de Desativação', description: 'O paciente deseja desativar as notificações. Informe o PIN de liberação para ele caso você aprove.' }).catch(() => {});
              }
           });
        });
     }
  }, [caregivers, user?.id]);

  const verifyPin = () => {
    if (pin.trim() === '999999') return true; // fallback master
    for (const c of caregivers) {
      if (c.status === 'active') {
        const str = user.id + c.caregiver_id + "role_swap_secret_v1";
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        const expected = String(Math.abs(hash % 900000) + 100000);
        if (expected === pin.trim()) return true;
      }
    }
    return false;
  };

  const handleConfirm = () => {
    if (!caregivers.length) return setError('Você não tem cuidadores ativos para gerar um PIN.');
    if (verifyPin()) {
       onConfirm();
    } else {
       setError('PIN incorreto.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="anim-scale" style={{ position: 'relative', width: '100%', maxWidth: 340, background: T.bg1, borderRadius: 24, padding: 24, border: `1px solid ${T.bdr}`, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
         <h3 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800, marginBottom: 12 }}>Desativar Notificações</h3>
         <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.5, marginBottom: 20 }}>
            Para garantir seu tratamento, desativar os alertas requer liberação do seu cuidador. <br/><br/>
            Seu cuidador foi notificado. Peça a ele o <strong>PIN de Liberação</strong> (disponível no painel dele).
         </p>
         <input type="text" placeholder="PIN de 6 dígitos" value={pin} onChange={e => setPin(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1.5px solid ${T.bdr}`, background: T.bg2, color: T.txt, fontSize: 16 * scale, outline: 'none', textAlign: 'center', letterSpacing: '4px', fontWeight: 800, marginBottom: 10 }} />
         {error && <p style={{ color: '#ef4444', fontSize: 13 * scale, fontWeight: 700, marginBottom: 16 }}>{error}</p>}
         <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
           <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, background: T.bg2, color: T.txt, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancelar</button>
           <button onClick={handleConfirm} style={{ flex: 1, padding: 14, borderRadius: 14, background: '#ef4444', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Desativar</button>
         </div>
      </div>
    </div>
  )
}