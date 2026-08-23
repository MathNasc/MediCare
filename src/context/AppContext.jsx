'use client';
import { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from 'react';
import { AuthDB, MedDB, HistDB } from '@/lib/db';
import { buildDoses } from '@/lib/doseUtils';
import { AuditDB } from '@/lib/supabaseAudit';
import { StockDB } from '@/lib/supabaseStock';
import { computeEndDate, isTemporaryExpired } from '@/lib/treatmentTypes';
import { supabase } from '@/lib/supabase';

// ─── State ────────────────────────────────────────────────────────────────────
const inFlightDoses = new Set();

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


// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Encerramento automático de tratamentos temporários vencidos ────────────
  const checkExpiredTreatments = useCallback(async (userId, medsList) => {
    if (supabase) {
      try { await supabase.rpc('finish_expired_treatments'); } catch {}
      return;
    }
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
  // Consumo por confirmação de dose NÃO gera movimentação de estoque nem
  // evento de calendário — apenas reduz a quantidade normalmente.
  const confirmDose = useCallback(async (dose, toastFn) => {
    const flightKey = `${dose.med_id}-${dose.hora}`;
    console.log('confirmDose starts', dose, flightKey);
    if (inFlightDoses.has(flightKey)) { console.warn('In flight'); return { success: false, error: 'Em andamento' }; }
    if (dose.status === 'confirmed') { console.warn('Already confirmed'); return { success: false, error: 'Dose já confirmada' }; }
    inFlightDoses.add(flightKey);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (toastFn) toastFn('Sem conexão. Ação cancelada.', 'error');
      else alert('Sem conexão. Ação cancelada.');
      return { success: false, error: 'Offline' };
    }

    const now = new Date();
    const [h, m] = dose.hora.split(':').map(Number);
    let planned = new Date(); planned.setHours(h, m, 0, 0);
    
    // Se planned está mais de 12h no futuro (ex: agora é 00:01, planned é 23:59 de hoje),
    // significa que a dose real a ser confirmada é a de ontem (23:59 de ontem).
    if (planned.getTime() - now.getTime() > 12 * 60 * 60 * 1000) {
      planned.setDate(planned.getDate() - 1);
    }
    // Se planned está mais de 12h no passado (ex: agora é 23:59, planned é 00:01 de ontem),
    // significa que a dose era de hoje, mas wait, planned já seria hoje, então now - planned = 23h, o que está certo (23h de atraso).
    
    const delay = Math.max(0, Math.round((now - planned) / 60000));
    
    // Para garantir que a dose seja vinculada ao dia correto (evitar erro de timezone na virada),
    // injetamos a data local no created_at (se o banco permitir) ou usamos o retroactive se fosse o caso.
    // Mas HistDB.add apenas insere. Vamos forçar o created_at a ter a data pretendida + hora atual.
    let targetCreatedAt = new Date(now);
    // Se a dose pertence ao dia anterior, limitamos o timestamp para 23:59:59 do dia da dose
    // para garantir que o parse local em doseUtils.js o agrupe no dia correto.
    if (targetCreatedAt.getDate() !== planned.getDate()) {
      targetCreatedAt = new Date(planned);
      targetCreatedAt.setHours(23, 59, 59, 999);
    }

    try {
      await HistDB.add({
        created_at:     targetCreatedAt.toISOString(),
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
      console.error('confirmDose error', err);
      if (toastFn) toastFn(err.message || 'Erro ao confirmar dose', 'err');
    } finally {
      inFlightDoses.delete(flightKey);
    }
  }, [state.user, state.meds, loadAll]);

  const undoDose = useCallback(async (dose, toastFn) => {
    const idsToDelete = dose.hist_ids && dose.hist_ids.length > 0 ? dose.hist_ids : (dose.hist_id ? [dose.hist_id] : []);
    if (idsToDelete.length === 0) return { success: false, error: 'Histórico não encontrado' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (toastFn) toastFn('Sem conexão. Ação cancelada.', 'error');
      else alert('Sem conexão. Ação cancelada.');
      return { success: false, error: 'Offline' };
    }

    try {
      for (const id of idsToDelete) {
        await HistDB.delete(id);
      }

      const med = state.meds.find((m) => m.id === dose.med_id);
      if (med) {
         const qtyRestored = dose.quantidade_usada || 1;
         await MedDB.update(med.id, { quantidade: med.quantidade + qtyRestored });
      }

      if (toastFn) toastFn(`Dose de ${dose.nome} desfeita!`, 'ok');
      await loadAll(state.user.id);
      return { success: true };
    } catch (err) {
      console.error('undoDose error', err);
      if (toastFn) toastFn(err.message || 'Erro ao desfazer dose', 'err');
      return { success: false, error: err.message };
    }
  }, [state.user, state.meds, loadAll]);

  // ── Dose actions (correção retroativa — RBAC + auditoria) ──────────────────
  const confirmDoseRetroactive = useCallback(async ({ medId, hora, doseDate, newStatus = 'confirmed', reason = null, patientId }) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return { success: false, error: 'Offline' }; }
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
  // Assim como confirmDose, é consumo — não gera movimentação de estoque
  // nem evento de calendário, apenas reduz a quantidade e registra o histórico.
  const registerSOSUse = useCallback(async (med, { hora, motivo, quantidade = 1, toastFn } = {}) => {

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (toastFn) toastFn('Sem conexão. Ação cancelada.', 'error');
      else alert('Sem conexão. Ação cancelada.');
      return { success: false, error: 'Offline' };
    }

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
      if (toastFn) toastFn(err.message || 'Erro ao registrar uso', 'err');
      return { success: false, error: err.message };
    }
  }, [state.user, loadAll]);

  // ── Tratamentos temporários: repetir após conclusão ─────────────────────────
  const repeatTreatment = useCallback(async (med, newStartDate) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return { success: false, error: 'Offline' }; }
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
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return { success: false, error: 'Offline' }; }
    const patch = { status, ativo: status === 'ativo' };
    if (status === 'concluido' || status === 'cancelado') patch.finished_at = new Date().toISOString();
    await MedDB.update(medId, patch);
    await loadAll(state.user.id);
  }, [state.user, loadAll]);

  // ── Med actions ─────────────────────────────────────────────────────────────
  const saveMed = useCallback(async (form, horarios, dias, editingId) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return { success: false, error: "Offline" }; }
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
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return false; }
    await MedDB.delete(id);
    await loadAll(state.user.id);
  }, [state.user, loadAll]);

  // ── Estoque: registrar movimentação (reposição/ajuste/correção) ────────────
  // Único caminho para logar mudanças manuais de quantidade. Diferente de
  // confirmDose/registerSOSUse (consumo silencioso), toda chamada aqui
  // grava em stock_movements e — quando a quantidade aumenta — cria
  // automaticamente um evento "📦 Estoque" no calendário (ver RPC no banco).
  const recordStockMovement = useCallback(async ({
    medicationId, movementType, quantityBefore, quantityAfter,
    purchasePrice, purchaseLocation, batch, expirationDate, notes,
  }) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) { alert("Sem conexão. Ação cancelada."); return { success: false, error: 'Offline' }; }
    const result = await StockDB.recordMovement({
      medicationId, movementType, quantityBefore, quantityAfter,
      purchasePrice, purchaseLocation, batch, expirationDate, notes,
    });

    if (result?.success && state.user) {
      const med = state.meds.find(m => m.id === medicationId);
      await loadAll(state.user.id);
      
      if (med) {
        try {
          const { EventsDB } = await import('@/lib/supabaseCalendar');
          const isIncrease = quantityAfter > quantityBefore;
          const toISO = (d) => d.toISOString().slice(0, 10);
          
          await EventsDB.add({
            user_id: state.user.id,
            type: 'estoque',
            title: isIncrease ? 'Reposição de estoque' : 'Ajuste de estoque',
            description: `${med.nome}: ${quantityBefore} ➔ ${quantityAfter} ${med.unidade}s${notes ? ' - ' + notes : ''}`,
            date: toISO(new Date()),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          });
        } catch (e) {
          console.error('Falha ao registrar evento de calendário para o estoque:', e);
        }
      }
    }
    return result;
  }, [state.user, state.meds, loadAll]);

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
    confirmDose, undoDose, confirmDoseRetroactive,
    registerSOSUse, repeatTreatment, setTreatmentStatus, getTreatmentDashboard,
    recordStockMovement,
    saveMed, deleteMed, alertCaregiver,
  }), [
    state, login, logout, refresh, updateRole,
    confirmDose, undoDose, confirmDoseRetroactive,
    registerSOSUse, repeatTreatment, setTreatmentStatus, getTreatmentDashboard,
    recordStockMovement,
    saveMed, deleteMed, alertCaregiver,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
