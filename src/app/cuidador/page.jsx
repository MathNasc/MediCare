'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  Users,
  Calendar,
  BarChart3,
  ShieldCheck,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bell,
  ArrowRight,
  Search,
  UserPlus,
  ChevronRight,
  Activity,
  Plus,
  MapPin,
  User,
  Download,
  TrendingUp,
  LogOut,
  Mail,
  KeyRound,
  Shield,
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
  HelpCircle,
} from 'lucide-react';

export default function CuidadorWebPage() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Auth form states (campos vazios por padrão, sem expor credenciais)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewMedModal, setShowNewMedModal] = useState(false);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  // Form states
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [newPatientForm, setNewPatientForm] = useState({
    nome: '',
    relationship_label: 'Pai',
    blood_type: 'O+',
    dob: '1960-05-15',
    phone: '',
  });
  const [newMedForm, setNewMedForm] = useState({
    nome: '',
    dosagem: '50mg',
    unidade: 'comprimido',
    quantidade: 30,
    horarios: '08:00, 20:00',
    treatment_type: 'continuous',
  });
  const [selectedDoseTarget, setSelectedDoseTarget] = useState(null);
  const [doseActionReason, setDoseActionReason] = useState('');
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    type: 'consulta',
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: '14:00',
    doctor: '',
    location: '',
  });
  const [stockForm, setStockForm] = useState({
    medication_id: '',
    quantity_added: 30,
    purchase_price: '',
    notes: 'Reposição de farmácia',
  });

  // Filter states
  const [searchPatient, setSearchPatient] = useState('');
  const [doseStatusFilter, setDoseStatusFilter] = useState('all');

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Verifica token salvo ao inicializar
  useEffect(() => {
    const savedToken = localStorage.getItem('medicare_cuidador_jwt');
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/v1/user', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((u) => {
          if (u) {
            setCurrentUser(u);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível entrar. Verifique seu e-mail e senha.');
      }

      setToken(data.access_token);
      setCurrentUser(data.user);
      if (data.access_token) {
        localStorage.setItem('medicare_cuidador_jwt', data.access_token);
      }
      showToast('Bem-vindo ao MediCare Cuidador!');
    } catch (err) {
      setAuthError(err.message || 'E-mail ou senha incorretos. Tente novamente.');
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

  const handleLogout = () => {
    fetch('/api/auth/v1/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('medicare_cuidador_jwt');
    showToast('Sessão encerrada com segurança.');
  };

  // Carrega dados do cuidador e pacientes
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [relRes, profRes] = await Promise.all([
        fetch('/api/rest/v1/caregiver_relationships?status=neq.revoked&select=*', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch('/api/rest/v1/profiles?limit=50', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      ]);

      const rels = await relRes.json().catch(() => []);
      const profs = await profRes.json().catch(() => []);

      let patientList = [];
      if (Array.isArray(rels) && rels.length > 0) {
        patientList = rels.map((r) => {
          const prof = Array.isArray(profs) ? profs.find((p) => p.id === r.patient_id) : null;
          return {
            relationship_id: r.id,
            patient_id: r.patient_id,
            nome: prof?.nome || 'Paciente Vinculado',
            blood_type: prof?.blood_type || 'O+',
            relationship_label: r.relationship_label || 'Paciente',
            permission_level: r.permission_level || 'caregiver',
            is_managed: prof?.is_managed || false,
          };
        });
      } else if (Array.isArray(profs) && profs.length > 0) {
        patientList = profs
          .filter((p) => p.role === 'paciente' || p.role === 'independente')
          .slice(0, 4)
          .map((p) => ({
            relationship_id: `rel-${p.id.slice(0, 8)}`,
            patient_id: p.id,
            nome: p.nome,
            blood_type: p.blood_type || 'O+',
            relationship_label: 'Acompanhado',
            permission_level: 'admin',
            is_managed: false,
          }));
      }

      setPatients(patientList);
      if (patientList.length > 0 && !selectedPatientId) {
        setSelectedPatientId(patientList[0].patient_id);
      }

      const targetId = selectedPatientId || (patientList[0]?.patient_id);
      if (targetId) {
        const [medsRes, histRes, eventsRes, logsRes] = await Promise.all([
          fetch(`/api/rest/v1/medicamentos?user_id=eq.${targetId}&ativo=eq.true&order=created_at.asc`),
          fetch(`/api/rest/v1/historico_doses?user_id=eq.${targetId}&order=created_at.desc&limit=50`),
          fetch(`/api/rest/v1/health_events?user_id=eq.${targetId}&order=date.asc`),
          fetch('/api/rest/v1/rpc/list_audit_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_patient_id: targetId, p_limit: 20 }),
          }),
        ]);

        const meds = await medsRes.json().catch(() => []);
        const hist = await histRes.json().catch(() => []);
        const events = await eventsRes.json().catch(() => []);
        const logs = await logsRes.json().catch(() => []);

        setMedications(Array.isArray(meds) ? meds : []);
        setDoseHistory(Array.isArray(hist) ? hist : []);
        setAppointments(Array.isArray(events) ? events : []);
        setAuditLogs(Array.isArray(logs) ? logs : []);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedPatientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aceitar convite
  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/rest/v1/rpc/accept_caregiver_invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ p_token: inviteTokenInput.trim() }),
      });
      const data = await res.json();
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

  // Cadastrar Paciente Gerenciado
  const handleCreateManagedPatient = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/rest/v1/rpc/create_managed_patient', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_nome: newPatientForm.nome,
          p_relationship_label: newPatientForm.relationship_label,
          p_blood_type: newPatientForm.blood_type,
          p_dob: newPatientForm.dob,
          p_phone: newPatientForm.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao cadastrar paciente dependente');
      }
      showToast('Paciente cadastrado com sucesso!');
      setShowNewPatientModal(false);
      setNewPatientForm({
        nome: '',
        relationship_label: 'Pai',
        blood_type: 'O+',
        dob: '1960-05-15',
        phone: '',
      });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Revogar Cuidador
  const handleRevokeRelationship = async (relId) => {
    if (!confirm('Tem certeza de que deseja revogar o vínculo deste paciente?')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/rest/v1/rpc/revoke_caregiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_relationship_id: relId }),
      });
      const ok = await res.json();
      if (ok) {
        showToast('Vínculo revogado com sucesso.');
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

  // Cadastrar Medicamento
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setActionLoading(true);
    try {
      const horariosArr = newMedForm.horarios.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/rest/v1/medicamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedPatientId,
          nome: newMedForm.nome,
          dosagem: newMedForm.dosagem,
          unidade: newMedForm.unidade,
          quantidade: Number(newMedForm.quantidade),
          horarios: horariosArr.length ? horariosArr : ['08:00'],
          treatment_type: newMedForm.treatment_type,
          ativo: true,
          status: 'ativo',
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar medicamento');
      showToast('Medicamento cadastrado com sucesso!');
      setShowNewMedModal(false);
      setNewMedForm({
        nome: '',
        dosagem: '50mg',
        unidade: 'comprimido',
        quantidade: 30,
        horarios: '08:00, 20:00',
        treatment_type: 'continuous',
      });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmar Dose como Cuidador ou Marcar como Não Tomada
  const handleConfirmDose = async (status) => {
    if (!selectedDoseTarget || !selectedPatientId) return;
    setActionLoading(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/rest/v1/rpc/confirm_dose_retroactive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_patient_id: selectedPatientId,
          p_med_id: selectedDoseTarget.med_id,
          p_hora: selectedDoseTarget.hora,
          p_dose_date: todayIso,
          p_new_status: status,
          p_reason: doseActionReason.trim() || (status === 'confirmed' ? 'Administrado pelo cuidador' : 'Paciente recusou a dose'),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro ao registrar dose');
      }
      showToast(status === 'confirmed' ? 'Dose confirmada pelo cuidador!' : 'Dose registrada como não administrada.');
      setShowDoseModal(false);
      setSelectedDoseTarget(null);
      setDoseActionReason('');
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
    setActionLoading(true);
    try {
      const res = await fetch('/api/rest/v1/health_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedPatientId,
          type: newAppointmentForm.type,
          title: newAppointmentForm.title,
          date: newAppointmentForm.date,
          time: newAppointmentForm.time,
          doctor: newAppointmentForm.doctor,
          location: newAppointmentForm.location,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar compromisso');
      showToast('Compromisso agendado com sucesso!');
      setShowAppointmentModal(false);
      setNewAppointmentForm({
        type: 'consulta',
        title: '',
        date: new Date().toISOString().slice(0, 10),
        time: '14:00',
        doctor: '',
        location: '',
      });
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
    if (!stockForm.medication_id) return;
    setActionLoading(true);
    try {
      const med = medications.find((m) => m.id === stockForm.medication_id);
      const beforeQty = med ? Number(med.quantidade || 0) : 0;
      const afterQty = beforeQty + Number(stockForm.quantity_added);

      const res = await fetch('/api/rest/v1/rpc/record_stock_movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_medication_id: stockForm.medication_id,
          p_movement_type: 'purchase',
          p_quantity_before: beforeQty,
          p_quantity_after: afterQty,
          p_purchase_price: stockForm.purchase_price ? Number(stockForm.purchase_price) : null,
          p_notes: stockForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Erro ao registrar estoque');
      showToast('Estoque atualizado com sucesso!');
      setShowStockModal(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Doses do dia
  const todayDoses = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  medications.forEach((med) => {
    const horarios = Array.isArray(med.horarios) ? med.horarios : ['08:00'];
    horarios.forEach((hora) => {
      const match = doseHistory.find(
        (h) => h.med_id === med.id && h.hora === hora && (h.dose_date === todayIso || String(h.created_at).startsWith(todayIso))
      );
      todayDoses.push({
        id: `${med.id}-${hora}`,
        med_id: med.id,
        med_name: med.nome,
        dosagem: med.dosagem,
        unidade: med.unidade || 'comprimido',
        hora,
        status: match ? match.status : 'pending',
        performed_by: match?.performed_by,
        is_retroactive: match?.is_retroactive,
        history_id: match?.id,
      });
    });
  });

  todayDoses.sort((a, b) => a.hora.localeCompare(b.hora));

  const totalDosesToday = todayDoses.length;
  const confirmedDosesToday = todayDoses.filter((d) => d.status === 'confirmed').length;
  const missedDosesToday = todayDoses.filter((d) => d.status === 'missed').length;
  const pendingDosesToday = todayDoses.filter((d) => d.status === 'pending').length;
  const adherenceRate = totalDosesToday > 0 ? Math.round((confirmedDosesToday / totalDosesToday) * 100) : 100;

  const selectedPatient = patients.find((p) => p.patient_id === selectedPatientId) || patients[0];

  const navItems = [
    { id: 'dashboard', label: 'Central de Doses', icon: Home },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'meds', label: 'Medicamentos & Estoque', icon: Pill },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'reports', label: 'Indicadores', icon: BarChart3 },
    { id: 'audit', label: 'Auditoria', icon: History },
  ];

  // ─────────────────────────────────────────────────────────────
  // REFORMULAÇÃO DA TELA DE LOGIN DO CUIDADOR (SEÇÃO 4)
  // ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-[420px] bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-8 shadow-2xl shadow-black/40">
          
          {/* Logo / Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-xl mb-3 shadow-md shadow-blue-600/20">
              M
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bem-vindo ao MediCare Cuidador
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
              Acesse o painel para acompanhar os tratamentos e a rotina de saúde dos seus pacientes.
            </p>
          </div>

          {/* Mensagem de Erro Acessível */}
          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 leading-snug"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Principal "Entrar" */}
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#131d31]"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Entrando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>

          {/* Link "Voltar ao portal" */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-2 rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao portal</span>
            </Link>
          </div>
        </div>

        {/* Modal de Recuperação de Senha Preservando Rota Existente */}
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
  // PAINEL AUTENTICADO DO CUIDADOR
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      {/* Toast */}
      {notification && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            notification.type === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-200'
              : 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#111827] border-r border-[#1f2937] p-5 justify-between select-none shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base">
              M
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm leading-tight">MediCare</div>
              <div className="text-[11px] text-blue-400 font-semibold tracking-wider">CUIDADOR</div>
            </div>
          </div>

          {/* Seletor de Paciente */}
          <div className="mb-6 px-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Paciente em Acompanhamento
            </label>
            <select
              value={selectedPatientId || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.nome} ({p.relationship_label})
                </option>
              ))}
            </select>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#1f2937] pt-4 px-2">
          <div className="mb-3 truncate">
            <div className="text-[10px] text-slate-400 font-medium">Cuidador Conectado</div>
            <div className="text-xs font-bold text-slate-200 truncate">{currentUser?.email || 'cuidador'}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Top Header */}
        <header className="h-16 border-b border-[#1f2937] px-4 sm:px-6 flex items-center justify-between bg-[#0b1120]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3 truncate">
            <h2 className="text-sm font-bold text-slate-200 truncate">
              {currentTab === 'dashboard' && `Central de Doses • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'patients' && 'Gestão de Pacientes e Vínculos'}
              {currentTab === 'meds' && `Medicamentos & Estoque • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'agenda' && `Agenda Médica • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'reports' && 'Indicadores de Adesão'}
              {currentTab === 'audit' && `Trilha de Auditoria • ${selectedPatient?.nome || 'Paciente'}`}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadData}
              title="Recarregar dados"
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl w-full mx-auto">
          {/* TAB 1: CENTRAL DE DOSES */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#131d31] p-5 sm:p-6 rounded-2xl border border-slate-800">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {selectedPatient ? selectedPatient.nome : 'Nenhum paciente selecionado'}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Vínculo: <span className="text-slate-300 font-semibold">{selectedPatient?.relationship_label || 'Acompanhado'}</span> •
                    Tipo Sanguíneo: <span className="text-slate-300 font-semibold">{selectedPatient?.blood_type || 'O+'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewMedModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Medicamento</span>
                  </button>
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Novo Compromisso</span>
                  </button>
                </div>
              </div>

              {/* KPIs de Administração */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Doses Hoje</div>
                  <div className="text-2xl font-black text-white">{totalDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Programadas no dia</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Confirmadas</div>
                  <div className="text-2xl font-black text-emerald-400">{confirmedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Pelo paciente ou cuidador</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pendentes</div>
                  <div className="text-2xl font-black text-amber-400">{pendingDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Aguardando confirmação</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Não Tomadas</div>
                  <div className="text-2xl font-black text-rose-400">{missedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Com justificativa arquivada</div>
                </div>
              </div>

              {/* Lista de Doses do Dia */}
              <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-white">Linha do Tempo de Doses</h2>
                    <p className="text-xs text-slate-400">Horários previstos e registro fático de ingestão</p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b1120] p-1 rounded-xl border border-slate-800 text-xs">
                    {['all', 'pending', 'confirmed', 'missed'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setDoseStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          doseStatusFilter === st ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st === 'all' ? 'Todas' : st === 'pending' ? 'Pendentes' : st === 'confirmed' ? 'Confirmadas' : 'Não Tomadas'}
                      </button>
                    ))}
                  </div>
                </div>

                {todayDoses.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    Nenhum medicamento ativo cadastrado para este paciente hoje.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayDoses
                      .filter((d) => doseStatusFilter === 'all' || d.status === doseStatusFilter)
                      .map((dose) => (
                        <div
                          key={dose.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm border shrink-0 ${
                                dose.status === 'confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : dose.status === 'missed'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {dose.hora}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">{dose.med_name}</span>
                                <span className="text-xs text-slate-400">({dose.dosagem})</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                    dose.status === 'confirmed'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : dose.status === 'missed'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {dose.status === 'confirmed'
                                    ? dose.is_retroactive
                                      ? 'Confirmada (Cuidador)'
                                      : 'Tomada (Paciente)'
                                    : dose.status === 'missed'
                                    ? 'Não Tomada'
                                    : 'Pendente'}
                                </span>
                              </div>

                              <div className="text-xs text-slate-400 mt-0.5">
                                Paciente: <strong className="text-slate-300">{selectedPatient?.nome}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => {
                                setSelectedDoseTarget(dose);
                                setDoseActionReason('');
                                setShowDoseModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-colors"
                            >
                              Registrar Ação
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PACIENTES */}
          {currentTab === 'patients' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Pacientes Acompanhados</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gerencie vínculos, convites ou cadastre familiares dependentes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aceitar Convite</span>
                  </button>
                  <button
                    onClick={() => setShowNewPatientModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Novo Paciente</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  placeholder="Pesquisar paciente..."
                  className="w-full bg-[#131d31] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patients
                  .filter((p) => p.nome.toLowerCase().includes(searchPatient.toLowerCase()))
                  .map((p) => (
                    <div
                      key={p.patient_id}
                      onClick={() => setSelectedPatientId(p.patient_id)}
                      className={`bg-[#131d31] p-5 rounded-2xl border transition-all cursor-pointer ${
                        selectedPatientId === p.patient_id
                          ? 'border-blue-500 ring-1 ring-blue-500/50'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                            {p.nome.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-sm">{p.nome}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                                {p.relationship_label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Tipo Sanguíneo: <strong className="text-slate-300">{p.blood_type}</strong>
                              {p.is_managed && <span className="text-amber-400 ml-2 font-semibold">• Dependente</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeRelationship(p.relationship_id);
                          }}
                          title="Revogar acompanhamento"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAMENTOS & ESTOQUE */}
          {currentTab === 'meds' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Prescrições e Estoque</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tratamentos de {selectedPatient?.nome || 'Paciente'}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowStockModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Reposição de Estoque</span>
                  </button>
                  <button
                    onClick={() => setShowNewMedModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Medicamento</span>
                  </button>
                </div>
              </div>

              {medications.length === 0 ? (
                <div className="text-center py-10 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
                  Nenhum medicamento ativo cadastrado para este paciente.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medications.map((med) => {
                    const horarios = Array.isArray(med.horarios) ? med.horarios : ['08:00'];
                    const dosesPerDay = Math.max(1, horarios.length);
                    const daysRemaining = Math.floor(Number(med.quantidade || 0) / dosesPerDay);
                    const isLowStock = Number(med.quantidade || 0) <= 5;

                    return (
                      <div key={med.id} className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                              <Pill className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-base">{med.nome}</h3>
                              <p className="text-xs text-slate-400">
                                {med.dosagem} • {med.unidade || 'comprimido'}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold uppercase">
                            {med.treatment_type === 'continuous' ? 'Contínuo' : med.treatment_type === 'sos' ? 'SOS' : 'Temporário'}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Horários: </span>
                            <span className="font-semibold text-white">{horarios.join(', ')}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Estoque:</span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                                isLowStock
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/10 text-emerald-300'
                              }`}
                            >
                              {med.quantidade} un ({daysRemaining} dias)
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
          {currentTab === 'agenda' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Agenda Médica</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consultas e exames de {selectedPatient?.nome || 'Paciente'}.
                  </p>
                </div>

                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Compromisso</span>
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-10 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
                  Nenhum compromisso clínico agendado.
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-[#131d31] p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm">{apt.title}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold capitalize">
                              {apt.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {apt.date} {apt.time ? `às ${apt.time}` : ''}
                            </span>
                            {apt.doctor && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                {apt.doctor}
                              </span>
                            )}
                            {apt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                {apt.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: INDICADORES */}
          {currentTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Indicadores de Adesão</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Métricas oficiais de acompanhamento com base no histórico real registrado.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Taxa Geral de Adesão</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{adherenceRate}%</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Doses tomadas em relação ao total previsto do dia
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Doses Confirmadas</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{confirmedDosesToday}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Confirmadas pelo paciente ou cuidador
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Recusas Registradas</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-black text-amber-400">{missedDosesToday}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Com justificativa clínica arquivada
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDITORIA */}
          {currentTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Trilha de Auditoria</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registros imutáveis com autor, timestamp e justificativa clínica.
                </p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-10 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
                  Nenhum registro de auditoria arquivado para este paciente.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="bg-[#131d31] p-4 rounded-xl border border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-bold text-white mb-1">
                        <span className="text-blue-400 uppercase tracking-wide">{log.action}</span>
                        <span className="text-slate-500 font-normal">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        Motivo: <strong className="text-white">{log.reason || 'Ajuste de rotina'}</strong>
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
      {/* MODAL: ACEITAR CONVITE */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Aceitar Código de Convite</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe o código de 24 caracteres gerado pelo paciente em seu aplicativo Android MediCare.
            </p>
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <input
                type="text"
                required
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                placeholder="Código de convite"
                className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2.5 min-h-[44px] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO PACIENTE DEPENDENTE */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Cadastrar Paciente Dependente</h3>
            <p className="text-xs text-slate-400 mb-4">
              Para familiares que não utilizam smartphone ou e-mail pessoal.
            </p>
            <form onSubmit={handleCreateManagedPatient} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newPatientForm.nome}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, nome: e.target.value })}
                  placeholder="Nome do paciente"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Parentesco</label>
                  <input
                    type="text"
                    value={newPatientForm.relationship_label}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, relationship_label: e.target.value })}
                    placeholder="Mãe / Pai / Filho"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tipo Sanguíneo</label>
                  <select
                    value={newPatientForm.blood_type}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, blood_type: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Cadastrando...' : 'Cadastrar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO MEDICAMENTO */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNewMedModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Cadastrar Medicamento</h3>
            <p className="text-xs text-slate-400 mb-4">
              Prescrição para <strong>{selectedPatient?.nome}</strong>.
            </p>
            <form onSubmit={handleAddMedication} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nome Comercial</label>
                <input
                  type="text"
                  required
                  value={newMedForm.nome}
                  onChange={(e) => setNewMedForm({ ...newMedForm, nome: e.target.value })}
                  placeholder="Ex: Losartana Potássica"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Dosagem</label>
                  <input
                    type="text"
                    required
                    value={newMedForm.dosagem}
                    onChange={(e) => setNewMedForm({ ...newMedForm, dosagem: e.target.value })}
                    placeholder="Ex: 50mg"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    value={newMedForm.quantidade}
                    onChange={(e) => setNewMedForm({ ...newMedForm, quantidade: Number(e.target.value) })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Horários (separados por vírgula)</label>
                <input
                  type="text"
                  required
                  value={newMedForm.horarios}
                  onChange={(e) => setNewMedForm({ ...newMedForm, horarios: e.target.value })}
                  placeholder="08:00, 20:00"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMedModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Medicamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: REGISTRAR AÇÃO DE DOSE */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showDoseModal && selectedDoseTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Registro de Dose</h3>
            <p className="text-xs text-slate-400 mb-4">
              <strong>{selectedDoseTarget.med_name}</strong> às <strong>{selectedDoseTarget.hora}</strong> para {selectedPatient?.nome}.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Justificativa / Observação Clínica (opcional para confirmação, obrigatória para recusa)
                </label>
                <input
                  type="text"
                  value={doseActionReason}
                  onChange={(e) => setDoseActionReason(e.target.value)}
                  placeholder="Ex: Administrado na visita / Paciente queixou-se de náusea"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmDose('confirmed')}
                className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar como Tomada</span>
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmDose('missed')}
                className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Marcar Não Tomada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDoseModal(false)}
              className="w-full mt-3 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: NOVO COMPROMISSO */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Agendar Consulta ou Exame</h3>
            <form onSubmit={handleAddAppointment} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Título do Evento</label>
                <input
                  type="text"
                  required
                  value={newAppointmentForm.title}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, title: e.target.value })}
                  placeholder="Ex: Retorno Cardiologia"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={newAppointmentForm.date}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, date: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={newAppointmentForm.time}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, time: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Médico ou Especialista</label>
                <input
                  type="text"
                  value={newAppointmentForm.doctor}
                  onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, doctor: e.target.value })}
                  placeholder="Ex: Dr. Feres Chaddad Neto"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Agendando...' : 'Agendar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: REPOSIÇÃO DE ESTOQUE */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Registrar Reposição de Estoque</h3>
            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Medicamento</label>
                <select
                  required
                  value={stockForm.medication_id}
                  onChange={(e) => setStockForm({ ...stockForm, medication_id: e.target.value })}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
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
                <label className="block text-[11px] text-slate-400 mb-1">Quantidade Adicionada</label>
                <input
                  type="number"
                  required
                  value={stockForm.quantity_added}
                  onChange={(e) => setStockForm({ ...stockForm, quantity_added: Number(e.target.value) })}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Reposição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-md border-t border-[#1e293b] px-2 py-2 z-50 flex items-center justify-around select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-none">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
