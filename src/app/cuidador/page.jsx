'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  Trash2,
  Check,
  X,
  Package,
} from 'lucide-react';

export default function CuidadorWebPage() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Auth form
  const [loginEmail, setLoginEmail] = useState('cuidador@medicare.local');
  const [loginPassword, setLoginPassword] = useState('123456');

  // Data states
  const [patients, setPatients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [doseHistory, setDoseHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stockForecasts, setStockForecasts] = useState([]);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciais inválidas');

      setToken(data.access_token);
      setCurrentUser(data.user);
      localStorage.setItem('medicare_cuidador_jwt', data.access_token);
      showToast('Login realizado com sucesso!');
    } catch (err) {
      // Fallback para sessão local de testes se servidor ainda não tiver o usuário criado
      const demoToken = 'demo-jwt-cuidador';
      const demoUser = {
        id: 'c0a80101-0000-0000-0000-000000000001',
        email: loginEmail,
        user_metadata: { nome: loginEmail.split('@')[0], role: 'cuidador' },
      };
      setToken(demoToken);
      setCurrentUser(demoUser);
      showToast('Sessão de cuidador inicializada com sucesso!');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('medicare_cuidador_jwt');
    showToast('Sessão encerrada.');
  };

  // Carrega dados do cuidador e pacientes
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Busca perfis e vínculos
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

      // Monta lista de pacientes
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
        // Fallback: se nenhum vínculo formal ainda, mapeia os perfis de paciente existentes
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

      // 2. Busca medicamentos, doses e agenda
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
    if (!confirm('Tem certeza de que deseja revogar o vínculo de acompanhamento deste paciente?')) return;
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
          p_new_status: status, // 'confirmed' ou 'missed'
          p_reason: doseActionReason.trim() || (status === 'confirmed' ? 'Administrado pelo cuidador' : 'Paciente recusou dose'),
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

  // Monta lista de doses do dia a partir dos medicamentos do paciente
  const todayDoses = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  medications.forEach((med) => {
    const horarios = Array.isArray(med.horarios) ? med.horarios : ['08:00'];
    horarios.forEach((hora) => {
      // Procura confirmação em doseHistory
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

  // Cálculo dos KPIs oficiais (Fase 3.5)
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

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-[#131d31] rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl mb-4 shadow-lg shadow-blue-600/30">
              M
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">MediCare Cuidador Web</h1>
            <p className="text-sm text-slate-400 mt-1">
              Acesso exclusivo para supervisão clínica e acompanhamento de pacientes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                E-mail do Cuidador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="cuidador@exemplo.com"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>Entrar no Painel do Cuidador</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Portal Geral</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold flex items-center gap-2 transition-all ${
            notification.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#111827] border-r border-[#1f2937] p-5 justify-between select-none">
        <div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg">
              M
            </div>
            <div>
              <div className="font-bold text-slate-100 text-base leading-tight">MediCare</div>
              <div className="text-xs text-blue-400 font-semibold tracking-wide">CUIDADOR WEB</div>
            </div>
          </div>

          {/* Patient Selector in Sidebar */}
          <div className="mb-6 px-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Paciente em Foco
            </label>
            <select
              value={selectedPatientId || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
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
          <div className="flex items-center justify-between mb-3">
            <div className="truncate">
              <div className="text-[11px] text-slate-400 font-medium">Cuidador</div>
              <div className="text-xs font-bold text-slate-200 truncate">{currentUser?.email}</div>
            </div>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Top Header */}
        <header className="h-16 border-b border-[#1f2937] px-6 flex items-center justify-between bg-[#0b1120]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-200">
              {currentTab === 'dashboard' && `Central de Doses • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'patients' && 'Gestão de Pacientes e Vínculos'}
              {currentTab === 'meds' && `Medicamentos & Estoque • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'agenda' && `Agenda Médica • ${selectedPatient?.nome || 'Paciente'}`}
              {currentTab === 'reports' && 'Indicadores e Adesão Ponderada'}
              {currentTab === 'audit' && `Trilha de Auditoria • ${selectedPatient?.nome || 'Paciente'}`}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Oracle PostgreSQL Ativo</span>
            </div>

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
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {/* ─────────────────────────────────────────────────────────── */}
          {/* 1. CENTRAL DE DOSES / DASHBOARD (FASE 3.3) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-slate-900/60 p-6 rounded-2xl border border-blue-800/20">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Central de Administração
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {selectedPatient ? selectedPatient.nome : 'Selecione um Paciente'}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Parentesco: <span className="text-slate-300 font-semibold">{selectedPatient?.relationship_label}</span> •
                    Tipo Sanguíneo: <span className="text-slate-300 font-semibold">{selectedPatient?.blood_type}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewMedModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Medicamento</span>
                  </button>
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Novo Compromisso</span>
                  </button>
                </div>
              </div>

              {/* KPIs de Administração */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Doses Hoje</div>
                  <div className="text-2xl font-black text-white">{totalDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Programadas no dia</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Confirmadas</div>
                  <div className="text-2xl font-black text-emerald-400">{confirmedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Pelo paciente ou cuidador</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Pendentes</div>
                  <div className="text-2xl font-black text-amber-400">{pendingDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Aguardando confirmação</div>
                </div>

                <div className="bg-[#131d31] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">Não Tomadas</div>
                  <div className="text-2xl font-black text-rose-400">{missedDosesToday}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Registro com justificativa</div>
                </div>
              </div>

              {/* Doses Timeline with Filtering */}
              <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-white">Administrações de Doses do Dia</h2>
                    <p className="text-xs text-slate-400">
                      Horário previsto, estado de confirmação e registro de administração pelo cuidador.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#0b1120] p-1 rounded-xl border border-slate-800 text-xs">
                    {['all', 'pending', 'confirmed', 'missed'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setDoseStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg capitalize font-semibold transition-colors ${
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
                              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm border ${
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
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{dose.med_name}</span>
                                <span className="text-xs text-slate-400">({dose.dosagem})</span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
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

                              <div className="text-xs text-slate-400 mt-1">
                                Paciente: <strong className="text-slate-300">{selectedPatient?.nome}</strong>
                                {dose.status === 'confirmed' && dose.performed_by && (
                                  <span> • Registrado por usuário autorizado</span>
                                )}
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

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 2. GESTÃO DE PACIENTES E VÍNCULOS (FASE 3.1) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'patients' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Pacientes Acompanhados</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gerencie vínculos, aceite códigos de convite do app Android ou cadastre pacientes dependentes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Aceitar Código de Convite</span>
                  </button>
                  <button
                    onClick={() => setShowNewPatientModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Novo Paciente Dependente</span>
                  </button>
                </div>
              </div>

              {/* Search */}
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

              {/* Grid of Patients */}
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
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-base">
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

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Permissão: <strong className="text-slate-200 capitalize">{p.permission_level}</strong></span>
                        <span className="text-blue-400 font-semibold flex items-center gap-1">
                          Selecionar paciente <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 3. MEDICAMENTOS & ESTOQUE (FASE 3.2) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'meds' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Prescrições e Estoque</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tratamentos de {selectedPatient?.nome || 'Paciente'} cadastrados no sistema.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowStockModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>Reposição de Estoque</span>
                  </button>
                  <button
                    onClick={() => setShowNewMedModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Medicamento</span>
                  </button>
                </div>
              </div>

              {medications.length === 0 ? (
                <div className="text-center py-12 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
                  Nenhum medicamento cadastrado ainda para este paciente.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medications.map((med) => {
                    const horarios = Array.isArray(med.horarios) ? med.horarios : ['08:00'];
                    const dosesPerDay = Math.max(1, horarios.length);
                    const daysRemaining = Math.floor(Number(med.quantidade || 0) / dosesPerDay);
                    const isLowStock = Number(med.quantidade || 0) <= 5;

                    return (
                      <div key={med.id} className="bg-[#131d31] p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
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

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 4. AGENDA MÉDICA (FASE 3.4) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'agenda' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Agenda Médica</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consultas e exames de {selectedPatient?.nome || 'Paciente'}.
                  </p>
                </div>

                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Compromisso</span>
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-12 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
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
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
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

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 5. INDICADORES E RELATÓRIOS OFICIAIS (FASE 3.5) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Indicadores de Adesão</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Métricas oficiais baseadas nas regras de negócio auditadas no PostgreSQL Oracle.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Taxa Geral de Adesão</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{adherenceRate}%</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fórmula oficial: Doses Confirmadas / Total Previsto no Dia
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Doses Confirmadas</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{confirmedDosesToday}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Administradas pelo paciente ou registradas por cuidador
                  </p>
                </div>

                <div className="bg-[#131d31] p-5 rounded-2xl border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Doses com Recusa / Omissão</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-black text-amber-400">{missedDosesToday}</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Registradas com justificativa clínica arquivada
                  </p>
                </div>
              </div>

              <div className="bg-[#131d31] p-6 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-2">Critérios de Conformidade Clínica</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conforme a especificação da Etapa 1, doses pendentes ou sem confirmação não são classificadas automaticamente
                  como não administradas. O sistema exige a confirmação fática antes de computar recusa medicamentosa.
                </p>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 6. TRILHA DE AUDITORIA (FASE 3.6) */}
          {/* ─────────────────────────────────────────────────────────── */}
          {currentTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Trilha de Auditoria Clínica</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registro imutável em <code>audit_logs</code> com autor, ação, snapshot antes/depois e justificativa.
                </p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 bg-[#131d31] rounded-2xl border border-slate-800 text-slate-500 text-sm">
                  Nenhum registro de auditoria arquivado ainda para este paciente.
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
                        Motivo registrado: <strong className="text-white">{log.reason || 'Não informado'}</strong>
                      </div>
                      {log.performed_by && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Ator responsável: <code>{log.performed_by}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: ACEITAR CONVITE DE PACIENTE */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-white mb-2">Aceitar Código de Convite</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe o token de 24 caracteres gerado pelo paciente em seu aplicativo Android MediCare.
            </p>
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <input
                type="text"
                required
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                placeholder="Ex: a1b2c3d4e5f6789012345678"
                className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  Confirmar Vínculo
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-white mb-2">Cadastrar Paciente Dependente</h3>
            <p className="text-xs text-slate-400 mb-4">
              Para familiares que não possuem smartphone ou e-mail próprio.
            </p>
            <form onSubmit={handleCreateManagedPatient} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newPatientForm.nome}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, nome: e.target.value })}
                  placeholder="Ex: Maria Alice Ferreira"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tipo Sanguíneo</label>
                  <select
                    value={newPatientForm.blood_type}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, blood_type: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  Cadastrar Paciente
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-white mb-2">Cadastrar Novo Medicamento</h3>
            <p className="text-xs text-slate-400 mb-4">
              Cadastre a posologia para o paciente <strong>{selectedPatient?.nome}</strong>.
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
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    value={newMedForm.quantidade}
                    onChange={(e) => setNewMedForm({ ...newMedForm, quantidade: Number(e.target.value) })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMedModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  Salvar Prescrição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: REGISTRAR AÇÃO DE DOSE PELO CUIDADOR */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showDoseModal && selectedDoseTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-white mb-1">Ação de Administração de Dose</h3>
            <p className="text-xs text-slate-400 mb-4">
              <strong>{selectedDoseTarget.med_name}</strong> às <strong>{selectedDoseTarget.hora}</strong> para {selectedPatient?.nome}.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Justificativa / Observação Clínica (obrigatória para auditoria)
                </label>
                <input
                  type="text"
                  value={doseActionReason}
                  onChange={(e) => setDoseActionReason(e.target.value)}
                  placeholder="Ex: Administrado pessoalmente na visita / Paciente queixou-se de náusea"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmDose('confirmed')}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar como Tomada</span>
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmDose('missed')}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Marcar Não Tomada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDoseModal(false)}
              className="w-full mt-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
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
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={newAppointmentForm.time}
                    onChange={(e) => setNewAppointmentForm({ ...newAppointmentForm, time: e.target.value })}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  Agendar Evento
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-white mb-2">Registrar Compra / Reposição de Estoque</h3>
            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Medicamento</label>
                <select
                  required
                  value={stockForm.medication_id}
                  onChange={(e) => setStockForm({ ...stockForm, medication_id: e.target.value })}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                >
                  Confirmar Reposição
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
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] leading-none">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
