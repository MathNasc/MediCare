'use client';
import { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from 'react';
import { AuthDB, MedDB, HistDB } from '@/lib/db';
import { buildDoses } from '@/lib/doseUtils';

// ─── State ────────────────────────────────────────────────────────────────────
const initialState = {
  user:        null,
  meds:        [],
  history:     [],
  doses:       [],
  loading:     true,
  syncing:     false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'BOOT':
      return { ...state, user: action.user, loading: false };
    case 'SET_DATA': {
      const doses = buildDoses(action.meds, action.history);
      return { ...state, meds: action.meds, history: action.history, doses, syncing: false };
    }
    case 'SET_SYNCING':
      return { ...state, syncing: action.value };
    case 'SET_ERROR':
      return { ...state, error: action.error, syncing: false };
    case 'LOGOUT':
      return { ...initialState, loading: false };
    default:
      return state;
  }
}

// ─── Demo seeds ───────────────────────────────────────────────────────────────
const DEMO_MEDS = (userId) => [
  { user_id:userId, nome:'Aspirina',   dosagem:'100mg',  quantidade:28, unidade:'comprimido', cor:'#ef4444', observacoes:'Após café da manhã', ativo:true, horarios:['08:00'],        dias_semana:[1,2,3,4,5,6,7] },
  { user_id:userId, nome:'Losartana',  dosagem:'50mg',   quantidade:9,  unidade:'comprimido', cor:'#3b82f6', observacoes:'Tomar em jejum',      ativo:true, horarios:['08:00','20:00'], dias_semana:[1,2,3,4,5,6,7] },
  { user_id:userId, nome:'Vitamina D', dosagem:'2000UI', quantidade:4,  unidade:'cápsula',    cor:'#f59e0b', observacoes:'Com refeição',        ativo:true, horarios:['14:00'],        dias_semana:[1,2,3,4,5,6,7] },
];

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (userId) => {
    dispatch({ type: 'SET_SYNCING', value: true });
    try {
      let ms = await MedDB.list(userId);

      // Seed de demonstração roda apenas UMA VEZ por usuário/dispositivo.
      // Antes: reseeding ocorria sempre que ms.length === 0, fazendo
      // medicamentos excluídos voltarem após refresh.
      const seedKey = `mc_seeded_${userId}`;
      const alreadySeeded =
        typeof window !== 'undefined' && localStorage.getItem(seedKey) === '1';

      if (ms.length === 0 && !alreadySeeded) {
        await Promise.all(DEMO_MEDS(userId).map((m) => MedDB.add(m)));
        ms = await MedDB.list(userId);
      }

      if (typeof window !== 'undefined') localStorage.setItem(seedKey, '1');

      const hist = await HistDB.list(userId);
      dispatch({ type: 'SET_DATA', meds: ms, history: hist });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  }, []);

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    AuthDB.current().then((user) => {
      dispatch({ type: 'BOOT', user });
      if (user) loadAll(user.id);
    });
  }, [loadAll]);

  // ── Auth actions ────────────────────────────────────────────────────────────
  const login = useCallback((user) => {
    dispatch({ type: 'BOOT', user });
    loadAll(user.id);
  }, [loadAll]);

  const logout = useCallback(async () => {
    await AuthDB.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const refresh = useCallback(() => {
    if (state.user) loadAll(state.user.id);
  }, [state.user, loadAll]);

  // ── Dose actions ────────────────────────────────────────────────────────────
  const confirmDose = useCallback(async (dose, toastFn) => {
    const now = new Date();
    const [h, m] = dose.hora.split(':').map(Number);
    const planned = new Date(); planned.setHours(h, m, 0, 0);
    const delay = Math.max(0, Math.round((now - planned) / 60000));

    try {
      await HistDB.add({
        med_id:         dose.med_id,
        user_id:        state.user.id,
        hora:           dose.hora,
        status:         'confirmed',
        atraso_minutos: delay,
      });

      const med = state.meds.find((m) => m.id === dose.med_id);
      if (med && med.quantidade > 0) {
        await MedDB.update(med.id, { quantidade: med.quantidade - 1 });
        const nq = med.quantidade - 1;
        if (toastFn) {
          if (nq === 0)    toastFn(`🚨 ${med.nome}: estoque zerado!`, 'err', 5000);
          else if (nq <= 2) toastFn(`🚨 ${med.nome}: apenas ${nq} restante(s)!`, 'err', 5000);
          else if (nq <= 5) toastFn(`⚠ ${med.nome}: ${nq} restantes. Providencie reposição.`, 'warn');
          else if (nq <= 10) toastFn(`ℹ ${med.nome}: ${nq} restantes.`, 'info');
        }
      }

      if (toastFn) toastFn(`✓ ${dose.nome} confirmada!`, 'ok');
      await loadAll(state.user.id);
    } catch (err) {
      if (toastFn) toastFn('Erro ao confirmar dose', 'err');
    }
  }, [state.user, state.meds, loadAll]);

  // ── Med actions ─────────────────────────────────────────────────────────────
  const saveMed = useCallback(async (form, horarios, dias, editingId) => {
    const payload = {
      ...form,
      horarios:    Array.isArray(horarios) && horarios.length > 0 ? horarios : ['08:00'],
      dias_semana: Array.isArray(dias) && dias.length > 0 ? dias : [1,2,3,4,5,6,7],
    };
    if (editingId) await MedDB.update(editingId, payload);
    else await MedDB.add({ ...payload, user_id: state.user.id });
    await loadAll(state.user.id);
  }, [state.user, loadAll]);

  const deleteMed = useCallback(async (id) => {
    await MedDB.delete(id);
    await loadAll(state.user.id);
  }, [state.user, loadAll]);

  // ── Caregiver alert ─────────────────────────────────────────────────────────
  // Called when a dose is 30min overdue — alerts caregiver
  const alertCaregiver = useCallback(async (dose) => {
    if (!state.user) return;
    try {
      const { SupaCaregivers } = await import('@/lib/supabase');
      const caregivers = await SupaCaregivers.list(state.user.id);
      if (!caregivers.length) return;

      // Send notification via Supabase Edge Function (if configured)
      const { supabase } = await import('@/lib/supabase');
      if (supabase) {
        await supabase.functions.invoke('alert-caregiver', {
          body: {
            patientName: state.user.nome,
            medName:     dose.nome,
            hora:        dose.hora,
            caregivers:  caregivers.map((c) => c.cuidador_id),
          },
        });
      }
    } catch {}
  }, [state.user]);

  const value = useMemo(() => ({
    ...state,
    login, logout, refresh,
    confirmDose, saveMed, deleteMed, alertCaregiver,
  }), [state, login, logout, refresh, confirmDose, saveMed, deleteMed, alertCaregiver]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
