'use client';
import { useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AppProvider, useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { useFontScale } from '@/hooks/useFontScale';
import { useToast } from '@/hooks/useToast';
import { useNotifications } from '@/hooks/useNotifications';
import { AuthScreen }       from '@/components/AuthScreen';
import { BottomNav }        from '@/components/BottomNav';
import { Toasts }           from '@/components/ui/Toasts';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { CaregiverDB }      from '@/lib/supabaseCaregiver';
import { PERMISSION_LEVELS } from '@/hooks/useCaregiver';

// ── Lazy-loaded screens ──────────────────────────────────────────────────────
const HomeScreen     = dynamic(() => import('@/screens/HomeScreen').then(m => ({ default: m.HomeScreen })),     { loading: () => <ScreenLoader /> });
const MedsScreen     = dynamic(() => import('@/screens/MedsScreen').then(m => ({ default: m.MedsScreen })),     { loading: () => <ScreenLoader /> });
const CalendarScreen = dynamic(() => import('@/screens/CalendarScreen').then(m => ({ default: m.CalendarScreen })), { loading: () => <ScreenLoader /> });
const StatsScreen    = dynamic(() => import('@/screens/StatsScreen').then(m => ({ default: m.StatsScreen })),    { loading: () => <ScreenLoader /> });
const AIScreen       = dynamic(() => import('@/screens/AIScreen').then(m => ({ default: m.AIScreen })),          { loading: () => <ScreenLoader /> });
const ProfileScreen  = dynamic(() => import('@/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })), { loading: () => <ScreenLoader /> });
const QuickConfirm   = dynamic(() => import('@/components/modals/QuickConfirm').then(m => ({ default: m.QuickConfirm })));
const MedModal       = dynamic(() => import('@/components/modals/MedModal').then(m => ({ default: m.MedModal })));
const MedDetail      = dynamic(() => import('@/components/modals/MedDetail').then(m => ({ default: m.MedDetail })));

function ScreenLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <div className="anim-blink" style={{ fontSize: 36 }}>💊</div>
    </div>
  );
}

// ─── PWA installer hook ───────────────────────────────────────────────────────
function usePWAInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Registro do SW + verificação PROATIVA de atualizações ──────────────────
  // Antes, o app dependia do ciclo padrão do navegador para checar se havia
  // um sw.js novo (geralmente só a cada ~24h ou em navegações completas).
  // Isso fazia deploys novos demorarem a "aparecer" para quem já tinha o
  // app aberto ou instalado como PWA. Agora forçamos reg.update() em três
  // momentos: logo após o registro, sempre que a aba volta a ficar visível
  // (o usuário reabre o app), e a cada 5 minutos enquanto o app está aberto.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration = null;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;
        // Verifica imediatamente se já existe uma versão mais nova publicada
        reg.update().catch(() => {});
      })
      .catch(() => {});

    const checkForUpdate = () => {
      registration?.update().catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intervalId = setInterval(checkForUpdate, 5 * 60 * 1000);

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  return { canInstall: Boolean(prompt) && !installed, install };
}

// ─── Convite de cuidador: detecta token na URL e gerencia aceite ──────────────
function useCaregiverInvite() {
  const [token, setToken]   = useState(null);
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path  = window.location.pathname;
    const match = path.match(/^\/convite\/([a-f0-9]+)$/i);
    const query = new URLSearchParams(window.location.search).get('convite');
    const found = match?.[1] || query || null;
    if (!found) return;

    setToken(found);
    setStatus('loading');
    window.history.replaceState({}, '', '/');

    CaregiverDB.getInviteByToken(found).then((data) => {
      setInvite(data);
      setStatus(data ? 'ready' : 'error');
    });
  }, []);

  const accept = useCallback(async () => {
    setStatus('accepting');
    const result = await CaregiverDB.acceptInvite(token);
    setStatus(result?.success ? 'done' : 'error');
    return result;
  }, [token]);

  const dismiss = useCallback(() => setStatus(null), []);

  return { status, invite, accept, dismiss };
}

