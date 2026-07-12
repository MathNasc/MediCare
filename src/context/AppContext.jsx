'use client';
import { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from 'react';
import { AuthDB, MedDB, HistDB } from '@/lib/db';
import { buildDoses } from '@/lib/doseUtils';
import { AuditDB } from '@/lib/supabaseAudit';
import { computeEndDate, isTemporaryExpired } from '@/lib/treatmentTypes';
import { supabase } from '@/lib/supabase';

// ─── State ────────────────────────────────────────────────────────────────────
const initialState = {
  user:        null, // inclui { id, nome, email, role, created_at }
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
    case 'SET_ROLE':
      return { ...state, user: state.user ? { ...state.user, role: action.role } : state.user };
    case 'LOGOUT':
      return { ...initialState, loading: false };
    default:
      return state;
  }
}

// ─── Demo seeds ───────────────────────────────────────────────────────────────
const DEMO_MEDS = (userId) => [
  { user_id:userId, nome:'Aspirina',   dosagem:'100mg',  quantidade:28, unidade:'comprimido', cor:'#ef4444', observacoes:'Após café da manhã', ativo:true, horarios:['08:00'],        dias_semana:[1,2,3,4,5,6,7], treatment_type:'continuous', status:'ativo' },
  { user_id:userId, nome:'Losartana',  dosagem:'50mg',   quantidade:9,  unidade:'comprimido', cor:'#3b82f6', observacoes:'Tomar em jejum',      ativo:true, horarios:['08:00','20:00'], dias_semana:[1,2,3,4,5,6,7], treatment_type:'continuous', status:'ativo' },
  { user_id:userId, nome:'Vitamina D', dosagem:'2000UI', quantidade:4,  unidade:'cápsula',    cor:'#f59e0b', observacoes:'Com refeição',        ativo:true, horarios:['14:00'],        dias_semana:[1,2,3,4,5,6,7], treatment_type:'continuous', status:'ativo' },
];

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Encerramento automático de tratamentos temporários vencidos ────────────
  // Tenta primeiro a RPC segura no Supabase (fonte de verdade); em modo
  // localStorage/demo, faz a checagem e atualização diretamente no cliente.
  const checkExpiredTreatments = useCallback(async (userId, medsList) => {
    if (supabase) {
      try { await supabase.rpc('finish_expired_treatments'); } catch {}
      return;
    }
    // Fallback localStorage: finaliza tratamentos temporários vencidos
    const expired = medsList.filter((m) => m.treatment_type === 'temporary' && m.status === 'ativo' && isTemporaryExpired(m));
    for (const m of expired) {
      await MedDB.update(m.id, { status: 'concluido', finished_at: new Date().toISOString(), ativo: false });
    }
  }, []);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (userId) => {
    dispatch({ type: 'SET_SYNCING', value: true });
    try {
      let ms = await MedDB.list(userId);

      // Seed de demonstração roda apenas UMA VEZ por usuário/dispositivo.
      const seedKey = `mc_seeded_${userId}`;
      const alreadySeeded =
        typeof window !== 'undefined' && localStorage.getItem(seedKey) === '1';

      if (ms.length === 0 && !alreadySeeded) {
        await Promise.all(DEMO_MEDS(userId).map((m) => MedDB.add(m)));
        ms = await MedDB.list(userId);
      }

      if (typeof window !== 'undefined') localStorage.setItem(seedKey, '1');

      // Verifica e encerra tratamentos temporários vencidos antes de montar as doses do dia
      await checkExpiredTreatments(userId, ms);
      ms = await MedDB.list(userId);

      const hist = await HistDB.list(userId);
      dispatch({ type: 'SET_DATA', meds: ms, history: hist });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  }, [checkExpiredTreatments]);

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

  // ── RBAC: atualizar papel do usuário ────────────────────────────────────────
  const updateRole = useCallback(async (role) => {
    if (!state.user) return false;
    const ok = await AuthDB.updateRole(state.user.id, role);
    if (ok) dispatch({ type: 'SET_ROLE', role });
    return ok;
  }, [state.user]);

  // ── Dose actions (confirmação em tempo real — uso contínuo/temporário) ─────
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
        performed_by:   state.user.id,
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

  // ── Dose actions (correção retroativa — RBAC + auditoria) ──────────────────
  const confirmDoseRetroactive = useCallback(async ({ medId, hora, doseDate, newStatus = 'confirmed', reason = null, patientId }) => {
    const targetPatientId = patientId || state.user?.id;
    const result = await AuditDB.confirmRetroactive({
      patientId: targetPatientId,
      medId, hora, doseDate, newStatus, reason,
    });
    if (result?.success && targetPatientId === state.user?.id) {
      await loadAll(state.user.id);
    }
    return result;
  }, [state.user, loadAll]);

  // ── SOS: registrar uso sob demanda ──────────────────────────────────────────
  // Diferente de confirmDose: não há horário "programado" nem atraso.
  // Registra imediatamente no histórico com o motivo informado (opcional).
  const registerSOSUse = useCallback(async (med, { hora, motivo, quantidade = 1, toastFn } = {}) => {
    const usedAt = hora || new Date().toTimeString().slice(0, 5);
    try {
      await HistDB.add({
        med_id:           med.id,
        user_id:          state.user.id,
        hora:             usedAt,
        status:           'confirmed',
        atraso_minutos:   0,
        performed_by:     state.user.id,
        motivo:           motivo || null,
        quantidade_usada: quantidade,
      });

      if (med.quantidade > 0) {
        await MedDB.update(med.id, { quantidade: Math.max(0, med.quantidade - quantidade) });
      }

      if (toastFn) toastFn(`✓ ${med.nome} registrado!`, 'ok');
      await loadAll(state.user.id);
      return { success: true };
    } catch (err) {
      if (toastFn) toastFn('Erro ao registrar uso', 'err');
      return { success: false, error: err.message };
    }
  }, [state.user, loadAll]);

  // ── Tratamentos temporários: repetir após conclusão ─────────────────────────
  const repeatTreatment = useCallback(async (med, newStartDate) => {
    if (!state.user) return { success: false, error: 'Sem sessão ativa' };
    try {
      if (supabase) {
        const { data, error } = await supabase.rpc('repeat_treatment', {
          p_med_id: med.id,
          p_new_start_date: newStartDate,
        });
        if (error) throw error;
        await loadAll(state.user.id);
        return { success: true, id: data };
      }
      // Fallback localStorage
      const days = med.treatment_days || 7;
      const endDate = computeEndDate(newStartDate, days);
      const newMed = await MedDB.add({
        user_id: state.user.id,
        nome: med.nome, dosagem: med.dosagem, quantidade: med.quantidade,
        unidade: med.unidade, cor: med.cor, observacoes: med.observacoes,
        horarios: med.horarios, dias_semana: med.dias_semana, ativo: true,
        treatment_type: 'temporary', start_date: newStartDate, end_date: endDate,
        treatment_days: days, status: 'ativo',
      });
      await loadAll(state.user.id);
      return { success: true, id: newMed.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [state.user, loadAll]);

  // ── Tratamentos: pausar / retomar / cancelar ────────────────────────────────
  const setTreatmentStatus = useCallback(async (medId, status) => {
    const patch = { status, ativo: status === 'ativo' };
    if (status === 'concluido' || status === 'cancelado') patch.finished_at = new Date().toISOString();
    await MedDB.update(medId, patch);
    await loadAll(state.user.id);
  }, [state.user, loadAll]);

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
  const alertCaregiver = useCallback(async (dose) => {
    if (!state.user) return;
    try {
      const { SupaCaregivers } = await import('@/lib/supabase');
      const caregivers = await SupaCaregivers.list(state.user.id);
      if (!caregivers.length) return;

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

  // ── Dashboard de tratamentos (indicadores) ──────────────────────────────────
  const getTreatmentDashboard = useCallback(async () => {
    if (!state.user) return null;
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('get_treatment_dashboard');
        if (error) throw error;
        return data;
      } catch { /* fallback abaixo */ }
    }
    // Fallback client-side (localStorage ou erro na RPC)
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return {
      continuous_count:    state.meds.filter(m => (m.treatment_type || 'continuous') === 'continuous' && m.ativo).length,
      active_treatments:   state.meds.filter(m => m.treatment_type === 'temporary' && m.status === 'ativo').length,
      finished_treatments: state.meds.filter(m => m.treatment_type === 'temporary' && m.status === 'concluido').length,
      sos_uses_this_month: state.history.filter(h => {
        const med = state.meds.find(m => m.id === h.med_id);
        return med?.treatment_type === 'sos' && h.created_at?.startsWith(monthPrefix);
      }).length,
    };
  }, [state.user, state.meds, state.history]);

  const value = useMemo(() => ({
    ...state,
    login, logout, refresh, updateRole,
    confirmDose, confirmDoseRetroactive,
    registerSOSUse, repeatTreatment, setTreatmentStatus, getTreatmentDashboard,
    saveMed, deleteMed, alertCaregiver,
  }), [
    state, login, logout, refresh, updateRole,
    confirmDose, confirmDoseRetroactive,
    registerSOSUse, repeatTreatment, setTreatmentStatus, getTreatmentDashboard,
    saveMed, deleteMed, alertCaregiver,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
