'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import medicareLogo from '../../../public/icon-192.png';
import {
  Home,
  Users,
  Calendar,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  UserPlus,
  Plus,
  MapPin,
  User,
  TrendingUp,
  LogOut,
  Mail,
  KeyRound,
  Loader2,
  ArrowLeft,
  Pill,
  History,
  Trash2,
  Check,
  X,
  Package,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react';

function readCookieValue(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

const EMPTY_PATIENT_FORM = {
  nome: '',
  relationship_label: '',
  blood_type: '',
  dob: '',
  phone: '',
};

const EMPTY_MED_FORM = {
  nome: '',
  principio_ativo: '',
  dosagem: '',
  unidade: '',
  quantidade: '',
  horarios: '',
  treatment_type: 'continuous',
};

const EMPTY_APPOINTMENT_FORM = {
  type: 'consulta',
  title: '',
  date: '',
  time: '',
  doctor: '',
  location: '',
};

const EMPTY_STOCK_FORM = {
  medication_id: '',
  quantity_added: '',
  purchase_price: '',
  notes: '',
};

export default function CuidadorWebPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const csrfTokenRef = useRef('');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Auth form states (campos vazios por padrão, sem expor credenciais)
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupNome, setSignupNome] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);

  // Data states
  const [patients, setPatients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [doseHistory, setDoseHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);

  // Modals & Mobile Sheets
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewMedModal, setShowNewMedModal] = useState(false);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showMobileMenuSheet, setShowMobileMenuSheet] = useState(false);
  const [showPatientPickerSheet, setShowPatientPickerSheet] = useState(false);

  // Form states (sem valores clínicos pré-definidos)
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [newPatientForm, setNewPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [confirmPatientSave, setConfirmPatientSave] = useState(false);

  const [newMedForm, setNewMedForm] = useState(EMPTY_MED_FORM);
  const [confirmMedSave, setConfirmMedSave] = useState(false);

  const [selectedDoseTarget, setSelectedDoseTarget] = useState(null);
  const [doseAdministeredTime, setDoseAdministeredTime] = useState('');
  const [doseActionReason, setDoseActionReason] = useState('');
  const [confirmDoseSave, setConfirmDoseSave] = useState(false);

  const [newAppointmentForm, setNewAppointmentForm] = useState(EMPTY_APPOINTMENT_FORM);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM);
  const [confirmStockSave, setConfirmStockSave] = useState(false);

  // Filter states
  const [searchPatient, setSearchPatient] = useState('');
  const [doseStatusFilter, setDoseStatusFilter] = useState('all');

  const showToast = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const syncCsrfToken = useCallback((explicitToken) => {
    const fromCookie = readCookieValue('medicare_csrf_token');
    const resolved = explicitToken || fromCookie || csrfTokenRef.current || '';
    csrfTokenRef.current = resolved;
    return resolved;
  }, []);

  const clearClientSession = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    csrfTokenRef.current = '';
    setPatients([]);
    setMedications([]);
    setDoseHistory([]);
    setAppointments([]);
    setAuditLogs([]);
    setApprovalRequests([]);
    setSelectedPatientId(null);
    try {
      localStorage.removeItem('medicare_cuidador_jwt');
      localStorage.removeItem('medicare_cuidador_refresh_token');
      localStorage.removeItem('medicare_cuidador_user');
      document.cookie = 'medicare_cuidador_logged_in=; path=/; max-age=0; SameSite=Lax';
    } catch {
      // ignore storage errors
    }
  }, []);

  // Helper centralizado de requisição autenticada via cookies HttpOnly + proteção CSRF
  const apiFetch = useCallback(
    async (url, options = {}, isRetry = false) => {
      const method = (options.method || 'GET').toUpperCase();
      const headers = new Headers(options.headers || {});
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrf = syncCsrfToken();
        if (csrf) {
          headers.set('X-CSRF-Token', csrf);
        }
      }

      const res = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
      });

      if (res.status === 401 && !isRetry && !url.includes('/api/auth/v1/token')) {
        const refreshRes = await fetch('/api/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(syncCsrfToken() ? { 'X-CSRF-Token': syncCsrfToken() } : {}),
          },
          body: JSON.stringify({}),
          credentials: 'same-origin',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => ({}));
          syncCsrfToken(refreshData.csrf_token);
          if (refreshData.user) {
            setCurrentUser(refreshData.user);
          }
          setIsAuthenticated(true);
          return apiFetch(url, options, true);
        } else {
          clearClientSession();
        }
      }

      return res;
    },
    [syncCsrfToken, clearClientSession]
  );

  // Inicialização: limpa tokens legados do localStorage e valida sessão via cookie HttpOnly
  useEffect(() => {
    let active = true;

    async function verifySession() {
      const legacyJwt = localStorage.getItem('medicare_cuidador_jwt');
      const legacyRefresh = localStorage.getItem('medicare_cuidador_refresh_token');
      // Remove tokens sensíveis do localStorage para eliminar exposição a XSS
      localStorage.removeItem('medicare_cuidador_jwt');
      localStorage.removeItem('medicare_cuidador_refresh_token');
      localStorage.removeItem('medicare_cuidador_user');

      syncCsrfToken();

      try {
        const res = await fetch('/api/auth/v1/user', {
          method: 'GET',
          headers: legacyJwt ? { Authorization: `Bearer ${legacyJwt}` } : {},
          credentials: 'same-origin',
        });

        if (res.ok) {
          const userData = await res.json().catch(() => null);
          if (active && userData?.id) {
            syncCsrfToken(userData.csrf_token);
            // Se veio de um token legado em localStorage, converte imediatamente para sessão HttpOnly via refresh
            if (legacyRefresh && !readCookieValue('medicare_csrf_token')) {
              const migRes = await fetch('/api/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: legacyRefresh }),
                credentials: 'same-origin',
              });
              if (migRes.ok) {
                const migData = await migRes.json().catch(() => ({}));
                syncCsrfToken(migData.csrf_token);
              }
            }
            setCurrentUser(userData);
            setIsAuthenticated(true);
            setAuthChecking(false);
            return;
          }
        }

        // Tenta renovar via cookie HttpOnly de refresh_token (ou legacyRefresh se em transição)
        const refreshRes = await fetch('/api/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(legacyRefresh ? { refresh_token: legacyRefresh } : {}),
          credentials: 'same-origin',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (active && refreshData?.user) {
            syncCsrfToken(refreshData.csrf_token);
            setCurrentUser(refreshData.user);
            setIsAuthenticated(true);
            setAuthChecking(false);
            return;
          }
        }

        if (active) {
          clearClientSession();
        }
      } catch {
        if (active) {
          clearClientSession();
        }
      } finally {
        if (active) {
          setAuthChecking(false);
        }
      }
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [syncCsrfToken, clearClientSession]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
        credentials: 'same-origin',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível entrar. Verifique seu e-mail e senha.');
      }

      syncCsrfToken(data.csrf_token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setLoginPassword('');
      showToast('Bem-vindo ao MediCare Cuidador!');
    } catch (err) {
      setAuthError(err.message || 'E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError(null);

    if (!signupNome.trim()) {
      setAuthError('Informe seu nome completo.');
      return;
    }
    if (signupPassword.length < 6) {
      setAuthError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setAuthError('As senhas digitadas não coincidem.');
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch('/api/auth/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
          data: {
            nome: signupNome.trim(),
            role: 'cuidador',
          },
        }),
        credentials: 'same-origin',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível cadastrar. Verifique os dados informados.');
      }

      const resolvedUser = data.user || {
        email: signupEmail.trim().toLowerCase(),
        user_metadata: { nome: signupNome.trim(), role: 'cuidador' },
      };
      syncCsrfToken(data.csrf_token);
      setCurrentUser(resolvedUser);
      setIsAuthenticated(true);
      setSignupPassword('');
      setSignupConfirmPassword('');
      showToast('Conta de Cuidador criada com sucesso!');
    } catch (err) {
      setAuthError(err.message || 'Erro ao criar conta de cuidador.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecoverPassword = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await fetch('/api/auth/v1/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail.trim().toLowerCase() }),
      });
      setRecoverSent(true);
    } catch {
      setRecoverSent(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/v1/logout', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      // ignore network error on logout
    }
    clearClientSession();
    showToast('Sessão encerrada com segurança.');
  };

  // Carrega dados do cuidador e pacientes autorizados (somente vínculos ativos!)
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [relRes, profRes] = await Promise.all([
        apiFetch('/api/rest/v1/caregiver_relationships?status=eq.active&select=*'),
        apiFetch('/api/rest/v1/profiles?limit=50'),
      ]);

      const rels = relRes.ok ? await relRes.json().catch(() => []) : [];
      const profs = profRes.ok ? await profRes.json().catch(() => []) : [];

      // Somente pacientes com vínculo ativo autorizado em caregiver_relationships são exibidos.
      // Nenhum perfil sem relacionamento explícito é listado como acompanhado.
      const activeRels = Array.isArray(rels)
        ? rels.filter((r) => r && r.status === 'active' && r.patient_id)
        : [];

      const patientList = activeRels.map((r) => {
        const prof = Array.isArray(profs) ? profs.find((p) => p.id === r.patient_id) : null;
        return {
          relationship_id: r.id,
          patient_id: r.patient_id,
          nome: prof?.nome || 'Paciente Vinculado',
          blood_type: prof?.blood_type || null,
          dob: prof?.dob || null,
          relationship_label: r.relationship_label || 'Familiar / Acompanhado',
          permission_level: r.permission_level || 'read_write',
          is_managed: Boolean(prof?.is_managed),
        };
      });

      setPatients(patientList);

      const validTargetId =
        selectedPatientId && patientList.some((p) => p.patient_id === selectedPatientId)
          ? selectedPatientId
          : patientList[0]?.patient_id || null;

      if (validTargetId !== selectedPatientId) {
        setSelectedPatientId(validTargetId);
      }

      if (validTargetId) {
        const [medsRes, histRes, eventsRes, logsRes, approvalsRes] = await Promise.all([
          apiFetch(`/api/rest/v1/medicamentos?user_id=eq.${validTargetId}&ativo=eq.true&order=created_at.asc`),
          apiFetch(`/api/rest/v1/historico_doses?user_id=eq.${validTargetId}&order=created_at.desc&limit=100`),
          apiFetch(`/api/rest/v1/health_events?user_id=eq.${validTargetId}&order=date.asc`),
          apiFetch('/api/rest/v1/rpc/list_audit_logs', {
            method: 'POST',
            body: JSON.stringify({ p_patient_id: validTargetId, p_limit: 30 }),
          }),
          apiFetch(`/api/rest/v1/approval_requests?patient_id=eq.${validTargetId}&status=eq.pending&order=created_at.desc`),
        ]);

        const meds = medsRes.ok ? await medsRes.json().catch(() => []) : [];
        const hist = histRes.ok ? await histRes.json().catch(() => []) : [];
        const events = eventsRes.ok ? await eventsRes.json().catch(() => []) : [];
        const logs = logsRes.ok ? await logsRes.json().catch(() => []) : [];
        const approvals = approvalsRes.ok ? await approvalsRes.json().catch(() => []) : [];

        setMedications(Array.isArray(meds) ? meds : []);
        setDoseHistory(Array.isArray(hist) ? hist : []);
        setAppointments(Array.isArray(events) ? events : []);
        setAuditLogs(Array.isArray(logs) ? logs : []);
        setApprovalRequests(Array.isArray(approvals) ? approvals : []);
      } else {
        setMedications([]);
        setDoseHistory([]);
        setAppointments([]);
        setAuditLogs([]);
        setApprovalRequests([]);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedPatientId, apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aceitar convite
  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/accept_caregiver_invite', {
        method: 'POST',
        body: JSON.stringify({ p_token: inviteTokenInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Convite inválido ou expirado');
      }
      showToast('Paciente vinculado com sucesso!');
      setShowInviteModal(false);
      setInviteTokenInput('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cadastrar Paciente Gerenciado (sem valores clínicos pré-definidos + validação + confirmação)
  const handleCreateManagedPatient = async (e) => {
    e.preventDefault();
    if (!newPatientForm.nome.trim() || newPatientForm.nome.trim().length < 2) {
      showToast('Informe o nome completo do paciente.', 'error');
      return;
    }
    if (!newPatientForm.relationship_label.trim()) {
      showToast('Informe o vínculo ou parentesco com o paciente.', 'error');
      return;
    }
    if (newPatientForm.dob) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (newPatientForm.dob > todayIso) {
        showToast('A data de nascimento não pode ser no futuro.', 'error');
        return;
      }
    }
    if (!confirmPatientSave) {
      showToast('Confirme que revisou os dados clínicos do paciente antes de salvar.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/create_managed_patient', {
        method: 'POST',
        body: JSON.stringify({
          p_nome: newPatientForm.nome.trim(),
          p_relationship_label: newPatientForm.relationship_label.trim(),
          p_blood_type: newPatientForm.blood_type || null,
          p_dob: newPatientForm.dob || null,
          p_phone: newPatientForm.phone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao cadastrar paciente dependente');
      }
      showToast('Paciente cadastrado com sucesso!');
      setShowNewPatientModal(false);
      setNewPatientForm(EMPTY_PATIENT_FORM);
      setConfirmPatientSave(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Revogar Cuidador
  const handleRevokeRelationship = async (relId) => {
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/revoke_caregiver', {
        method: 'POST',
        body: JSON.stringify({ p_relationship_id: relId }),
      });
      const ok = await res.json().catch(() => false);
      if (res.ok && ok) {
        showToast('Vínculo revogado com sucesso.');
        if (patients.find((p) => p.relationship_id === relId)?.patient_id === selectedPatientId) {
          setSelectedPatientId(null);
        }
        loadData();
      } else {
        throw new Error('Não foi possível revogar o vínculo.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cadastrar Medicamento (sem valores pré-definidos + validação + confirmação)
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    const nomeTrim = newMedForm.nome.trim();
    const dosagemTrim = newMedForm.dosagem.trim();
    const unidadeTrim = newMedForm.unidade.trim();
    const qtdNum = Number(newMedForm.quantidade);
    const horariosArr = newMedForm.horarios
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!nomeTrim) {
      showToast('Informe o nome do medicamento.', 'error');
      return;
    }
    if (!dosagemTrim) {
      showToast('Informe a dosagem prescrita (ex: 50mg, 10ml).', 'error');
      return;
    }
    if (!unidadeTrim) {
      showToast('Selecione a unidade farmacêutica.', 'error');
      return;
    }
    if (!Number.isFinite(qtdNum) || qtdNum < 0 || newMedForm.quantidade === '') {
      showToast('Informe uma quantidade de estoque inicial válida.', 'error');
      return;
    }
    if (horariosArr.length === 0 || !horariosArr.every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))) {
      showToast('Informe horários válidos no formato HH:MM (ex: 08:00, 20:00).', 'error');
      return;
    }
    if (!confirmMedSave) {
      showToast('Confirme que revisou a prescrição antes de salvar o medicamento.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/medicamentos', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedPatientId,
          nome: nomeTrim,
          principio_ativo: newMedForm.principio_ativo.trim() || null,
          active_ingredient: newMedForm.principio_ativo.trim() || null,
          dosagem: dosagemTrim,
          unidade: unidadeTrim,
          quantidade: Math.round(qtdNum),
          horarios: horariosArr,
          treatment_type: newMedForm.treatment_type,
          ativo: true,
          status: 'ativo',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao salvar medicamento');
      }
      showToast('Medicamento cadastrado com sucesso!');
      setShowNewMedModal(false);
      setNewMedForm(EMPTY_MED_FORM);
      setConfirmMedSave(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar Administração de Dose como Cuidador ou Marcar como Não Administrada
  const handleConfirmDose = async (status) => {
    if (!selectedDoseTarget || !selectedPatientId) return;

    const reasonTrim = doseActionReason.trim();
    if (status === 'missed' && !reasonTrim) {
      showToast('Informe o motivo clínico pelo qual a dose não foi administrada.', 'error');
      return;
    }
    if (status === 'confirmed' && !doseAdministeredTime) {
      showToast('Informe o horário real em que a dose foi administrada.', 'error');
      return;
    }
    if (!confirmDoseSave) {
      showToast('Confirme os dados do registro antes de salvar.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await apiFetch('/api/rest/v1/rpc/confirm_dose_retroactive', {
        method: 'POST',
        body: JSON.stringify({
          p_patient_id: selectedPatientId,
          p_med_id: selectedDoseTarget.med_id,
          p_hora: selectedDoseTarget.hora,
          p_dose_date: todayIso,
          p_administered_time: status === 'confirmed' ? doseAdministeredTime : null,
          p_new_status: status,
          p_reason:
            reasonTrim ||
            (status === 'confirmed' ? 'Administrada pelo cuidador' : 'Dose não administrada'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao registrar dose');
      }
      showToast(
        status === 'confirmed'
          ? 'Administração registrada pelo cuidador!'
          : 'Dose registrada como não administrada.'
      );
      setShowDoseModal(false);
      setSelectedDoseTarget(null);
      setDoseAdministeredTime('');
      setDoseActionReason('');
      setConfirmDoseSave(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Aprovar ou Rejeitar solicitação de dose enviada pelo paciente dependente
  const handleResolveApprovalRequest = async (reqId, decision) => {
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/resolve_dose_approval', {
        method: 'POST',
        body: JSON.stringify({
          p_request_id: reqId,
          p_decision: decision,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao validar solicitação');
      }
      showToast(
        decision === 'approved'
          ? 'Solicitação do paciente aprovada!'
          : 'Solicitação do paciente recusada.'
      );
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cadastrar Compromisso / Consulta
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    if (!newAppointmentForm.title.trim() || !newAppointmentForm.date || !newAppointmentForm.time) {
      showToast('Preencha o título, a data e o horário do compromisso.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/health_events', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedPatientId,
          type: newAppointmentForm.type,
          title: newAppointmentForm.title.trim(),
          date: newAppointmentForm.date,
          time: newAppointmentForm.time,
          doctor: newAppointmentForm.doctor.trim() || null,
          location: newAppointmentForm.location.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar compromisso');
      }
      showToast('Compromisso agendado com sucesso!');
      setShowAppointmentModal(false);
      setNewAppointmentForm(EMPTY_APPOINTMENT_FORM);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar Reposição de Estoque
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!stockForm.medication_id) {
      showToast('Selecione o medicamento.', 'error');
      return;
    }
    const addedQty = Number(stockForm.quantity_added);
    if (!Number.isFinite(addedQty) || addedQty <= 0) {
      showToast('Informe uma quantidade adicionada maior que zero.', 'error');
      return;
    }
    if (!confirmStockSave) {
      showToast('Confirme os dados da reposição de estoque antes de salvar.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const med = medications.find((m) => m.id === stockForm.medication_id);
      const beforeQty = med ? Number(med.quantidade || 0) : 0;
      const afterQty = beforeQty + Math.round(addedQty);

      const res = await apiFetch('/api/rest/v1/rpc/record_stock_movement', {
        method: 'POST',
        body: JSON.stringify({
          p_medication_id: stockForm.medication_id,
          p_movement_type: 'purchase',
          p_quantity_before: beforeQty,
          p_quantity_after: afterQty,
          p_purchase_price: stockForm.purchase_price ? Number(stockForm.purchase_price) : null,
          p_notes: stockForm.notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao registrar estoque');
      }
      showToast('Estoque atualizado com sucesso!');
      setShowStockModal(false);
      setStockForm(EMPTY_STOCK_FORM);
      setConfirmStockSave(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Doses do dia com distinção semântica precisa entre os 5 estados
  const todayDoses = [];
  const nowObj = new Date();
  const todayIso = nowObj.toISOString().slice(0, 10);
  const currentMinutesOfDay = nowObj.getHours() * 60 + nowObj.getMinutes();

  medications.forEach((med) => {
    const horarios = Array.isArray(med.horarios) && med.horarios.length > 0 ? med.horarios : [];
    horarios.forEach((horaRaw) => {
      const hora = String(horaRaw || '').trim().slice(0, 5);
      if (!hora) return;
      const [hh, mm] = hora.split(':').map((n) => Number(n) || 0);
      const scheduledMinutes = hh * 60 + mm;

      const match = doseHistory.find((h) => {
        const hHora = String(h.hora || h.horario || '').trim().slice(0, 5);
        const hDate = h.dose_date
          ? String(h.dose_date).slice(0, 10)
          : String(h.created_at || '').slice(0, 10);
        return h.med_id === med.id && hHora === hora && hDate === todayIso;
      });

      const rawStatus = match ? match.status : 'pending';
      const delayMinutes = Number(match?.atraso_minutos || 0);
      const isCaregiverActor =
        match?.confirmed_by_role === 'cuidador' ||
        (match?.performed_by && match?.performed_by === currentUser?.id);
      const isUnconfirmedPast =
        rawStatus === 'pending' && currentMinutesOfDay > scheduledMinutes + 30;
      const isLateDose =
        rawStatus === 'late' || (rawStatus === 'confirmed' && delayMinutes > 15);

      let displayCategory = 'pending'; // 'patient_confirmed' | 'caregiver_confirmed' | 'late' | 'missed' | 'unconfirmed' | 'pending'
      let statusLabel = 'Prevista';

      if (rawStatus === 'missed') {
        displayCategory = 'missed';
        statusLabel = 'Não Administrada';
      } else if (rawStatus === 'confirmed' || rawStatus === 'late') {
        if (isCaregiverActor) {
          displayCategory = isLateDose ? 'late' : 'caregiver_confirmed';
          statusLabel = match?.is_retroactive
            ? 'Registrada (Cuidador • Retroativa)'
            : isLateDose
            ? `Registrada (Cuidador • +${delayMinutes} min)`
            : 'Registrada (Cuidador)';
        } else {
          displayCategory = isLateDose ? 'late' : 'patient_confirmed';
          statusLabel = isLateDose
            ? `Tomada c/ Atraso (+${delayMinutes} min)`
            : 'Tomada (Paciente)';
        }
      } else if (isUnconfirmedPast) {
        displayCategory = 'unconfirmed';
        statusLabel = 'Sem Confirmação';
      }

      todayDoses.push({
        id: `${med.id}-${hora}`,
        med_id: med.id,
        med_name: med.nome,
        dosagem: med.dosagem,
        unidade: med.unidade || 'unidade',
        hora,
        status: rawStatus === 'late' ? 'confirmed' : rawStatus,
        raw_status: rawStatus,
        display_category: displayCategory,
        status_label: statusLabel,
        performed_by: match?.performed_by || null,
        confirmed_by_name: match?.confirmed_by_name || null,
        confirmed_by_role: match?.confirmed_by_role || null,
        origin: match?.origin || null,
        is_retroactive: Boolean(match?.is_retroactive),
        atraso_minutos: delayMinutes,
        administered_at: match?.administered_at || null,
        recorded_at: match?.created_at || null,
        correction_reason: match?.correction_reason || match?.motivo || null,
        history_id: match?.id || null,
      });
    });
  });

  todayDoses.sort((a, b) => a.hora.localeCompare(b.hora));

  const totalDosesToday = todayDoses.length;
  const confirmedDosesToday = todayDoses.filter((d) => d.status === 'confirmed').length;
  const missedDosesToday = todayDoses.filter((d) => d.status === 'missed').length;
  const unconfirmedDosesToday = todayDoses.filter((d) => d.display_category === 'unconfirmed').length;
  const pendingDosesToday = todayDoses.filter((d) => d.status === 'pending').length;
  const adherenceRate =
    totalDosesToday > 0 ? Math.round((confirmedDosesToday / totalDosesToday) * 100) : 100;

  const selectedPatient =
    patients.find((p) => p.patient_id === selectedPatientId) || patients[0] || null;

  const navItems = [
    { id: 'dashboard', label: 'Central de Doses', mobileLabel: 'Doses', icon: Home },
    { id: 'patients', label: 'Pacientes', mobileLabel: 'Pacientes', icon: Users },
    { id: 'meds', label: 'Medicamentos & Estoque', mobileLabel: 'Remédios', icon: Pill },
    { id: 'agenda', label: 'Agenda', mobileLabel: 'Agenda', icon: Calendar },
    { id: 'reports', label: 'Indicadores', mobileLabel: 'Indicadores', icon: BarChart3 },
    { id: 'audit', label: 'Auditoria', mobileLabel: 'Auditoria', icon: History },
  ];

  const mobileNavItems = [
    { id: 'dashboard', label: 'Doses', icon: Home },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'meds', label: 'Remédios', icon: Pill },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
  ];

  const currentTabTitle =
    currentTab === 'dashboard'
      ? 'Central de Doses'
      : currentTab === 'patients'
      ? 'Pacientes e Vínculos'
      : currentTab === 'meds'
      ? 'Medicamentos & Estoque'
      : currentTab === 'agenda'
      ? 'Agenda Médica'
      : currentTab === 'reports'
      ? 'Indicadores de Adesão'
      : 'Trilha de Auditoria';

  // ─────────────────────────────────────────────────────────────
  // TELA DE LOGIN / CADASTRO DO CUIDADOR
  // ─────────────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center p-4 antialiased">
        <Loader2 size={32} className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-[420px] bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Logo / Header */}
          <div className="text-center mb-6">
            <Image
              src={medicareLogo}
              alt="MediCare Cuidador"
              width={52}
              height={52}
              priority
              referrerPolicy="no-referrer"
              className="mx-auto mb-3 w-[52px] h-[52px] rounded-2xl shadow-lg shadow-purple-900/30"
            />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {authMode === 'signup' ? 'Criar Conta de Cuidador' : 'Bem-vindo ao MediCare Cuidador'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
              {authMode === 'signup'
                ? 'Cadastre-se para gerenciar seus pacientes, acompanhar medicações e receber alertas.'
                : 'Acesse o painel para acompanhar os tratamentos e a rotina de saúde dos seus pacientes.'}
            </p>
          </div>

          {/* Alternador de Modo: Entrar / Criar Conta */}
          <div className="flex bg-[#0b1120] p-1 rounded-xl mb-5 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'signup'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Mensagem de Erro Acessível */}
          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 leading-snug"
            >
              <AlertCircle size={16} className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authMode === 'login' ? (
            /* Formulário de Login */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                  >
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRecoverModal(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Sua senha de acesso"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} className="w-4 h-4" /> : <Eye size={16} className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="w-4 h-4 animate-spin text-white" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-400">Não tem uma conta? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Criar conta de cuidador
                </button>
              </div>
            </form>
          ) : (
            /* Formulário de Cadastro de Cuidador */
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label
                  htmlFor="signup-nome"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Nome Completo
                </label>
                <div className="relative">
                  <User size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-nome"
                    type="text"
                    required
                    autoComplete="name"
                    value={signupNome}
                    onChange={(e) => setSignupNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <KeyRound size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Crie sua senha segura"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Ocultar senha' : 'Exibir senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
                  >
                    {showSignupPassword ? <EyeOff size={16} className="w-4 h-4" /> : <Eye size={16} className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-confirm-password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Confirmar Senha
                </label>
                <div className="relative">
                  <KeyRound size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="signup-confirm-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Confirme sua senha"
                    className="w-full bg-[#0b1120] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="w-4 h-4 animate-spin text-white" />
                    <span>Criando conta...</span>
                  </>
                ) : (
                  <span>Criar Conta de Cuidador</span>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-400">Já possui uma conta? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Entrar aqui
                </button>
              </div>
            </form>
          )}

          {/* Link "Voltar ao portal" */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <a
              href="/?portal=1"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-2 rounded-lg"
            >
              <ArrowLeft size={14} className="w-3.5 h-3.5" />
              <span>Voltar ao portal</span>
            </a>
          </div>
        </div>

        {/* Modal de Recuperação de Senha */}
        {showRecoverModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-base font-bold text-white mb-2">Recuperação de Senha</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Informe o seu e-mail cadastrado. Se houver uma conta associada, as instruções de redefinição serão processadas.
              </p>

              {recoverSent ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
                    Solicitação enviada. Verifique sua caixa de entrada e siga as orientações.
                  </div>
                  <button
                    onClick={() => {
                      setShowRecoverModal(false);
                      setRecoverSent(false);
                      setRecoverEmail('');
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecoverPassword} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRecoverModal(false)}
                      className="px-3 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                    >
                      {actionLoading ? 'Enviando...' : 'Enviar instruções'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PAINEL AUTENTICADO DO CUIDADOR (MOBILE-FIRST + DESKTOP)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col md:flex-row font-sans antialiased overflow-x-hidden">
      {/* Toast acessível */}
      {notification && (
        <div
          role="status"
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-sm px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all ${
            notification.type === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-200'
              : 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle size={16} className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-snug">{notification.msg}</span>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#101827] border-r border-slate-800/90 p-5 justify-between select-none shrink-0 sticky top-0 h-screen">
        <div>
          <div className="flex items-center gap-3 mb-7 px-1">
            <Image
              src={medicareLogo}
              alt="MediCare Cuidador"
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl shadow-md shadow-purple-900/30 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm leading-tight whitespace-nowrap">MediCare</div>
              <div className="text-[11px] text-blue-400 font-semibold tracking-wider whitespace-nowrap">Cuidador</div>
            </div>
          </div>

          {/* Seletor de Paciente Desktop */}
          <div className="mb-6">
            <label
              htmlFor="desktop-patient-select"
              className="block text-[11px] font-semibold text-slate-400 mb-1.5 px-1"
            >
              Paciente em acompanhamento
            </label>
            {patients.length === 0 ? (
              <div className="text-xs text-slate-400 bg-[#131d31] border border-slate-800 rounded-xl px-3 py-2.5">
                Nenhum paciente vinculado
              </div>
            ) : (
              <select
                id="desktop-patient-select"
                value={selectedPatientId || ''}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full bg-[#131d31] border border-slate-700/80 rounded-xl px-3 py-2.5 min-h-[42px] text-xs font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.nome} ({p.relationship_label})
                  </option>
                ))}
              </select>
            )}
          </div>

          <nav className="space-y-1" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon size={17} className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800/90 pt-4">
          <div className="mb-3 px-1 truncate">
            <div className="text-[11px] text-slate-400 font-medium">Conta conectada</div>
            <div className="text-xs font-semibold text-slate-200 truncate">{currentUser?.email || 'cuidador'}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[42px] text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <LogOut size={16} className="w-4 h-4 shrink-0" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Compacto (Mobile-First + Desktop) */}
        <header className="h-14 md:h-16 border-b border-slate-800/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 bg-[#0b1120]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src={medicareLogo}
              alt="MediCare Cuidador"
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="md:hidden w-8 h-8 rounded-lg shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-white truncate leading-tight">
                {currentTabTitle}
              </h2>
              {selectedPatient && currentTab !== 'patients' && (
                <p className="hidden md:block text-xs text-slate-400 truncate mt-0.5">
                  {selectedPatient.nome} · {selectedPatient.relationship_label}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Seletor rápido de paciente no Mobile */}
            {patients.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPatientPickerSheet(true)}
                className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] max-w-[155px] rounded-xl bg-[#131d31] border border-slate-700/80 text-xs font-semibold text-slate-100 hover:border-slate-600 transition-colors"
                aria-label="Selecionar paciente"
              >
                <span className="truncate">{selectedPatient?.nome?.split(' ')[0] || 'Paciente'}</span>
                <ChevronDown size={14} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              title="Atualizar dados"
              aria-label="Atualizar dados"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 min-w-[40px] min-h-[40px] px-2.5 md:px-3.5 rounded-xl bg-[#131d31] md:bg-slate-800/70 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RefreshCw size={15} className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden md:inline text-xs font-semibold">Atualizar</span>
            </button>
          </div>
        </header>

        {/* Sub-navegação mobile entre Indicadores e Auditoria */}
        {(currentTab === 'reports' || currentTab === 'audit') && (
          <div className="md:hidden px-4 pt-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#131d31] border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setCurrentTab('reports')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'reports'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Indicadores
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('audit')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'audit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Auditoria
              </button>
            </div>
          </div>
        )}

        {/* Tab Body */}
        <main className="flex-1 px-4 py-5 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-24 md:pb-10">
          {/* Estado vazio quando não há paciente com vínculo ativo */}
          {patients.length === 0 && currentTab !== 'patients' && (
            <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-10 text-center space-y-5 mb-6 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
                <Users size={22} className="w-5 h-5" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight [text-wrap:balance]">
                  Nenhum paciente vinculado no momento
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Por segurança clínica, o MediCare exibe apenas pacientes com vínculo ativo autorizado. Aceite um código de convite gerado pelo paciente ou cadastre um familiar dependente.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-colors whitespace-nowrap"
                >
                  <KeyRound size={15} className="w-4 h-4 text-amber-400" />
                  <span>Aceitar Convite</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewPatientForm(EMPTY_PATIENT_FORM);
                    setConfirmPatientSave(false);
                    setShowNewPatientModal(true);
                  }}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap"
                >
                  <UserPlus size={15} className="w-4 h-4" />
                  <span>Cadastrar Dependente</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: CENTRAL DE DOSES */}
          {currentTab === 'dashboard' && selectedPatient && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#131d31] p-5 sm:p-6 rounded-2xl border border-slate-800/90">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    {selectedPatient.nome}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                    <span>
                      Vínculo: <strong className="text-slate-200 font-semibold">{selectedPatient.relationship_label}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Tipo sanguíneo: <strong className="text-slate-200 font-semibold">{selectedPatient.blood_type || 'Não informado'}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setNewMedForm(EMPTY_MED_FORM);
                      setConfirmMedSave(false);
                      setShowNewMedModal(true);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Plus size={15} className="w-4 h-4 shrink-0" />
                    <span>Medicamento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAppointmentForm(EMPTY_APPOINTMENT_FORM);
                      setShowAppointmentModal(true);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                  >
                    <Calendar size={15} className="w-4 h-4 shrink-0" />
                    <span>Compromisso</span>
                  </button>
                </div>
              </div>

              {/* Solicitações Pendentes de Validação do Paciente */}
              {approvalRequests.length > 0 && (
                <div className="bg-amber-950/25 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <AlertTriangle size={16} className="w-4 h-4 shrink-0" />
                    <span>Solicitações aguardando validação ({approvalRequests.length})</span>
                  </div>
                  <div className="space-y-3">
                    {approvalRequests.map((reqItem) => {
                      const isUndo = reqItem.action_type === 'undo_dose' || reqItem.requested_status === 'pending';
                      return (
                        <div
                          key={reqItem.id}
                          className="bg-[#131d31] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span className="font-bold text-white">
                                {reqItem.med_nome || 'Medicamento'} ({reqItem.hora})
                              </span>
                              <span aria-hidden="true" className="text-slate-500">·</span>
                              <span className="text-amber-300 font-semibold">
                                {isUndo ? 'Desfazer dose' : 'Confirmar dose'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Motivo do paciente: <strong>&ldquo;{reqItem.reason || 'Não informado'}&rdquo;</strong>
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleResolveApprovalRequest(reqItem.id, 'approved')}
                              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Check size={14} className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleResolveApprovalRequest(reqItem.id, 'rejected')}
                              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <X size={14} className="w-3.5 h-3.5" />
                              <span>Recusar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* KPIs de Administração */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#131d31] p-4 sm:p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-slate-400 text-xs font-medium mb-1">Doses hoje</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">{totalDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Programadas no dia</div>
                </div>

                <div className="bg-[#131d31] p-4 sm:p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-slate-400 text-xs font-medium mb-1">Confirmadas</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">{confirmedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Paciente ou cuidador</div>
                </div>

                <div className="bg-[#131d31] p-4 sm:p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-slate-400 text-xs font-medium mb-1">Sem confirmação</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">{unconfirmedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    {pendingDosesToday} pendente(s) no total
                  </div>
                </div>

                <div className="bg-[#131d31] p-4 sm:p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-slate-400 text-xs font-medium mb-1">Não administradas</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 tabular-nums">{missedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Com justificativa clínica</div>
                </div>
              </div>

              {/* Lista de Doses do Dia */}
              <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-white">Linha do Tempo de Doses</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Horário previsto, horário real da administração e registro clínico
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b1120] p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'pending', label: 'Pendentes' },
                      { id: 'confirmed', label: 'Confirmadas' },
                      { id: 'missed', label: 'Não administradas' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setDoseStatusFilter(st.id)}
                        className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          doseStatusFilter === st.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {todayDoses.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <p className="text-slate-400 text-sm">
                      Nenhum medicamento ativo programado para este paciente hoje.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMedForm(EMPTY_MED_FORM);
                        setConfirmMedSave(false);
                        setShowNewMedModal(true);
                      }}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Plus size={15} className="w-4 h-4" />
                      <span>Cadastrar Primeiro Medicamento</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {todayDoses
                      .filter((d) => doseStatusFilter === 'all' || d.status === doseStatusFilter)
                      .map((dose) => {
                        const administeredTimeStr = dose.administered_at
                          ? new Date(dose.administered_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : null;
                        const recordedTimeStr = dose.recorded_at
                          ? new Date(dose.recorded_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : null;

                        return (
                          <div
                            key={dose.id}
                            className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                          >
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              <div
                                className={`w-14 h-12 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm border shrink-0 tabular-nums font-mono ${
                                  dose.status === 'confirmed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : dose.status === 'missed'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    : dose.display_category === 'unconfirmed'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800/70 text-slate-200 border-slate-700'
                                }`}
                              >
                                <span>{dose.hora}</span>
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="font-bold text-white text-sm">{dose.med_name}</span>
                                  <span className="text-xs text-slate-400">{dose.dosagem}</span>
                                  <span aria-hidden="true" className="text-slate-600">·</span>
                                  <span
                                    className={`text-xs font-semibold ${
                                      dose.display_category === 'patient_confirmed'
                                        ? 'text-emerald-400'
                                        : dose.display_category === 'caregiver_confirmed'
                                        ? 'text-blue-400'
                                        : dose.display_category === 'late' || dose.display_category === 'unconfirmed'
                                        ? 'text-amber-300'
                                        : dose.display_category === 'missed'
                                        ? 'text-rose-400'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {dose.status_label}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 tabular-nums">
                                  <span>
                                    Previsto <strong className="text-slate-300 font-medium">{dose.hora}</strong>
                                  </span>
                                  {administeredTimeStr && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        Administrado <strong className="text-slate-300 font-medium">{administeredTimeStr}</strong>
                                      </span>
                                    </>
                                  )}
                                  {recordedTimeStr && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        Registrado <strong className="text-slate-300 font-medium">{recordedTimeStr}</strong>
                                      </span>
                                    </>
                                  )}
                                  {dose.confirmed_by_name && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        Autor: <strong className="text-slate-300 font-medium">{dose.confirmed_by_name}</strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                                {dose.correction_reason && (
                                  <div className="text-xs text-slate-400">
                                    Obs.: <span className="text-slate-300">{dose.correction_reason}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDoseTarget(dose);
                                  setDoseAdministeredTime(dose.hora);
                                  setDoseActionReason('');
                                  setConfirmDoseSave(false);
                                  setShowDoseModal(true);
                                }}
                                className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                              >
                                Registrar Ação
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PACIENTES */}
          {currentTab === 'patients' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Pacientes Acompanhados</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Gerencie vínculos ativos autorizados, convites ou cadastre familiares dependentes.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <KeyRound size={15} className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Aceitar Convite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPatientForm(EMPTY_PATIENT_FORM);
                      setConfirmPatientSave(false);
                      setShowNewPatientModal(true);
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                  >
                    <UserPlus size={15} className="w-4 h-4 shrink-0" />
                    <span>Novo Paciente</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={16} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  placeholder="Pesquisar paciente vinculado..."
                  className="w-full bg-[#131d31] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {patients.length === 0 ? (
                <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-8 text-center text-slate-400 text-sm">
                  Nenhum paciente com vínculo ativo encontrado para esta conta de cuidador.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {patients
                    .filter((p) => p.nome.toLowerCase().includes(searchPatient.toLowerCase()))
                    .map((p) => (
                      <div
                        key={p.patient_id}
                        onClick={() => setSelectedPatientId(p.patient_id)}
                        className={`bg-[#131d31] p-5 rounded-2xl border transition-all cursor-pointer ${
                          selectedPatientId === p.patient_id
                            ? 'border-blue-500 ring-1 ring-blue-500/40'
                            : 'border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm shrink-0">
                              {p.nome.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-white text-sm truncate">{p.nome}</h3>
                              <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400 mt-0.5">
                                <span className="text-slate-300 font-medium">{p.relationship_label}</span>
                                <span aria-hidden="true">·</span>
                                <span>{p.blood_type || 'Tipo sanguíneo N/I'}</span>
                                {p.is_managed && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-amber-400 font-semibold">Dependente</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevokeRelationship(p.relationship_id);
                            }}
                            title="Revogar acompanhamento"
                            aria-label={`Revogar vínculo com ${p.nome}`}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                          >
                            <Trash2 size={16} className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEDICAMENTOS & ESTOQUE */}
          {currentTab === 'meds' && selectedPatient && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Prescrições e Estoque</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Tratamentos ativos de {selectedPatient.nome}.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setStockForm(EMPTY_STOCK_FORM);
                      setConfirmStockSave(false);
                      setShowStockModal(true);
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Package size={15} className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Repor Estoque</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMedForm(EMPTY_MED_FORM);
                      setConfirmMedSave(false);
                      setShowNewMedModal(true);
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                  >
                    <Plus size={15} className="w-4 h-4 shrink-0" />
                    <span>Novo Medicamento</span>
                  </button>
                </div>
              </div>

              {medications.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[#131d31] rounded-2xl border border-slate-800/90 space-y-3">
                  <p className="text-slate-400 text-sm">
                    Nenhum medicamento ativo cadastrado para {selectedPatient.nome}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMedForm(EMPTY_MED_FORM);
                      setConfirmMedSave(false);
                      setShowNewMedModal(true);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Plus size={15} className="w-4 h-4" />
                    <span>Adicionar Medicamento</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {medications.map((med) => {
                    const horarios = Array.isArray(med.horarios) ? med.horarios : [];
                    const dosesPerDay = Math.max(1, horarios.length);
                    const daysRemaining = Math.floor(Number(med.quantidade || 0) / dosesPerDay);
                    const isLowStock = Number(med.quantidade || 0) <= 5;
                    const treatmentLabel =
                      med.treatment_type === 'continuous'
                        ? 'Contínuo'
                        : med.treatment_type === 'sos'
                        ? 'SOS'
                        : 'Temporário';

                    return (
                      <div key={med.id} className="bg-[#131d31] p-5 rounded-2xl border border-slate-800/90 flex flex-col justify-between gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                              <Pill size={18} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-white text-sm sm:text-base truncate">{med.nome}</h3>
                              <p className="text-xs text-slate-400 truncate">
                                {med.dosagem} · {med.unidade || 'unidade'} · {treatmentLabel}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="tabular-nums">
                            <span className="text-slate-400">Horários: </span>
                            <span className="font-semibold text-white font-mono">
                              {horarios.length > 0 ? horarios.join(', ') : 'Não definido'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-slate-400">Estoque:</span>
                            <span
                              className={`font-bold ${
                                isLowStock ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {med.quantidade} un ({daysRemaining}d)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AGENDA */}
          {currentTab === 'agenda' && selectedPatient && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Agenda Médica</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Consultas e exames de {selectedPatient.nome}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewAppointmentForm(EMPTY_APPOINTMENT_FORM);
                    setShowAppointmentModal(true);
                  }}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                >
                  <Plus size={15} className="w-4 h-4" />
                  <span>Novo Compromisso</span>
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[#131d31] rounded-2xl border border-slate-800/90 space-y-3">
                  <p className="text-slate-400 text-sm">
                    Nenhum compromisso clínico agendado para {selectedPatient.nome}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAppointmentForm(EMPTY_APPOINTMENT_FORM);
                      setShowAppointmentModal(true);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Calendar size={15} className="w-4 h-4" />
                    <span>Agendar Consulta ou Exame</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-[#131d31] p-5 rounded-2xl border border-slate-800/90 flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Calendar size={18} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <h3 className="font-bold text-white text-sm">{apt.title}</h3>
                          <span className="text-xs text-indigo-300 font-semibold capitalize">
                            · {apt.type}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 tabular-nums">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="w-3.5 h-3.5 text-slate-500" />
                            {apt.date} {apt.time ? `às ${apt.time}` : ''}
                          </span>
                          {apt.doctor && (
                            <span className="flex items-center gap-1">
                              <User size={13} className="w-3.5 h-3.5 text-slate-500" />
                              {apt.doctor}
                            </span>
                          )}
                          {apt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={13} className="w-3.5 h-3.5 text-slate-500" />
                              {apt.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: INDICADORES */}
          {currentTab === 'reports' && selectedPatient && (
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Indicadores de Adesão</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Métricas reais de acompanhamento para {selectedPatient.nome}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                    <span>Taxa geral de adesão</span>
                    <TrendingUp size={16} className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white tabular-nums">{adherenceRate}%</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Doses tomadas em relação ao previsto hoje
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                    <span>Doses confirmadas</span>
                    <CheckCircle2 size={16} className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white tabular-nums">{confirmedDosesToday}</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Confirmadas pelo paciente ou cuidador
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800/90">
                  <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                    <span>Não administradas</span>
                    <AlertTriangle size={16} className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-amber-400 tabular-nums">{missedDosesToday}</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Com justificativa clínica arquivada
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDITORIA */}
          {currentTab === 'audit' && selectedPatient && (
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Trilha de Auditoria</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Registros imutáveis com autor, origem, data e justificativa clínica.
                </p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-10 bg-[#131d31] rounded-2xl border border-slate-800/90 text-slate-400 text-sm">
                  Nenhum registro de auditoria arquivado para este paciente.
                </div>
              ) : (
                <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 divide-y divide-slate-800/80">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 sm:p-5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-blue-400">{log.action}</span>
                        <span className="text-slate-400 tabular-nums">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        Motivo: <strong className="text-white font-medium">{log.reason || 'Ajuste registrado'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MOBILE SHEET: SELETOR DE PACIENTE                          */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showPatientPickerSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowPatientPickerSheet(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-5 sm:p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Selecionar Paciente</h3>
              <button
                type="button"
                onClick={() => setShowPatientPickerSheet(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {patients.map((p) => {
                const isSelected = p.patient_id === selectedPatientId;
                return (
                  <button
                    key={p.patient_id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.patient_id);
                      setShowPatientPickerSheet(false);
                    }}
                    className={`w-full min-h-[52px] flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/50 text-white'
                        : 'bg-[#0b1120] border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{p.nome}</div>
                      <div className="text-xs text-slate-400 truncate">{p.relationship_label}</div>
                    </div>
                    {isSelected && <Check size={16} className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MOBILE SHEET: MAIS OPÇÕES (INDICADORES, AUDITORIA, CONTA)  */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showMobileMenuSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:hidden"
          onClick={() => setShowMobileMenuSheet(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl border-t border-slate-800 p-5 pb-8 w-full shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Mais recursos</h3>
                <p className="text-xs text-slate-400 truncate">{currentUser?.email || 'cuidador'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenuSheet(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
                aria-label="Fechar menu"
              >
                <X size={18} className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('reports');
                  setShowMobileMenuSheet(false);
                }}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0b1120] border border-slate-800 text-slate-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <BarChart3 size={18} className="w-4 h-4 text-blue-400" />
                  Indicadores de Adesão
                </span>
                <ChevronRight size={16} className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTab('audit');
                  setShowMobileMenuSheet(false);
                }}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0b1120] border border-slate-800 text-slate-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <History size={18} className="w-4 h-4 text-indigo-400" />
                  Trilha de Auditoria
                </span>
                <ChevronRight size={16} className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenuSheet(false);
                  setShowInviteModal(true);
                }}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0b1120] border border-slate-800 text-slate-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <KeyRound size={18} className="w-4 h-4 text-amber-400" />
                  Aceitar Código de Convite
                </span>
                <ChevronRight size={16} className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenuSheet(false);
                  setNewPatientForm(EMPTY_PATIENT_FORM);
                  setConfirmPatientSave(false);
                  setShowNewPatientModal(true);
                }}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0b1120] border border-slate-800 text-slate-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <UserPlus size={18} className="w-4 h-4 text-emerald-400" />
                  Cadastrar Dependente
                </span>
                <ChevronRight size={16} className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenuSheet(false);
                  handleLogout();
                }}
                className="w-full min-h-[50px] flex items-center justify-center gap-2 px-4 py-3 mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold"
              >
                <LogOut size={16} className="w-4 h-4" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: ACEITAR CONVITE                                     */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-1">Aceitar Código de Convite</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Informe o código de convite gerado pelo paciente em seu aplicativo Android MediCare.
            </p>
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <input
                type="text"
                required
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                placeholder="Código de convite"
                className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO PACIENTE DEPENDENTE                            */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-1">Cadastrar Paciente Dependente</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Preencha os dados reais do paciente. Nenhum valor clínico é preenchido automaticamente.
            </p>
            <form onSubmit={handleCreateManagedPatient} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newPatientForm.nome}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, nome: e.target.value })}
                  placeholder="Nome completo do paciente"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Parentesco / Vínculo *</label>
                  <input
                    type="text"
                    required
                    value={newPatientForm.relationship_label}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, relationship_label: e.target.value })}
                    placeholder="Ex: Mãe, Pai, Filho"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Tipo Sanguíneo (opcional)</label>
                  <select
                    value={newPatientForm.blood_type}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, blood_type: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  >
                    <option value="">Não informado</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Data de Nascimento (opcional)</label>
                  <input
                    type="date"
                    value={newPatientForm.dob}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Telefone (opcional)</label>
                  <input
                    type="tel"
                    value={newPatientForm.phone}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmPatientSave}
                  onChange={(e) => setConfirmPatientSave(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0b1120] text-blue-600 focus:ring-blue-500"
                />
                <span>Confirmo que conferi os dados clínicos e autorizo o cadastro deste paciente dependente.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !confirmPatientSave}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Cadastrando...' : 'Cadastrar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO MEDICAMENTO                                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNewMedModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-1">Cadastrar Medicamento</h3>
            <p className="text-xs text-slate-400 mb-4">
              Prescrição para <strong>{selectedPatient?.nome}</strong>. Preencha exatamente conforme a receita médica.
            </p>
            <form onSubmit={handleAddMedication} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nome do Medicamento *</label>
                <input
                  type="text"
                  required
                  value={newMedForm.nome}
                  onChange={(e) => setNewMedForm({ ...newMedForm, nome: e.target.value })}
                  placeholder="Informe o nome do medicamento"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Princípio Ativo (opcional)</label>
                <input
                  type="text"
                  value={newMedForm.principio_ativo}
                  onChange={(e) => setNewMedForm({ ...newMedForm, principio_ativo: e.target.value })}
                  placeholder="Informe se desejar registrar"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Dosagem Prescrita *</label>
                  <input
                    type="text"
                    required
                    value={newMedForm.dosagem}
                    onChange={(e) => setNewMedForm({ ...newMedForm, dosagem: e.target.value })}
                    placeholder="Ex: 50mg, 20 gotas"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Unidade *</label>
                  <select
                    required
                    value={newMedForm.unidade}
                    onChange={(e) => setNewMedForm({ ...newMedForm, unidade: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="comprimido">Comprimido</option>
                    <option value="capsula">Cápsula</option>
                    <option value="spray">Spray / Jato Nasal</option>
                    <option value="jato (spray)">Jato (Spray)</option>
                    <option value="gotas">Gotas</option>
                    <option value="ml">mL</option>
                    <option value="sache">Sachê</option>
                    <option value="aplicacao">Aplicação</option>
                    <option value="inalacao">Inalação</option>
                    <option value="ampola">Ampola / Dose</option>
                    <option value="unidade">Unidade</option>
                    <option value="g">Grama (g)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Estoque Inicial *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newMedForm.quantidade}
                    onChange={(e) => setNewMedForm({ ...newMedForm, quantidade: e.target.value })}
                    placeholder="Quantidade atual"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Horários (HH:MM) *</label>
                  <input
                    type="text"
                    required
                    value={newMedForm.horarios}
                    onChange={(e) => setNewMedForm({ ...newMedForm, horarios: e.target.value })}
                    placeholder="Ex: 08:00, 20:00"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmMedSave}
                  onChange={(e) => setConfirmMedSave(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0b1120] text-blue-600 focus:ring-blue-500"
                />
                <span>Confirmo que revisei o nome, a dosagem, os horários e o estoque inicial deste medicamento.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMedModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !confirmMedSave}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Medicamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: REGISTRAR AÇÃO DE DOSE                              */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showDoseModal && selectedDoseTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-1">Registro Clínico de Administração</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              <strong>{selectedDoseTarget.med_name}</strong> ({selectedDoseTarget.dosagem}) previsto para{' '}
              <strong>{selectedDoseTarget.hora}</strong> · Paciente: <strong>{selectedPatient?.nome}</strong>.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Horário Real da Administração (para doses tomadas)
                </label>
                <input
                  type="time"
                  value={doseAdministeredTime}
                  onChange={(e) => setDoseAdministeredTime(e.target.value)}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="block text-[11px] text-slate-400 mt-1">
                  O sistema registra separadamente o horário previsto ({selectedDoseTarget.hora}) e o horário real.
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Justificativa / Observação Clínica (obrigatória se não administrada)
                </label>
                <input
                  type="text"
                  value={doseActionReason}
                  onChange={(e) => setDoseActionReason(e.target.value)}
                  placeholder="Ex: Administrado após o café / Paciente recusou por náusea"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmDoseSave}
                  onChange={(e) => setConfirmDoseSave(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0b1120] text-blue-600 focus:ring-blue-500"
                />
                <span>Confirmo a veracidade deste registro de administração sob minha responsabilidade de cuidador.</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={actionLoading || !confirmDoseSave}
                onClick={() => handleConfirmDose('confirmed')}
                className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check size={16} className="w-4 h-4" />
                <span>Registrar Administração</span>
              </button>

              <button
                type="button"
                disabled={actionLoading || !confirmDoseSave}
                onClick={() => handleConfirmDose('missed')}
                className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <X size={16} className="w-4 h-4" />
                <span>Marcar Não Administrada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDoseModal(false)}
              className="w-full mt-3 min-h-[40px] py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO COMPROMISSO                                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-3">Agendar Consulta ou Exame</h3>
            <form onSubmit={handleAddAppointment} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Título do Evento *</label>
                <input
                  type="text"
                  required
                  value={newAppointmentForm.title}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, title: e.target.value })}
                  placeholder="Ex: Retorno Cardiologia"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={newAppointmentForm.date}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, date: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={newAppointmentForm.time}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, time: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Médico ou Especialista (opcional)</label>
                <input
                  type="text"
                  value={newAppointmentForm.doctor}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, doctor: e.target.value })}
                  placeholder="Nome do profissional"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Local / Clínica (opcional)</label>
                <input
                  type="text"
                  value={newAppointmentForm.location}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, location: e.target.value })}
                  placeholder="Endereço ou consultório"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Agendando...' : 'Agendar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: REPOSIÇÃO DE ESTOQUE                                */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-3">Registrar Reposição de Estoque</h3>
            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Medicamento *</label>
                <select
                  required
                  value={stockForm.medication_id}
                  onChange={(e) => setStockForm({ ...stockForm, medication_id: e.target.value })}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                >
                  <option value="">Selecione um medicamento...</option>
                  {medications.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (Atual: {m.quantidade} un)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Quantidade Adicionada *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockForm.quantity_added}
                  onChange={(e) => setStockForm({ ...stockForm, quantity_added: e.target.value })}
                  placeholder="Informe quantas unidades foram adquiridas"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Observação (opcional)</label>
                <input
                  type="text"
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  placeholder="Ex: Compra em farmácia"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>

              <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmStockSave}
                  onChange={(e) => setConfirmStockSave(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0b1120] text-blue-600 focus:ring-blue-500"
                />
                <span>Confirmo a quantidade adicionada ao estoque deste medicamento.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !confirmStockSave}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Reposição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (5 colunas fixas, zero corte em qualquer tela) */}
      <nav
        aria-label="Menu inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-800/90 z-40 select-none pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 rounded-xl transition-colors focus:outline-none ${
                  isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute top-1 w-5 h-0.5 rounded-full bg-blue-400" aria-hidden="true" />
                )}
                <Icon size={20} className="w-5 h-5 shrink-0" />
                <span className="text-[11px] leading-none whitespace-nowrap truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMobileMenuSheet(true)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 rounded-xl transition-colors focus:outline-none ${
              currentTab === 'reports' || currentTab === 'audit' || showMobileMenuSheet
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            {(currentTab === 'reports' || currentTab === 'audit') && (
              <span className="absolute top-1 w-5 h-0.5 rounded-full bg-blue-400" aria-hidden="true" />
            )}
            <LayoutGrid size={20} className="w-5 h-5 shrink-0" />
            <span className="text-[11px] leading-none whitespace-nowrap truncate max-w-full">
              Mais
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