// ─── Modal de aceite de convite de cuidador ───────────────────────────────────
function CaregiverInviteModal({ status, invite, onAccept, onDismiss, T }) {
  if (!status) return null;

  const permLabel = {
    viewer:    '👁 Apenas Visualização',
    caregiver: '🤝 Cuidador',
    admin:     '⚙️ Administrador',
  }[invite?.permission_level] || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Convite de cuidador"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(16px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="anim-scaleIn" style={{ background: T.bg1, borderRadius: 24, padding: 28, maxWidth: 380, width: '100%' }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <span className="anim-blink" style={{ fontSize: 40 }}>🔗</span>
            <p style={{ color: T.sub, marginTop: 12, fontSize: 14 }}>Verificando convite…</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 40, marginBottom: 10 }}>❌</p>
            <p style={{ color: T.txt, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Convite inválido</p>
            <p style={{ color: T.sub, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Este convite expirou, já foi utilizado ou não existe.
            </p>
            <button
              onClick={onDismiss}
              style={{ width: '100%', padding: 14, borderRadius: 12, background: T.bg3, color: T.sub, border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >Fechar</button>
          </div>
        )}

        {status === 'ready' && invite && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 44, marginBottom: 12 }}>🤝</p>
            <p style={{ color: T.txt, fontWeight: 900, fontSize: 18, lineHeight: 1.35, marginBottom: 8 }}>
              {invite.patient?.nome || 'Alguém'} deseja compartilhar o tratamento com você.
            </p>
            <p style={{ color: T.sub, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Você poderá acompanhar medicamentos, histórico e receber alertas.
            </p>
            <div style={{ background: T.bg2, borderRadius: 12, padding: 12, marginBottom: 20, textAlign: 'left' }}>
              <p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                Seu nível de acesso
              </p>
              <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 }}>{permLabel}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onDismiss}
                style={{ flex: 1, padding: 14, borderRadius: 12, background: T.bg3, color: T.sub, border: `1px solid ${T.bdr}`, cursor: 'pointer', fontWeight: 700 }}
              >Recusar</button>
              <button
                onClick={onAccept}
                style={{ flex: 1, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >Aceitar</button>
            </div>
          </div>
        )}

        {status === 'accepting' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <span className="anim-blink" style={{ fontSize: 36 }}>⟳</span>
            <p style={{ color: T.sub, marginTop: 12, fontSize: 14 }}>Vinculando conta…</p>
          </div>
        )}

        {status === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: 44, marginBottom: 10 }}>✅</p>
            <p style={{ color: T.txt, fontWeight: 900, fontSize: 18 }}>Vinculado com sucesso!</p>
            <p style={{ color: T.sub, fontSize: 13, marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
              Acesse a aba Perfil → "Pacientes que acompanho" para visualizar o tratamento.
            </p>
            <button
              onClick={onDismiss}
              style={{ width: '100%', padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
            >Continuar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inner app ────────────────────────────────────────────────────────────────
function InnerApp() {
  const { user, loading, login, doses, meds, history, confirmDose, saveMed } = useApp();
  const { dark, toggle, T } = useTheme();
  const { size: fsSize, set: setFs, scale } = useFontScale();
  const { list: toasts, show: toast } = useToast();
  const { canInstall, install } = usePWAInstall();
  const invite = useCaregiverInvite();

  const [tab,       setTab]       = useState('home');
  const [quickDose, setQuickDose] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editMed,   setEditMed]   = useState(null);
  const [viewMed,   setViewMed]   = useState(null);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action   = params.get('action');
    const tabParam = params.get('tab');
    if (tabParam) setTab(tabParam);
    if (action === 'confirm') {
      const hora   = params.get('hora');
      const doseId = params.get('doseId');
      const dose   = doses.find((d) => d.hora === hora || d.id === doseId);
      if (dose && dose.status !== 'confirmed') setQuickDose(dose);
    }
    if (action || tabParam) window.history.replaceState({}, '', '/');
  }, [doses]);

  useNotifications(doses, user?.id);

  const handleConfirmDose = useCallback((dose) => {
    confirmDose(dose, toast);
  }, [confirmDose, toast]);

  const handleSnooze = useCallback((dose) => {
    toast(`⏰ Lembrete de ${dose.nome} em 15 minutos`, 'info');
  }, [toast]);

  const handleSaveMed = useCallback((form, horarios, dias) => {
    if (!form.nome.trim()) { toast('Informe o nome do medicamento', 'err'); return; }
    saveMed(form, horarios, dias, editMed?.id);
    toast(editMed ? `✓ ${form.nome} atualizado!` : `✓ ${form.nome} adicionado!`);
    setShowAdd(false);
    setEditMed(null);
  }, [saveMed, editMed, toast]);

  const pendingCount  = doses.filter((d) => ['pending', 'late'].includes(d.status)).length;
  const criticalCount = meds.filter((m) => m.quantidade <= 5).length;

  const bannerHeight = !isStandalone ? 56 : 0;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="anim-blink" style={{ fontSize: 56, marginBottom: 14 }}>💊</div>
          <p style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>MediCare</p>
          <p style={{ color: '#6e7681', fontSize: 13, marginTop: 4 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
  }

  const screenProps = { T, scale };

  return (
    <div style={{ minHeight: '100vh', background: T.bg0 }}>
      <Toasts list={toasts} />

      {!isStandalone && (
        <PWAInstallBanner
          canInstall={canInstall}
          onInstall={install}
          T={T}
          scale={scale}
        />
      )}

      <main
        role="main"
        style={{
          maxWidth: 480, margin: '0 auto',
          padding: `${22 + bannerHeight}px 16px 96px`,
          minHeight: '100vh',
        }}
      >
        <Suspense fallback={<ScreenLoader />}>
          {tab === 'home'     && <HomeScreen     {...screenProps} onQuickConfirm={setQuickDose} toggle={toggle} dark={dark} />}
          {tab === 'meds'     && <MedsScreen     {...screenProps} toast={toast} onAdd={() => { setEditMed(null); setShowAdd(true); }} onEdit={(m) => { setEditMed(m); setShowAdd(true); }} onView={setViewMed} />}
          {tab === 'calendar' && <CalendarScreen {...screenProps} />}
          {tab === 'stats'    && <StatsScreen    {...screenProps} />}
          {tab === 'ai'       && <AIScreen       {...screenProps} />}
          {tab === 'profile'  && <ProfileScreen  {...screenProps} dark={dark} toggle={toggle} fsSize={fsSize} setFs={setFs} />}
        </Suspense>
      </main>

      <BottomNav tab={tab} setTab={setTab} T={T} pendingCount={pendingCount} criticalCount={criticalCount} />

      {quickDose && <QuickConfirm dose={quickDose} onConfirm={handleConfirmDose} onSnooze={handleSnooze} onClose={() => setQuickDose(null)} T={T} />}
      {/* NOVO: prop `toast` adicionada — permite ao MedModal avisar o usuário
          caso a movimentação de estoque falhe ao salvar (ver correção de bug). */}
      {showAdd   && <MedModal med={editMed} onSave={handleSaveMed} onClose={() => { setShowAdd(false); setEditMed(null); }} T={T} scale={scale} userId={user?.id} toast={toast} />}
      {viewMed   && <MedDetail med={viewMed} history={history} onClose={() => setViewMed(null)} T={T} scale={scale} />}

      {invite.status && (
        <CaregiverInviteModal
          status={invite.status}
          invite={invite.invite}
          onAccept={invite.accept}
          onDismiss={invite.dismiss}
          T={T}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  );
}
