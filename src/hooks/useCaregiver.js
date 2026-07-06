'use client';
// src/hooks/useCaregiver.js
// Hook centralizado para o sistema de cuidadores.
// Gerencia estado, carregamento e ações para a tela do paciente e do cuidador.

import { useState, useEffect, useCallback } from 'react';
import {
  CaregiverDB,
  CaregiverDashDB,
  CaregiverNotesDB,
  PERMISSION_LEVELS,
} from '@/lib/supabaseCaregiver';

// ─── Hook: tela do paciente (gerencia seus cuidadores) ────────────────────────
export function useMyCaregivers(userId) {
  const [caregivers, setCaregivers]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await CaregiverDB.listMyCaregivers(userId);
      setCaregivers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const createInvite = useCallback(async (opts) => {
    const result = await CaregiverDB.createInvite({ patientId: userId, ...opts });
    if (!result.error) await load();
    return result;
  }, [userId, load]);

  const revoke = useCallback(async (relationshipId) => {
    const ok = await CaregiverDB.revoke(relationshipId);
    if (ok) await load();
    return ok;
  }, [load]);

  const updatePermission = useCallback(async (relationshipId, level) => {
    const ok = await CaregiverDB.updatePermission(relationshipId, level, userId);
    if (ok) await load();
    return ok;
  }, [userId, load]);

  const updateLabel = useCallback(async (relationshipId, label) => {
    const ok = await CaregiverDB.updateLabel(relationshipId, label, userId);
    if (ok) await load();
    return ok;
  }, [userId, load]);

  const regenerateToken = useCallback(async (relationshipId) => {
    return CaregiverDB.regenerateToken(relationshipId, userId);
  }, [userId]);

  // Contadores úteis para badges
  const activeCount  = caregivers.filter(c => c.status === 'active').length;
  const pendingCount = caregivers.filter(c => c.status === 'pending').length;

  return {
    caregivers,
    loading,
    error,
    reload: load,
    createInvite,
    revoke,
    updatePermission,
    updateLabel,
    regenerateToken,
    activeCount,
    pendingCount,
  };
}

// ─── Hook: tela do cuidador (acompanha um paciente) ───────────────────────────
export function usePatientDashboard(patientId) {
  const [summary, setSummary]   = useState(null);
  const [meds, setMeds]         = useState([]);
  const [history, setHistory]   = useState([]);
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [sum, medsData, histData, notesData] = await Promise.all([
        CaregiverDashDB.getPatientSummary(patientId),
        CaregiverDashDB.getPatientMeds(patientId),
        CaregiverDashDB.getPatientHistory(patientId, 60),
        CaregiverNotesDB.list(patientId, 20),
      ]);
      setSummary(sum);
      setMeds(medsData);
      setHistory(histData);
      setNotes(notesData);
    } catch {
      // Silent — access may have been revoked
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const confirmDose = useCallback(async (medId, hora) => {
    return CaregiverDashDB.confirmDoseRemotely({ patientId, medId, hora });
  }, [patientId]);

  const addNote = useCallback(async (payload) => {
    const note = await CaregiverNotesDB.add({ patientId, ...payload });
    if (note) setNotes(n => [note, ...n]);
    return note;
  }, [patientId]);

  const deleteNote = useCallback(async (noteId, caregiverId) => {
    await CaregiverNotesDB.delete(noteId, caregiverId);
    setNotes(n => n.filter(x => x.id !== noteId));
  }, []);

  // Métricas derivadas do histórico
  const today = new Date().toDateString();
  const todayHistory   = history.filter(h => new Date(h.created_at).toDateString() === today);
  const confirmedToday = todayHistory.filter(h => h.status === 'confirmed').length;
  const totalToday     = meds.reduce((acc, m) => acc + (m.horarios?.length || 1), 0);
  const progressToday  = totalToday > 0 ? Math.round((confirmedToday / totalToday) * 100) : 0;

  const monthConf = history.filter(h => h.status === 'confirmed').length;
  const adhesion  = history.length > 0 ? Math.round((monthConf / history.length) * 100) : 0;

  return {
    summary,
    meds,
    history,
    notes,
    loading,
    reload: load,
    confirmDose,
    addNote,
    deleteNote,
    // métricas
    confirmedToday,
    totalToday,
    progressToday,
    adhesion,
  };
}

// ─── Hook: pacientes que sou cuidador ─────────────────────────────────────────
export function useMyPatients(caregiverId) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!caregiverId) return;
    setLoading(true);
    CaregiverDB.listMyPatients(caregiverId)
      .then(setPatients)
      .finally(() => setLoading(false));
  }, [caregiverId]);

  return { patients, loading };
}

// ─── Hook: aceite de convite ──────────────────────────────────────────────────
export function useInviteAccept(token) {
  const [invite, setInvite]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult]   = useState(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    CaregiverDB.getInviteByToken(token)
      .then(data => { setInvite(data); setLoading(false); });
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    const res = await CaregiverDB.acceptInvite(token);
    setResult(res);
    setAccepting(false);
    return res;
  }, [token]);

  return { invite, loading, accepting, result, accept };
}

export { PERMISSION_LEVELS };
