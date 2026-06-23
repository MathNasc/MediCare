'use client';
import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AppProvider, useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { useFontScale } from '@/hooks/useFontScale';
import { useToast } from '@/hooks/useToast';
import { useNotifications } from '@/hooks/useNotifications';
import { AuthScreen }  from '@/components/AuthScreen';
import { BottomNav }   from '@/components/BottomNav';
import { Toasts }      from '@/components/ui/Toasts';

// ── Lazy-loaded screens ──────────────────────────────────────────────────────
const HomeScreen    = dynamic(() => import('@/screens/HomeScreen').then(m => ({ default: m.HomeScreen })),    { loading: () => <ScreenLoader /> });
const MedsScreen    = dynamic(() => import('@/screens/MedsScreen').then(m => ({ default: m.MedsScreen })),    { loading: () => <ScreenLoader /> });
const StatsScreen   = dynamic(() => import('@/screens/StatsScreen').then(m => ({ default: m.StatsScreen })),   { loading: () => <ScreenLoader /> });
const AIScreen      = dynamic(() => import('@/screens/AIScreen').then(m => ({ default: m.AIScreen })),          { loading: () => <ScreenLoader /> });
const ProfileScreen = dynamic(() => import('@/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })), { loading: () => <ScreenLoader /> });
const QuickConfirm  = dynamic(() => import('@/components/modals/QuickConfirm').then(m => ({ default: m.QuickConfirm })));
const MedModal      = dynamic(() => import('@/components/modals/MedModal').then(m => ({ default: m.MedModal })));
const MedDetail     = dynamic(() => import('@/components/modals/MedDetail').then(m => ({ default: m.MedDetail })));

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

  // Registro incondicional do SW: requisito de instalabilidade do PWA
  // (sem isso, o Chrome não trata o app como instalável e a barra
  // de endereço permanece visível mesmo após "Adicionar à tela inicial").
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

    // Quando uma nova versão do SW assume o controle (ex: novo deploy),
    // o JS já carregado nesta aba ainda referencia chunks da build antiga
    // e pode disparar ChunkLoadError. Recarregar garante que o HTML/JS
    // atual seja buscado novamente.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
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

// ─── Inner app ────────────────────────────────────────────────────────────────
function InnerApp() {
  const { user, loading, login, doses, meds, history, confirmDose, saveMed } = useApp();
  const { dark, toggle, T } = useTheme();
  const { size: fsSize, set: setFs, scale } = useFontScale();
  const { list: toasts, show: toast } = useToast();
  const { canInstall, install } = usePWAInstall();

  const [tab,       setTab]       = useState('home');
  const [quickDose, setQuickDose] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editMed,   setEditMed]   = useState(null);
  const [viewMed,   setViewMed]   = useState(null);

  // Handle URL action params (from notification click)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tabParam = params.get('tab');
    if (tabParam) setTab(tabParam);
    if (action === 'confirm') {
      const hora   = params.get('hora');
      const doseId = params.get('doseId');
      const dose   = doses.find((d) => d.hora === hora || d.id === doseId);
      if (dose && dose.status !== 'confirmed') setQuickDose(dose);
    }
    // Clean URL
    if (action || tabParam) window.history.replaceState({}, '', '/');
  }, [doses]);

  // Notifications
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

  // Loading splash
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

  if (!user) return <AuthScreen onLogin={login} T={T} />;

  const screenProps = { T, scale };

  return (
    <div style={{ minHeight: '100vh', background: T.bg0 }}>
      <Toasts list={toasts} />

      {/* PWA install banner */}
      {canInstall && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#3b82f6', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>📲 Instalar MediCare no celular</p>
          <button onClick={install} style={{ background: '#fff', color: '#3b82f6', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 13 }}>Instalar</button>
        </div>
      )}

      <main role="main" style={{ maxWidth: 480, margin: '0 auto', padding: `${canInstall ? 56 : 22}px 16px 96px`, minHeight: '100vh' }}>
        <Suspense fallback={<ScreenLoader />}>
          {tab === 'home'    && <HomeScreen    {...screenProps} onQuickConfirm={setQuickDose} toggle={toggle} dark={dark} />}
          {tab === 'meds'    && <MedsScreen    {...screenProps} toast={toast} onAdd={() => { setEditMed(null); setShowAdd(true); }} onEdit={(m) => { setEditMed(m); setShowAdd(true); }} onView={setViewMed} />}
          {tab === 'stats'   && <StatsScreen   {...screenProps} />}
          {tab === 'ai'      && <AIScreen      {...screenProps} />}
          {tab === 'profile' && <ProfileScreen {...screenProps} dark={dark} toggle={toggle} fsSize={fsSize} setFs={setFs} />}
        </Suspense>
      </main>

      <BottomNav tab={tab} setTab={setTab} T={T} pendingCount={pendingCount} criticalCount={criticalCount} />

      {quickDose && <QuickConfirm dose={quickDose} onConfirm={handleConfirmDose} onSnooze={handleSnooze} onClose={() => setQuickDose(null)} T={T} />}
      {showAdd   && <MedModal med={editMed} onSave={handleSaveMed} onClose={() => { setShowAdd(false); setEditMed(null); }} T={T} scale={scale} />}
      {viewMed   && <MedDetail med={viewMed} history={history} onClose={() => setViewMed(null)} T={T} scale={scale} />}
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
