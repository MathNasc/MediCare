'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import medicareLogo from '../../../public/icon-192.png';
import { registerServiceWorker, PWAInstallButton, OfflineIndicator, usePWAInstall } from '@/lib/usePWA';
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
  Smartphone,
  Copy,
  Bell,
  ChevronLeft,
  FileText,
  Pencil,
  Info,
  Download,
  Globe,
  ShieldCheck,
  HeartHandshake,
  SlidersHorizontal,
  Save,
  RotateCcw,
  Building2,
  Layers,
  CheckSquare,
  Square,
  MessageSquare,
  Send,
  CheckCheck,
} from 'lucide-react';
import { formatAuditLogEntry } from '@/lib/auditFormatter';
import { subscribeToPush } from '@/lib/webPush';
import {
  getBrazilDateIso,
  addDaysBrazilDateIso,
  getBrazilMinutesOfDay,
  formatBrazilDateTime,
  formatBrazilTime,
} from '@/lib/brazilTime';
import {
  MONTHS_PT,
  WEEKDAYS_SHORT_PT,
  formatDateBr,
  formatFullDateBr,
  getDayDetails,
  buildCalendarMonthData,
  isStockEventRecord,
} from '@/lib/caregiverCalendar';
import {
  DEFAULT_CARE_SETTINGS,
  GROUP_COLORS,
  OVERDUE_NOTIFY_OPTIONS,
  MISSED_DOSE_WINDOW_OPTIONS,
  CARE_MANAGEMENT_PRESETS,
  normalizeCareSettings,
  normalizeConfigMode,
  formatMinutesLabelPt,
} from '@/lib/careSettings';

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
  treatment_type: '',
  treatment_days: '',
  observacoes: '',
};

const SCHEDULE_INTERVAL_PRESETS = [
  { hours: 24, label: '24h (1x/dia)' },
  { hours: 12, label: '12 em 12h' },
  { hours: 8, label: '8 em 8h' },
  { hours: 6, label: '6 em 6h' },
  { hours: 4, label: '4 em 4h' },
];

function buildIntervalScheduleList(startHm, intervalHours) {
  const match = String(startHm || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const baseHour = match ? Number(match[1]) : 8;
  const baseMin = match ? Number(match[2]) : 0;
  const startTotal = baseHour * 60 + baseMin;
  const count = Math.max(1, Math.round(24 / intervalHours));
  const stepMins = intervalHours * 60;
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const m = (startTotal + i * stepMins) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    list.push(`${hh}:${mm}`);
  }
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

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
  const [calendarNotes, setCalendarNotes] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [allApprovalRequests, setAllApprovalRequests] = useState([]);
  const [careSettings, setCareSettings] = useState(() => ({ ...DEFAULT_CARE_SETTINGS }));
  const [careSettingsDraft, setCareSettingsDraft] = useState(() => ({ ...DEFAULT_CARE_SETTINGS }));
  const [careSettingsLoading, setCareSettingsLoading] = useState(false);
  const [careSettingsSaving, setCareSettingsSaving] = useState(false);
  const [managementScope, setManagementScope] = useState('patient'); // 'patient' | 'global' | 'groups'
  const [patientRuleMeta, setPatientRuleMeta] = useState({
    config_mode: 'global',
    group_id: null,
    group_name: null,
    group_color: null,
    effective_source: 'default',
    custom_settings: { ...DEFAULT_CARE_SETTINGS },
  });
  const [patientConfigModeDraft, setPatientConfigModeDraft] = useState('global');
  const [patientGroupIdDraft, setPatientGroupIdDraft] = useState('');
  const [globalCareSettings, setGlobalCareSettings] = useState(() => ({ ...DEFAULT_CARE_SETTINGS, is_configured: false }));
  const [globalCareSettingsDraft, setGlobalCareSettingsDraft] = useState(() => ({ ...DEFAULT_CARE_SETTINGS }));
  const [careGroups, setCareGroups] = useState([]);
  const [patientsOverview, setPatientsOverview] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDraft, setGroupDraft] = useState({
    id: '',
    name: '',
    description: '',
    color: '#3b82f6',
    settings: { ...DEFAULT_CARE_SETTINGS },
    patientIds: [],
  });
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [confirmApplyGlobalToAll, setConfirmApplyGlobalToAll] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null);

  // Modals & Mobile Sheets
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewMedModal, setShowNewMedModal] = useState(false);
  const [medToDelete, setMedToDelete] = useState(null);
  const [showDoseModal, setShowDoseModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showMobileMenuSheet, setShowMobileMenuSheet] = useState(false);
  const [showPatientPickerSheet, setShowPatientPickerSheet] = useState(false);
  const [pairingModalData, setPairingModalData] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copiedPairingCode, setCopiedPairingCode] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatErrorMsg, setChatErrorMsg] = useState('');
  const [unreadChatByPatient, setUnreadChatByPatient] = useState({});
  const [totalUnreadChat, setTotalUnreadChat] = useState(0);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushLoading, setPushLoading] = useState(false);
  const [systemVersions, setSystemVersions] = useState(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showAndroidPwaGuide, setShowAndroidPwaGuide] = useState(false);
  const pwaInstall = usePWAInstall();

  // Calendar states (Horário de Brasília)
  const [calYear, setCalYear] = useState(() => Number(getBrazilDateIso().slice(0, 4)) || 2026);
  const [calMonthIndex, setCalMonthIndex] = useState(() => (Number(getBrazilDateIso().slice(5, 7)) || 1) - 1);
  const [selectedCalDate, setSelectedCalDate] = useState(() => getBrazilDateIso());
  const [showCalSearch, setShowCalSearch] = useState(false);
  const [calSearchQuery, setCalSearchQuery] = useState('');
  const [noteForm, setNoteForm] = useState({ id: null, date: '', content: '', mood: '' });

  // Form states (sem valores clínicos pré-definidos)
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [newPatientForm, setNewPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [confirmPatientSave, setConfirmPatientSave] = useState(false);

  const [newMedForm, setNewMedForm] = useState(EMPTY_MED_FORM);
  const [scheduleBaseTime, setScheduleBaseTime] = useState('08:00');
  const [selectedIntervalHours, setSelectedIntervalHours] = useState(null);
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

  // Navigation history & PWA back-button state
  const [canGoBack, setCanGoBack] = useState(false);
  const tabStackRef = useRef(['dashboard']);
  const currentTabRef = useRef('dashboard');
  const isAuthenticatedRef = useRef(false);
  const authModeRef = useRef('login');
  const hasAnyOverlayRef = useRef(false);
  const overlayHistoryPushedRef = useRef(false);
  const signupHistoryPushedRef = useRef(false);
  const rootGuardArmedRef = useRef(false);
  const ignoringPopRef = useRef(0);
  const lastBackPressAtRef = useRef(0);
  const toastTimerRef = useRef(null);
  const seenNotifIdsRef = useRef(null);
  const pushSubscribedRef = useRef(false);
  const loadDataRef = useRef(null);
  const chatScrollEndRef = useRef(null);
  const showChatDrawerRef = useRef(false);
  const selectedPatientIdRef = useRef(null);

  const hasAnyOverlay =
    showRecoverModal ||
    showInviteModal ||
    showNewPatientModal ||
    showNewMedModal ||
    Boolean(medToDelete) ||
    showDoseModal ||
    showAppointmentModal ||
    showNoteModal ||
    showStockModal ||
    showMobileMenuSheet ||
    showPatientPickerSheet ||
    Boolean(pairingModalData) ||
    showNotificationsModal ||
    showChatDrawer;

  currentTabRef.current = currentTab;
  isAuthenticatedRef.current = isAuthenticated;
  authModeRef.current = authMode;
  hasAnyOverlayRef.current = hasAnyOverlay;
  showChatDrawerRef.current = showChatDrawer;
  selectedPatientIdRef.current = selectedPatientId;

  const showToast = useCallback((msg, type = 'success', duration = 4000) => {
    setNotification({ msg, type });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setNotification(null);
      toastTimerRef.current = null;
    }, duration);
  }, []);

  const closeAllOverlays = useCallback(() => {
    setShowRecoverModal(false);
    setShowInviteModal(false);
    setShowNewPatientModal(false);
    setShowNewMedModal(false);
    setMedToDelete(null);
    setShowDoseModal(false);
    setShowAppointmentModal(false);
    setShowNoteModal(false);
    setShowStockModal(false);
    setShowMobileMenuSheet(false);
    setShowPatientPickerSheet(false);
    setPairingModalData(null);
    setShowNotificationsModal(false);
    setShowChatDrawer(false);
  }, []);

  const navigateToTab = useCallback(
    (nextTab) => {
      const targetTab = nextTab || 'dashboard';
      const wasOverlayOpen = hasAnyOverlayRef.current || overlayHistoryPushedRef.current;

      if (wasOverlayOpen) {
        closeAllOverlays();
      }

      if (targetTab === currentTabRef.current) {
        return;
      }

      const nextStack = [...tabStackRef.current, targetTab];
      tabStackRef.current = nextStack;
      setCurrentTab(targetTab);
      setCanGoBack(nextStack.length > 1);

      if (typeof window !== 'undefined' && window.history?.pushState) {
        const statePayload = {
          medicare: true,
          kind: 'tab',
          tab: targetTab,
          depth: nextStack.length,
        };
        if (overlayHistoryPushedRef.current) {
          overlayHistoryPushedRef.current = false;
          window.history.replaceState(statePayload, '');
        } else {
          window.history.pushState(statePayload, '');
        }
        rootGuardArmedRef.current = true;
      }
    },
    [closeAllOverlays]
  );

  const switchAuthMode = useCallback((nextMode) => {
    setAuthError(null);
    if (nextMode === authModeRef.current) return;

    setAuthMode(nextMode);
    if (typeof window === 'undefined' || !window.history?.pushState) return;

    if (nextMode === 'signup') {
      if (!signupHistoryPushedRef.current) {
        signupHistoryPushedRef.current = true;
        window.history.pushState({ medicare: true, kind: 'auth', mode: 'signup' }, '');
        rootGuardArmedRef.current = true;
      }
    } else if (signupHistoryPushedRef.current) {
      signupHistoryPushedRef.current = false;
      ignoringPopRef.current += 1;
      window.history.back();
    }
  }, []);

  const handleUiBack = useCallback(() => {
    if (hasAnyOverlayRef.current) {
      closeAllOverlays();
      return;
    }
    if (!isAuthenticatedRef.current && authModeRef.current === 'signup') {
      if (
        signupHistoryPushedRef.current &&
        typeof window !== 'undefined' &&
        window.history.state?.kind === 'auth'
      ) {
        window.history.back();
      } else {
        signupHistoryPushedRef.current = false;
        setAuthMode('login');
        setAuthError(null);
      }
      return;
    }
    if (isAuthenticatedRef.current && tabStackRef.current.length > 1) {
      if (typeof window !== 'undefined' && window.history.state?.kind === 'tab') {
        window.history.back();
      } else {
        const nextStack = tabStackRef.current.slice(0, -1);
        tabStackRef.current = nextStack;
        setCurrentTab(nextStack[nextStack.length - 1] || 'dashboard');
        setCanGoBack(nextStack.length > 1);
      }
    }
  }, [closeAllOverlays]);

  // Registra Service Worker do PWA
  useEffect(() => {
    registerServiceWorker();
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Sincroniza abertura/fechamento de modais e sheets com o histórico do navegador
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return;

    if (hasAnyOverlay && !overlayHistoryPushedRef.current) {
      overlayHistoryPushedRef.current = true;
      window.history.pushState({ medicare: true, kind: 'overlay' }, '');
      rootGuardArmedRef.current = true;
    } else if (!hasAnyOverlay && overlayHistoryPushedRef.current) {
      overlayHistoryPushedRef.current = false;
      ignoringPopRef.current += 1;
      window.history.back();
    }
  }, [hasAnyOverlay]);

  // Limpa entrada de cadastro do histórico ao autenticar com sucesso
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    if (isAuthenticated && signupHistoryPushedRef.current) {
      signupHistoryPushedRef.current = false;
      window.history.replaceState({ medicare: true, kind: 'root-guard' }, '');
    }
  }, [isAuthenticated]);

  // Arma proteção contra fechamento acidental na raiz após primeira interação do usuário
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.pushState) return undefined;

    const armRootGuard = () => {
      if (
        rootGuardArmedRef.current ||
        hasAnyOverlayRef.current ||
        tabStackRef.current.length > 1 ||
        (!isAuthenticatedRef.current && authModeRef.current === 'signup')
      ) {
        return;
      }
      if (window.history.state?.kind !== 'root-guard') {
        window.history.replaceState({ medicare: true, kind: 'root-base' }, '');
        window.history.pushState({ medicare: true, kind: 'root-guard' }, '');
      }
      rootGuardArmedRef.current = true;
    };

    window.addEventListener('pointerdown', armRootGuard, { passive: true });
    window.addEventListener('keydown', armRootGuard, { passive: true });

    const handlePopState = () => {
      if (ignoringPopRef.current > 0) {
        ignoringPopRef.current -= 1;
        return;
      }

      if (hasAnyOverlayRef.current) {
        overlayHistoryPushedRef.current = false;
        closeAllOverlays();
        return;
      }

      if (!isAuthenticatedRef.current && authModeRef.current === 'signup') {
        signupHistoryPushedRef.current = false;
        setAuthMode('login');
        setAuthError(null);
        return;
      }

      if (isAuthenticatedRef.current && tabStackRef.current.length > 1) {
        const nextStack = tabStackRef.current.slice(0, -1);
        tabStackRef.current = nextStack;
        setCurrentTab(nextStack[nextStack.length - 1] || 'dashboard');
        setCanGoBack(nextStack.length > 1);
        return;
      }

      // Raiz do app: exige dois toques em Voltar em até 2,2s para sair do PWA
      const now = Date.now();
      if (now - lastBackPressAtRef.current < 2200) {
        rootGuardArmedRef.current = false;
        lastBackPressAtRef.current = 0;
        if (window.history.state?.kind === 'root-base') {
          window.history.back();
        }
        return;
      }

      lastBackPressAtRef.current = now;
      showToast('Pressione voltar novamente para sair do aplicativo', 'info', 2200);
      if (window.history.state?.kind !== 'root-guard') {
        window.history.pushState({ medicare: true, kind: 'root-guard' }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('pointerdown', armRootGuard);
      window.removeEventListener('keydown', armRootGuard);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [closeAllOverlays, showToast]);

  const syncCsrfToken = useCallback((explicitToken) => {
    const fromCookie = readCookieValue('medicare_csrf_token');
    const resolved = explicitToken || fromCookie || csrfTokenRef.current || '';
    csrfTokenRef.current = resolved;
    return resolved;
  }, []);

  const clearClientSession = useCallback(() => {
    const extraBackSteps =
      (tabStackRef.current.length > 1 ? tabStackRef.current.length - 1 : 0) +
      (overlayHistoryPushedRef.current ? 1 : 0);

    overlayHistoryPushedRef.current = false;
    signupHistoryPushedRef.current = false;
    tabStackRef.current = ['dashboard'];
    setCurrentTab('dashboard');
    setCanGoBack(false);
    closeAllOverlays();

    if (extraBackSteps > 0 && typeof window !== 'undefined' && window.history?.go) {
      ignoringPopRef.current += 1;
      window.history.go(-extraBackSteps);
    }

    setIsAuthenticated(false);
    setCurrentUser(null);
    csrfTokenRef.current = '';
    setPatients([]);
    setMedications([]);
    setDoseHistory([]);
    setAppointments([]);
    setCalendarNotes([]);
    setStockMovements([]);
    setAuditLogs([]);
    setApprovalRequests([]);
    setCareSettings({ ...DEFAULT_CARE_SETTINGS });
    setCareSettingsDraft({ ...DEFAULT_CARE_SETTINGS });
    setNotificationsList([]);
    setUnreadNotifCount(0);
    setShowChatDrawer(false);
    setChatMessages([]);
    setChatInput('');
    setChatErrorMsg('');
    setUnreadChatByPatient({});
    setTotalUnreadChat(0);
    seenNotifIdsRef.current = null;
    pushSubscribedRef.current = false;
    setSelectedPatientId(null);
    try {
      localStorage.removeItem('medicare_cuidador_jwt');
      localStorage.removeItem('medicare_cuidador_refresh_token');
      localStorage.removeItem('medicare_cuidador_user');
      document.cookie = 'medicare_cuidador_logged_in=; path=/; max-age=0; SameSite=Lax';
    } catch {
      // ignore storage errors
    }
  }, [closeAllOverlays]);

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

      const hasCookieSessionHint =
        typeof document !== 'undefined' &&
        (document.cookie.includes('medicare_cuidador_logged_in=') ||
          document.cookie.includes('medicare_csrf_token='));

      if (!hasCookieSessionHint && !legacyJwt && !legacyRefresh) {
        if (active) {
          clearClientSession();
          setAuthChecking(false);
        }
        return;
      }

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
        if (hasCookieSessionHint || legacyRefresh) {
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

  const savePushSubscriptionToServer = useCallback(
    async (sub) => {
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !currentUser?.id) return false;
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
        const res = await apiFetch('/api/rest/v1/push_subscriptions?on_conflict=endpoint', {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser.id,
            endpoint: sub.endpoint,
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
            timezone: tz,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'caregiver-web',
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [apiFetch, currentUser]
  );

  const showNativeBrowserAlert = useCallback(async (notifItem) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const title = notifItem?.titulo || 'MediCare Cuidador';
    const options = {
      body: notifItem?.mensagem || 'Nova atualização de acompanhamento.',
      icon: '/icon-192.png?v=5',
      badge: '/icon-96.png?v=5',
      tag: `medicare-cg-${notifItem?.id || Date.now()}`,
      data: { url: '/cuidador' },
    };
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg?.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      }
    } catch {
      // fallback to window Notification
    }
    try {
      new Notification(title, options);
    } catch {
      // ignore notification fallback errors
    }
  }, []);

  const fetchNotifications = useCallback(
    async ({ fromPoll = false } = {}) => {
      if (!isAuthenticated) return;
      try {
        const res = await apiFetch('/api/v1/caregiver/notifications');
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const rows = Array.isArray(data.notifications) ? data.notifications : [];
        const unread = typeof data.unreadCount === 'number'
          ? data.unreadCount
          : rows.filter((n) => !n.lida).length;

        setNotificationsList(rows);
        setUnreadNotifCount(unread);
        if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey);
        setPushConfigured(Boolean(data.pushConfigured));

        if (seenNotifIdsRef.current === null) {
          seenNotifIdsRef.current = new Set(rows.map((n) => String(n.id)));
        } else {
          const newlyArrived = rows.filter(
            (n) => !n.lida && !seenNotifIdsRef.current.has(String(n.id))
          );
          rows.forEach((n) => seenNotifIdsRef.current.add(String(n.id)));

          if (newlyArrived.length > 0) {
            const top = newlyArrived[0];
            showToast(top.titulo || 'Nova notificação de acompanhamento', top.tipo === 'atraso' || top.tipo === 'critico' ? 'error' : 'success', 5500);
            showNativeBrowserAlert(top);
            if (fromPoll && newlyArrived.some((n) => ['cuidador', 'critico', 'atraso', 'estoque'].includes(n.tipo))) {
              loadDataRef.current?.({ silent: true });
            }
          }
        }

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          data.vapidPublicKey &&
          !pushSubscribedRef.current
        ) {
          pushSubscribedRef.current = true;
          subscribeToPush(data.vapidPublicKey)
            .then((sub) => {
              if (sub) return savePushSubscriptionToServer(sub);
              return false;
            })
            .catch(() => {});
        }
      } catch {
        // ignore transient polling failure
      }
    },
    [isAuthenticated, apiFetch, showToast, showNativeBrowserAlert, savePushSubscriptionToServer]
  );

  const handleEnablePushNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Seu navegador não suporta notificações.', 'error');
      return;
    }
    setPushLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== 'granted') {
        showToast('Permissão de notificação não concedida neste navegador.', 'error');
        return;
      }
      if (vapidPublicKey) {
        const sub = await subscribeToPush(vapidPublicKey);
        if (sub) {
          const saved = await savePushSubscriptionToServer(sub);
          if (saved) {
            pushSubscribedRef.current = true;
          }
        }
      }
      showToast('Notificações ativadas para este dispositivo!');
    } catch {
      showToast('Não foi possível ativar notificações neste dispositivo.', 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const handleMarkNotificationRead = async (notifId, navigateToDashboard = false) => {
    setNotificationsList((prev) => prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n)));
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    try {
      await apiFetch('/api/v1/caregiver/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: notifId }),
      });
    } catch {
      // ignore network error
    }
    if (navigateToDashboard) {
      setShowNotificationsModal(false);
      navigateToTab('dashboard');
      loadDataRef.current?.();
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, lida: true })));
    setUnreadNotifCount(0);
    try {
      await apiFetch('/api/v1/caregiver/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAll: true }),
      });
      showToast('Notificações marcadas como lidas.');
    } catch {
      showToast('Erro ao atualizar notificações.', 'error');
    }
  };

  const loadSystemVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch('/api/system/versions', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.ok) {
          setSystemVersions(data);
        }
      }
    } catch {
      // ignora erro transitório ao consultar versões
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
    loadSystemVersions();
  }, [isAuthenticated, loadSystemVersions]);

  const fetchUnreadChatSummary = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/v1/chat?summary=1');
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setUnreadChatByPatient(data.unreadByPatient || {});
        setTotalUnreadChat(Number(data.totalUnread || 0));
      }
    } catch {
      // ignore transient summary failure
    }
  }, [isAuthenticated, apiFetch]);

  const handleMarkChatRead = useCallback(
    async (patientId) => {
      if (!isAuthenticated || !patientId) return;
      setUnreadChatByPatient((prev) => {
        const current = Number(prev[patientId] || 0);
        if (current <= 0) return prev;
        setTotalUnreadChat((tot) => Math.max(0, tot - current));
        return { ...prev, [patientId]: 0 };
      });
      try {
        await apiFetch('/api/v1/chat', {
          method: 'PATCH',
          body: JSON.stringify({ patientId }),
        });
      } catch {
        // ignore mark read failure
      }
    },
    [isAuthenticated, apiFetch]
  );

  const loadPatientChatMessages = useCallback(
    async (targetPatientId, { silent = false } = {}) => {
      if (!isAuthenticated || !targetPatientId) return;
      if (!silent) {
        setChatLoading(true);
        setChatErrorMsg('');
      }
      try {
        const res = await apiFetch(`/api/v1/chat?patientId=${encodeURIComponent(targetPatientId)}&limit=100`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) {
            setChatMessages([]);
            setChatErrorMsg(data.error || 'Chat indisponível para este paciente no momento.');
          }
          return;
        }
        setChatErrorMsg('');
        setChatMessages(Array.isArray(data.messages) ? data.messages : []);
        if (showChatDrawerRef.current && Number(data.unreadCount || 0) > 0) {
          handleMarkChatRead(targetPatientId);
        }
      } catch {
        if (!silent) {
          setChatErrorMsg('Erro ao carregar mensagens. Verifique sua conexão.');
        }
      } finally {
        if (!silent) {
          setChatLoading(false);
        }
      }
    },
    [isAuthenticated, apiFetch, handleMarkChatRead]
  );

  const handleOpenPatientChat = useCallback(
    (patientIdOverride = null) => {
      const targetId = patientIdOverride || selectedPatientIdRef.current;
      if (!targetId) {
        showToast('Selecione um paciente vinculado para abrir o chat.', 'info');
        return;
      }
      if (patientIdOverride && patientIdOverride !== selectedPatientIdRef.current) {
        setSelectedPatientId(patientIdOverride);
      }
      setShowChatDrawer(true);
      loadPatientChatMessages(targetId, { silent: false });
      handleMarkChatRead(targetId);
    },
    [loadPatientChatMessages, handleMarkChatRead, showToast]
  );

  const handleSendCaregiverChatMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const targetId = selectedPatientId;
    const cleanText = String(chatInput || '').trim();
    if (!targetId || !cleanText || chatSending) return;

    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;

    const optimisticMsg = {
      id: tempId,
      patient_id: targetId,
      sender_id: currentUser?.id || '',
      sender_role: 'cuidador',
      sender_name: currentUser?.user_metadata?.nome || currentUser?.email || 'Você',
      message: cleanText,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setChatInput('');
    setChatSending(true);
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await apiFetch('/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          id: tempId,
          patientId: targetId,
          message: cleanText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
        setChatInput(cleanText);
        showToast(data.error || 'Não foi possível enviar a mensagem.', 'error');
        return;
      }
      if (data.message) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      }
    } catch {
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      setChatInput(cleanText);
      showToast('Falha de rede ao enviar mensagem.', 'error');
    } finally {
      setChatSending(false);
    }
  };

  // Carrega dados do cuidador e pacientes autorizados (somente vínculos ativos!)
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;
    if (!silent) {
      setLoading(true);
    }
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
          role: prof?.role || 'paciente',
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
        if (!silent) {
          setCareSettingsLoading(true);
        }
        const [medsRes, histRes, eventsRes, logsRes, approvalsRes, notesRes, stockRes, settingsRes] = await Promise.all([
          apiFetch(`/api/rest/v1/medicamentos?user_id=eq.${validTargetId}&ativo=eq.true&order=created_at.asc`),
          apiFetch(`/api/rest/v1/historico_doses?user_id=eq.${validTargetId}&order=created_at.desc&limit=350`),
          apiFetch(`/api/rest/v1/health_events?user_id=eq.${validTargetId}&order=date.asc`),
          apiFetch('/api/rest/v1/rpc/list_audit_logs', {
            method: 'POST',
            body: JSON.stringify({ p_patient_id: validTargetId, p_limit: 30 }),
          }),
          apiFetch('/api/rest/v1/approval_requests?status=eq.pending&order=created_at.desc'),
          apiFetch(`/api/rest/v1/calendar_notes?user_id=eq.${validTargetId}&order=date.desc&limit=200`),
          apiFetch(`/api/rest/v1/stock_movements?user_id=eq.${validTargetId}&order=created_at.desc&limit=200`),
          apiFetch(`/api/v1/caregiver/settings?patientId=${encodeURIComponent(validTargetId)}`),
        ]);

        const meds = medsRes.ok ? await medsRes.json().catch(() => []) : [];
        const hist = histRes.ok ? await histRes.json().catch(() => []) : [];
        const events = eventsRes.ok ? await eventsRes.json().catch(() => []) : [];
        const logs = logsRes.ok ? await logsRes.json().catch(() => []) : [];
        const approvals = approvalsRes.ok ? await approvalsRes.json().catch(() => []) : [];
        const cNotes = notesRes.ok ? await notesRes.json().catch(() => []) : [];
        const sMoves = stockRes.ok ? await stockRes.json().catch(() => []) : [];
        const settingsJson = settingsRes.ok ? await settingsRes.json().catch(() => null) : null;
        const resolvedSettings = normalizeCareSettings(settingsJson?.settings || DEFAULT_CARE_SETTINGS);
        const resolvedMeta = settingsJson?.meta || {
          config_mode: 'global',
          group_id: null,
          group_name: null,
          group_color: null,
          effective_source: 'default',
          custom_settings: { ...DEFAULT_CARE_SETTINGS },
        };
        const resolvedGlobal = {
          ...normalizeCareSettings(settingsJson?.globalSettings || DEFAULT_CARE_SETTINGS),
          is_configured: Boolean(settingsJson?.globalSettings?.is_configured),
          updated_at: settingsJson?.globalSettings?.updated_at || null,
        };
        const resolvedGroups = Array.isArray(settingsJson?.groups) ? settingsJson.groups : [];
        const resolvedOverview = Array.isArray(settingsJson?.patientsOverview) ? settingsJson.patientsOverview : [];

        const activePatientIds = new Set(patientList.map((p) => String(p.patient_id)));
        const allPendingApprovals = Array.isArray(approvals)
          ? approvals.filter((reqItem) => reqItem && activePatientIds.has(String(reqItem.patient_id)))
          : [];
        const selectedApprovals = allPendingApprovals.filter(
          (reqItem) => String(reqItem.patient_id) === String(validTargetId)
        );

        setMedications(Array.isArray(meds) ? meds : []);
        setDoseHistory(Array.isArray(hist) ? hist : []);
        setAppointments(Array.isArray(events) ? events : []);
        setAuditLogs(Array.isArray(logs) ? logs : []);
        setAllApprovalRequests(allPendingApprovals);
        setApprovalRequests(selectedApprovals);
        setCalendarNotes(Array.isArray(cNotes) ? cNotes : []);
        setStockMovements(Array.isArray(sMoves) ? sMoves : []);
        setCareSettings(resolvedSettings);
        setPatientRuleMeta(resolvedMeta);
        setGlobalCareSettings(resolvedGlobal);
        setCareGroups(resolvedGroups);
        setPatientsOverview(resolvedOverview);
        if (!silent) {
          setCareSettingsDraft(
            resolvedMeta.config_mode === 'custom'
              ? normalizeCareSettings(resolvedMeta.custom_settings || resolvedSettings)
              : resolvedSettings
          );
          setPatientConfigModeDraft(normalizeConfigMode(resolvedMeta.config_mode, 'global'));
          setPatientGroupIdDraft(resolvedMeta.group_id || resolvedGroups[0]?.id || '');
          setGlobalCareSettingsDraft(normalizeCareSettings(resolvedGlobal));
        }
        setCareSettingsLoading(false);
      } else {
        setMedications([]);
        setDoseHistory([]);
        setAppointments([]);
        setAuditLogs([]);
        setAllApprovalRequests([]);
        setApprovalRequests([]);
        setCalendarNotes([]);
        setStockMovements([]);
        setCareSettings({ ...DEFAULT_CARE_SETTINGS });
        setPatientRuleMeta({
          config_mode: 'global',
          group_id: null,
          group_name: null,
          group_color: null,
          effective_source: 'default',
          custom_settings: { ...DEFAULT_CARE_SETTINGS },
        });
        const emptySetRes = await apiFetch('/api/v1/caregiver/settings').catch(() => null);
        const emptySetJson = emptySetRes && emptySetRes.ok ? await emptySetRes.json().catch(() => null) : null;
        const resolvedGlobal = {
          ...normalizeCareSettings(emptySetJson?.globalSettings || DEFAULT_CARE_SETTINGS),
          is_configured: Boolean(emptySetJson?.globalSettings?.is_configured),
          updated_at: emptySetJson?.globalSettings?.updated_at || null,
        };
        setGlobalCareSettings(resolvedGlobal);
        setCareGroups(Array.isArray(emptySetJson?.groups) ? emptySetJson.groups : []);
        setPatientsOverview(Array.isArray(emptySetJson?.patientsOverview) ? emptySetJson.patientsOverview : []);
        if (!silent) {
          setCareSettingsDraft({ ...DEFAULT_CARE_SETTINGS });
          setPatientConfigModeDraft('global');
          setPatientGroupIdDraft('');
          setGlobalCareSettingsDraft(normalizeCareSettings(resolvedGlobal));
        }
        setCareSettingsLoading(false);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
      setCareSettingsLoading(false);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
    fetchNotifications({ fromPoll: silent });
    fetchUnreadChatSummary();
  }, [isAuthenticated, selectedPatientId, apiFetch, fetchNotifications, fetchUnreadChatSummary]);

  loadDataRef.current = loadData;

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronização periódica em segundo plano (linha do tempo, aprovações, estoque e notificações)
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let lastSilentSyncAt = 0;

    const runBackgroundRefresh = () => {
      const now = Date.now();
      if (now - lastSilentSyncAt < 4000) return;
      lastSilentSyncAt = now;
      loadDataRef.current?.({ silent: true });
      if (showChatDrawerRef.current && selectedPatientIdRef.current) {
        loadPatientChatMessages(selectedPatientIdRef.current, { silent: true });
      }
    };

    const intervalId = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runBackgroundRefresh();
      }
    }, 20000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundRefresh();
      }
    };

    const onFocus = () => {
      runBackgroundRefresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [isAuthenticated, loadPatientChatMessages]);

  // Stream em tempo real (SSE) do chat Cuidador <-> Paciente
  useEffect(() => {
    if (!isAuthenticated || typeof EventSource === 'undefined') return undefined;
    const source = new EventSource('/api/v1/chat/stream', { withCredentials: true });

    source.addEventListener('chat_message', (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const msg = payload?.message;
        if (!msg || !msg.patient_id) return;

        const isViewingThread =
          showChatDrawerRef.current &&
          String(selectedPatientIdRef.current) === String(msg.patient_id);

        if (isViewingThread) {
          setChatMessages((prev) =>
            prev.some((m) => String(m.id) === String(msg.id)) ? prev : [...prev, msg]
          );
          if (msg.sender_role === 'paciente') {
            handleMarkChatRead(msg.patient_id);
          }
        } else if (msg.sender_role === 'paciente') {
          setUnreadChatByPatient((prev) => ({
            ...prev,
            [msg.patient_id]: Number(prev[msg.patient_id] || 0) + 1,
          }));
          setTotalUnreadChat((tot) => tot + 1);
          const preview = msg.message?.length > 70 ? `${msg.message.slice(0, 70)}...` : msg.message;
          showToast(`💬 ${msg.sender_name || 'Paciente'}: ${preview}`, 'info', 5500);
        }
      } catch {
        // ignore malformed sse event
      }
    });

    source.addEventListener('chat_read', (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (
          showChatDrawerRef.current &&
          String(selectedPatientIdRef.current) === String(payload?.patientId) &&
          payload?.readerRole === 'paciente'
        ) {
          const readTimestamp = payload.readAt || new Date().toISOString();
          setChatMessages((prev) =>
            prev.map((m) =>
              m.sender_role === 'cuidador' && !m.read_at ? { ...m, read_at: readTimestamp } : m
            )
          );
        }
      } catch {
        // ignore
      }
    });

    return () => {
      source.close();
    };
  }, [isAuthenticated, handleMarkChatRead, showToast]);

  // Rola suavemente para a última mensagem ao abrir ou receber mensagens
  useEffect(() => {
    if (!showChatDrawer) return;
    const timer = setTimeout(() => {
      chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [showChatDrawer, chatMessages.length]);

  // Aceitar convite
  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/accept_caregiver_invite', {
        method: 'POST',
        body: JSON.stringify({ p_token: inviteTokenInput.trim().toUpperCase() }),
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
      const todayIso = getBrazilDateIso();
      if (newPatientForm.dob > todayIso) {
        showToast('A data de nascimento não pode ser no futuro.', 'error');
        return;
      }
    }
    if (!confirmPatientSave) {
      showToast('Confirme que revisou os dados clínicos do paciente antes de salvar.', 'error');
      return;
    }

    const createdName = newPatientForm.nome.trim();
    setActionLoading(true);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/create_managed_patient', {
        method: 'POST',
        body: JSON.stringify({
          p_nome: createdName,
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
      if (data.patient_id) {
        setSelectedPatientId(data.patient_id);
      }
      if (data.pairing_code) {
        setCopiedPairingCode(false);
        setPairingModalData({
          patientId: data.patient_id,
          nome: createdName,
          code: data.pairing_code,
          expiresAt: data.pairing_expires_at || null,
        });
      }
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Gerar ou renovar código de ativação para o celular Android do paciente
  const handleOpenPatientPairing = async (patient) => {
    if (!patient?.patient_id) return;
    setPairingLoading(true);
    setCopiedPairingCode(false);
    try {
      const res = await apiFetch('/api/rest/v1/rpc/generate_patient_pairing_code', {
        method: 'POST',
        body: JSON.stringify({ p_patient_id: patient.patient_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false || !data.pairing_code) {
        throw new Error(data.error || 'Não foi possível gerar o código de vinculação.');
      }
      setPairingModalData({
        patientId: patient.patient_id,
        nome: data.patient_name || patient.nome,
        code: data.pairing_code,
        expiresAt: data.pairing_expires_at || null,
      });
    } catch (err) {
      showToast(err.message || 'Erro ao gerar código de vinculação', 'error');
    } finally {
      setPairingLoading(false);
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
    const treatmentType = newMedForm.treatment_type;
    const isSos = treatmentType === 'sos';
    const isTemp = treatmentType === 'temporary';
    const qtdNum = Number(newMedForm.quantidade);
    const daysNum = Number(newMedForm.treatment_days);
    const horariosArr = isSos
      ? []
      : newMedForm.horarios
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
    if (!['continuous', 'temporary', 'sos'].includes(treatmentType)) {
      showToast('Selecione o tipo de tratamento (Contínuo, Temporário ou SOS).', 'error');
      return;
    }
    if (isTemp && (!Number.isFinite(daysNum) || daysNum < 1 || newMedForm.treatment_days === '')) {
      showToast('Informe a duração do tratamento temporário em dias.', 'error');
      return;
    }
    if (!Number.isFinite(qtdNum) || qtdNum < 0 || newMedForm.quantidade === '') {
      showToast('Informe uma quantidade de estoque inicial válida.', 'error');
      return;
    }
    if (!isSos && (horariosArr.length === 0 || !horariosArr.every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)))) {
      showToast('Informe horários válidos no formato HH:MM (ex: 08:00, 20:00).', 'error');
      return;
    }
    if (!confirmMedSave) {
      showToast('Confirme que revisou a prescrição antes de salvar o medicamento.', 'error');
      return;
    }

    const sortedHorarios = Array.from(new Set(horariosArr)).sort((a, b) => a.localeCompare(b));
    const startIso = getBrazilDateIso();
    const endIso = isTemp
      ? addDaysBrazilDateIso(Math.max(0, Math.round(daysNum) - 1), startIso)
      : null;

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
          horarios: sortedHorarios,
          treatment_type: treatmentType,
          treatment_days: isTemp ? Math.round(daysNum) : null,
          start_date: isTemp ? startIso : null,
          end_date: isTemp ? endIso : null,
          observacoes: newMedForm.observacoes.trim() || null,
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
      setScheduleBaseTime('08:00');
      setSelectedIntervalHours(null);
      setConfirmMedSave(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Desativar / Remover Medicamento da prescrição ativa (preserva histórico de doses)
  const handleDeleteMedication = async () => {
    if (!medToDelete || !selectedPatientId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/rest/v1/medicamentos?id=eq.${medToDelete.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ativo: false,
          status: 'cancelado',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao remover medicamento');
      }
      showToast('Medicamento removido da prescrição ativa!');
      setMedToDelete(null);
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
      const targetDoseDate = selectedDoseTarget?.dose_date || getBrazilDateIso();
      const res = await apiFetch('/api/rest/v1/rpc/confirm_dose_retroactive', {
        method: 'POST',
        body: JSON.stringify({
          p_patient_id: selectedPatientId,
          p_med_id: selectedDoseTarget.med_id,
          p_hora: selectedDoseTarget.hora,
          p_dose_date: targetDoseDate,
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
      if (newAppointmentForm.date) {
        const parts = newAppointmentForm.date.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1]) {
          setCalYear(parts[0]);
          setCalMonthIndex(parts[1] - 1);
          setSelectedCalDate(newAppointmentForm.date);
        }
      }
      setShowAppointmentModal(false);
      setNewAppointmentForm(EMPTY_APPOINTMENT_FORM);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAppointment = async (aptId) => {
    if (!aptId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/rest/v1/health_events?id=eq.${aptId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Não foi possível excluir este compromisso.');
      }
      showToast('Compromisso removido da agenda.');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCalendarNote = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    const cleanDate = String(noteForm.date || selectedCalDate || getBrazilDateIso()).slice(0, 10);
    const cleanContent = noteForm.content.trim();
    if (!cleanContent) {
      showToast('Escreva o conteúdo da anotação antes de salvar.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const isEdit = Boolean(noteForm.id);
      const url = isEdit
        ? `/api/rest/v1/calendar_notes?id=eq.${noteForm.id}`
        : '/api/rest/v1/calendar_notes';
      const res = await apiFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(
          isEdit
            ? {
                date: cleanDate,
                content: cleanContent,
                mood: noteForm.mood.trim() || null,
              }
            : {
                user_id: selectedPatientId,
                date: cleanDate,
                content: cleanContent,
                mood: noteForm.mood.trim() || null,
              }
        ),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar anotação');
      }
      showToast(isEdit ? 'Anotação atualizada!' : 'Anotação salva no calendário!');
      setShowNoteModal(false);
      setNoteForm({ id: null, date: cleanDate, content: '', mood: '' });
      setSelectedCalDate(cleanDate);
      const parts = cleanDate.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1]) {
        setCalYear(parts[0]);
        setCalMonthIndex(parts[1] - 1);
      }
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCalendarNote = async (noteId) => {
    if (!noteId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/rest/v1/calendar_notes?id=eq.${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Não foi possível remover a anotação.');
      }
      showToast('Anotação removida.');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectCalDate = (dateIso) => {
    if (!dateIso) return;
    setSelectedCalDate(dateIso);
    const parts = dateIso.split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1]) {
      setCalYear(parts[0]);
      setCalMonthIndex(parts[1] - 1);
    }
  };

  const handlePrevCalMonth = () => {
    if (calMonthIndex === 0) {
      setCalMonthIndex(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonthIndex((m) => m - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calMonthIndex === 11) {
      setCalMonthIndex(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonthIndex((m) => m + 1);
    }
  };

  const handleJumpTodayCal = () => {
    const tIso = getBrazilDateIso();
    handleSelectCalDate(tIso);
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

  const applyCareSettingsApiResponse = (data) => {
    if (!data) return;
    if (data.globalSettings) {
      const gl = {
        ...normalizeCareSettings(data.globalSettings),
        is_configured: Boolean(data.globalSettings.is_configured),
        updated_at: data.globalSettings.updated_at || null,
      };
      setGlobalCareSettings(gl);
      setGlobalCareSettingsDraft(normalizeCareSettings(gl));
    }
    if (Array.isArray(data.groups)) {
      setCareGroups(data.groups);
    }
    if (Array.isArray(data.patientsOverview)) {
      setPatientsOverview(data.patientsOverview);
    }
    if (data.settings) {
      const eff = normalizeCareSettings(data.settings);
      setCareSettings(eff);
      if (data.meta) {
        setPatientRuleMeta(data.meta);
        setPatientConfigModeDraft(normalizeConfigMode(data.meta.config_mode, 'global'));
        setPatientGroupIdDraft(data.meta.group_id || data.groups?.[0]?.id || '');
        setCareSettingsDraft(
          data.meta.config_mode === 'custom'
            ? normalizeCareSettings(data.meta.custom_settings || eff)
            : eff
        );
      } else {
        setCareSettingsDraft(eff);
      }
    }
  };

  // Salvar configurações individuais do paciente selecionado (ou alterar modo Global / Grupo / Personalizado)
  const handleSaveCareSettings = async (overrideSettings = null, customReason = '', overrideMode = null, overrideGroupId = null) => {
    if (!selectedPatientId) return;
    const modeToSave = normalizeConfigMode(overrideMode || patientConfigModeDraft, 'custom');
    const groupIdToSave = modeToSave === 'group' ? (overrideGroupId || patientGroupIdDraft || '') : null;
    if (modeToSave === 'group' && !groupIdToSave) {
      showToast('Selecione ou crie um grupo antes de vincular o paciente.', 'error');
      return;
    }
    const payload = normalizeCareSettings(overrideSettings || careSettingsDraft);
    setCareSettingsSaving(true);
    try {
      const res = await apiFetch('/api/v1/caregiver/settings', {
        method: 'PUT',
        body: JSON.stringify({
          scope: 'patient',
          patientId: selectedPatientId,
          config_mode: modeToSave,
          group_id: groupIdToSave,
          settings: payload,
          reason: customReason || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Não foi possível salvar as regras de acompanhamento.');
      }
      applyCareSettingsApiResponse(data);
      const toastMsg =
        modeToSave === 'global'
          ? 'Paciente configurado para seguir as Regras Globais da clínica!'
          : modeToSave === 'group'
          ? 'Paciente vinculado ao grupo com sucesso!'
          : 'Regras individuais do paciente salvas com sucesso!';
      showToast(toastMsg);
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar configurações.', 'error');
    } finally {
      setCareSettingsSaving(false);
    }
  };

  // Salvar configurações globais do cuidador/clínica
  const handleSaveGlobalCareSettings = async ({ applyToAll = false } = {}) => {
    const payload = normalizeCareSettings(globalCareSettingsDraft);
    setCareSettingsSaving(true);
    try {
      const res = await apiFetch('/api/v1/caregiver/settings', {
        method: 'PUT',
        body: JSON.stringify({
          scope: 'global',
          patientId: selectedPatientId || undefined,
          applyToAll,
          settings: payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Não foi possível salvar as regras globais.');
      }
      applyCareSettingsApiResponse(data);
      setConfirmApplyGlobalToAll(false);
      showToast(
        applyToAll
          ? `Regras globais aplicadas para todos os ${data.appliedCount || patients.length} pacientes!`
          : 'Padrão global atualizado para pacientes em modo Global e novos cadastros!'
      );
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar regras globais.', 'error');
    } finally {
      setCareSettingsSaving(false);
    }
  };

  // Iniciar criação/edição de grupo da clínica
  const startCreateNewGroup = () => {
    setSelectedGroupId('new');
    setConfirmDeleteGroupId(null);
    setGroupMemberSearch('');
    setGroupDraft({
      id: '',
      name: '',
      description: '',
      color: '#3b82f6',
      settings: normalizeCareSettings(globalCareSettings),
      patientIds: [],
    });
  };

  const selectGroupForEdit = (grp) => {
    if (!grp) return;
    setSelectedGroupId(grp.id);
    setConfirmDeleteGroupId(null);
    setGroupDraft({
      id: grp.id,
      name: grp.name || '',
      description: grp.description || '',
      color: grp.color || '#3b82f6',
      settings: normalizeCareSettings(grp.settings || DEFAULT_CARE_SETTINGS),
      patientIds: Array.isArray(grp.patient_ids) ? [...grp.patient_ids] : [],
    });
  };

  // Salvar grupo + membros vinculados
  const handleSaveCareGroup = async () => {
    const cleanName = String(groupDraft.name || '').trim();
    if (!cleanName) {
      showToast('Informe um nome para o grupo (ex: Ala A - Alta Supervisão).', 'error');
      return;
    }
    setCareSettingsSaving(true);
    try {
      const res = await apiFetch('/api/v1/caregiver/settings', {
        method: 'PUT',
        body: JSON.stringify({
          scope: 'group',
          patientId: selectedPatientId || undefined,
          groupId: groupDraft.id || undefined,
          name: cleanName,
          description: String(groupDraft.description || '').trim(),
          color: groupDraft.color || '#3b82f6',
          settings: normalizeCareSettings(groupDraft.settings),
          patientIds: Array.isArray(groupDraft.patientIds) ? groupDraft.patientIds : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Não foi possível salvar o grupo.');
      }
      applyCareSettingsApiResponse(data);
      if (data.group?.id) {
        setSelectedGroupId(data.group.id);
        setGroupDraft({
          id: data.group.id,
          name: data.group.name,
          description: data.group.description || '',
          color: data.group.color || '#3b82f6',
          settings: normalizeCareSettings(data.group.settings),
          patientIds: Array.isArray(data.group.patient_ids) ? data.group.patient_ids : [],
        });
      }
      showToast(`Grupo "${cleanName}" salvo com ${groupDraft.patientIds.length} paciente(s)!`);
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar grupo.', 'error');
    } finally {
      setCareSettingsSaving(false);
    }
  };

  // Excluir grupo de pacientes
  const handleDeleteCareGroup = async (groupId) => {
    if (!groupId) return;
    setCareSettingsSaving(true);
    try {
      const query = new URLSearchParams({ groupId });
      if (selectedPatientId) query.set('patientId', selectedPatientId);
      const res = await apiFetch(`/api/v1/caregiver/settings?${query.toString()}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Não foi possível excluir o grupo.');
      }
      applyCareSettingsApiResponse(data);
      setConfirmDeleteGroupId(null);
      const remaining = Array.isArray(data.groups) ? data.groups : [];
      if (remaining.length > 0) {
        selectGroupForEdit(remaining[0]);
      } else {
        setSelectedGroupId(null);
      }
      showToast('Grupo excluído. Os participantes retornaram ao modo Global.');
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir grupo.', 'error');
    } finally {
      setCareSettingsSaving(false);
    }
  };

  // Alterar rapidamente o modo de um paciente pela lista da clínica (Global / Grupo / Personalizar)
  const handleQuickAssignPatientMode = async (targetPatientId, mode, groupId = null) => {
    if (!targetPatientId) return;
    setCareSettingsSaving(true);
    try {
      const res = await apiFetch('/api/v1/caregiver/settings', {
        method: 'PUT',
        body: JSON.stringify({
          scope: 'bulk_assign',
          patientId: selectedPatientId || undefined,
          patientIds: [targetPatientId],
          config_mode: mode,
          group_id: mode === 'group' ? groupId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Não foi possível atualizar o modo do paciente.');
      }
      applyCareSettingsApiResponse(data);
      showToast('Modo de gerenciamento do paciente atualizado!');
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar paciente.', 'error');
    } finally {
      setCareSettingsSaving(false);
    }
  };

  // Doses do dia com distinção semântica precisa entre os 5 estados
  const todayDoses = [];
  const nowObj = new Date();
  const todayIso = getBrazilDateIso(nowObj);
  const currentMinutesOfDay = getBrazilMinutesOfDay(nowObj);

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
          : getBrazilDateIso(h.created_at);
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

      const pendingApproval = approvalRequests.find((reqItem) => {
        const reqMedId = String(reqItem?.med_id || '');
        const reqHora = String(reqItem?.hora || '').trim().slice(0, 5);
        const reqDate = reqItem?.dose_date ? String(reqItem.dose_date).slice(0, 10) : todayIso;
        return reqMedId === String(med.id || '') && reqHora === hora && reqDate === todayIso;
      }) || null;

      let displayCategory = 'pending'; // 'patient_confirmed' | 'caregiver_confirmed' | 'late' | 'missed' | 'unconfirmed' | 'pending'
      let statusLabel = 'Prevista';

      if (pendingApproval) {
        displayCategory = 'unconfirmed';
        statusLabel =
          pendingApproval.action_type === 'undo_dose' || pendingApproval.requested_status === 'pending'
            ? 'Aguardando aprovação (Desfazer)'
            : 'Aguardando sua validação';
      } else if (rawStatus === 'missed') {
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
        pending_approval: pendingApproval,
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

  const pendingApprovalsByPatient = {};
  allApprovalRequests.forEach((reqItem) => {
    const pid = String(reqItem?.patient_id || '');
    if (!pid) return;
    pendingApprovalsByPatient[pid] = (pendingApprovalsByPatient[pid] || 0) + 1;
  });
  const totalPendingApprovals = allApprovalRequests.length;
  const otherPatientsPendingIds = Array.from(
    new Set(
      allApprovalRequests
        .map((reqItem) => String(reqItem?.patient_id || ''))
        .filter((pid) => pid && pid !== String(selectedPatientId || ''))
    )
  );

  const calendarMonthData = buildCalendarMonthData({
    year: calYear,
    monthIndex: calMonthIndex,
    todayIso,
    currentMinutesOfDay,
    missedDoseMinutes: careSettings.missed_dose_minutes,
    medications,
    doseHistory,
    appointments,
    calendarNotes,
    stockMovements,
  });

  const activeSelectedCalDate = selectedCalDate || todayIso;
  const selectedDayDetails = getDayDetails({
    dateIso: activeSelectedCalDate,
    todayIso,
    currentMinutesOfDay,
    missedDoseMinutes: careSettings.missed_dose_minutes,
    medications,
    doseHistory,
    appointments,
    calendarNotes,
    stockMovements,
  });

  const selectedPatient =
    patients.find((p) => p.patient_id === selectedPatientId) || patients[0] || null;

  const navItems = [
    { id: 'dashboard', label: 'Central de Doses', mobileLabel: 'Doses', icon: Home },
    { id: 'patients', label: 'Pacientes', mobileLabel: 'Pacientes', icon: Users },
    { id: 'management', label: 'Gerenciamento', mobileLabel: 'Gerenciar', icon: SlidersHorizontal },
    { id: 'meds', label: 'Medicamentos & Estoque', mobileLabel: 'Remédios', icon: Pill },
    { id: 'agenda', label: 'Calendário & Agenda', mobileLabel: 'Agenda', icon: Calendar },
    { id: 'reports', label: 'Indicadores', mobileLabel: 'Indicadores', icon: BarChart3 },
    { id: 'audit', label: 'Auditoria', mobileLabel: 'Auditoria', icon: History },
    { id: 'about', label: 'Sobre & Apps', mobileLabel: 'Sobre', icon: Info },
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
      : currentTab === 'management'
      ? 'Painel de Gerenciamento'
      : currentTab === 'meds'
      ? 'Medicamentos & Estoque'
      : currentTab === 'agenda'
      ? 'Calendário & Agenda'
      : currentTab === 'reports'
      ? 'Indicadores de Adesão'
      : currentTab === 'audit'
      ? 'Trilha de Auditoria'
      : 'Sobre o MediCare';

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
        {notification && (
          <div
            role="status"
            className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-sm px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all ${
              notification.type === 'error'
                ? 'bg-rose-950/95 border-rose-700 text-rose-200'
                : notification.type === 'info'
                ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                : 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertTriangle size={16} className="w-4 h-4 shrink-0" />
            ) : notification.type === 'info' ? (
              <AlertCircle size={16} className="w-4 h-4 shrink-0 text-blue-400" />
            ) : (
              <CheckCircle2 size={16} className="w-4 h-4 shrink-0" />
            )}
            <span className="leading-snug">{notification.msg}</span>
          </div>
        )}

        <OfflineIndicator />

        <div className="w-full max-w-[420px] bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-8 shadow-2xl shadow-black/40 relative">
          {authMode === 'signup' && (
            <button
              type="button"
              onClick={handleUiBack}
              aria-label="Voltar para tela de login"
              className="absolute top-4 left-4 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl bg-[#0b1120] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            >
              <ArrowLeft size={18} className="w-4 h-4" />
            </button>
          )}

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
              onClick={() => switchAuthMode('login')}
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
              onClick={() => switchAuthMode('signup')}
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
                  onClick={() => switchAuthMode('signup')}
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
                  onClick={() => switchAuthMode('login')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Entrar aqui
                </button>
              </div>
            </form>
          )}

          <PWAInstallButton variant="auth" />

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
              : notification.type === 'info'
              ? 'bg-slate-900/95 border-slate-700 text-slate-100'
              : 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle size={16} className="w-4 h-4 shrink-0" />
          ) : notification.type === 'info' ? (
            <AlertCircle size={16} className="w-4 h-4 shrink-0 text-blue-400" />
          ) : (
            <CheckCircle2 size={16} className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-snug">{notification.msg}</span>
        </div>
      )}

      <OfflineIndicator />

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
              const badgeCount = item.id === 'dashboard' ? totalPendingApprovals : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon size={17} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeCount > 0 && (
                    <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center tabular-nums shrink-0">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
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
        <header className="h-14 md:h-16 border-b border-slate-800/90 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3 bg-[#0b1120]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {canGoBack ? (
              <button
                type="button"
                onClick={handleUiBack}
                aria-label="Voltar para tela anterior"
                title="Voltar"
                className="inline-flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl bg-[#131d31] border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ArrowLeft size={18} className="w-4 h-4" />
              </button>
            ) : (
              <Image
                src={medicareLogo}
                alt="MediCare Cuidador"
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                className="md:hidden w-8 h-8 rounded-lg shadow-sm shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-white truncate leading-tight">
                {currentTab === 'patients' ? (
                  <>
                    <span className="sm:hidden">Pacientes</span>
                    <span className="hidden sm:inline">Pacientes e Vínculos</span>
                  </>
                ) : (
                  currentTabTitle
                )}
              </h2>
              {selectedPatient && currentTab !== 'patients' && (
                <p className="hidden md:block text-xs text-slate-400 truncate mt-0.5">
                  {selectedPatient.nome} · {selectedPatient.relationship_label}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="header" />

            {/* Seletor rápido de paciente no Mobile (omitido na aba Pacientes onde a lista já está aberta) */}
            {patients.length > 0 && currentTab !== 'patients' && (
              <button
                type="button"
                onClick={() => setShowPatientPickerSheet(true)}
                className="md:hidden inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] max-w-[125px] rounded-xl bg-[#131d31] border border-slate-700/80 text-xs font-semibold text-slate-100 hover:border-slate-600 transition-colors"
                aria-label="Selecionar paciente"
              >
                <span className="truncate">{selectedPatient?.nome?.split(' ')[0] || 'Paciente'}</span>
                <ChevronDown size={14} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            )}

            {patients.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenPatientChat()}
                title="Conversar com o paciente"
                aria-label="Conversar com o paciente"
                className="relative inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 md:px-3 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/35 text-emerald-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <MessageSquare size={16} className="w-4 h-4 shrink-0 text-emerald-300" />
                <span className="hidden lg:inline text-xs font-semibold">Chat</span>
                {totalUnreadChat > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center border border-[#0b1120] tabular-nums">
                    {totalUnreadChat > 9 ? '9+' : totalUnreadChat}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                fetchNotifications({ fromPoll: false });
                setShowNotificationsModal(true);
              }}
              title="Notificações e alertas"
              aria-label="Notificações e alertas"
              className="relative inline-flex items-center justify-center min-w-[40px] min-h-[40px] px-2.5 rounded-xl bg-[#131d31] md:bg-slate-800/70 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Bell size={16} className={`w-4 h-4 ${unreadNotifCount > 0 ? 'text-amber-300' : ''}`} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border border-[#0b1120] tabular-nums">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

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

        {/* Sub-navegação mobile entre Gerenciar, Indicadores, Auditoria e Sobre */}
        {(currentTab === 'management' || currentTab === 'reports' || currentTab === 'audit' || currentTab === 'about') && (
          <div className="md:hidden px-4 pt-3">
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#131d31] border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => navigateToTab('management')}
                className={`min-h-[40px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'management'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Gerenciar
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('reports')}
                className={`min-h-[40px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'reports'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Indicadores
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('audit')}
                className={`min-h-[40px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'audit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Auditoria
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('about')}
                className={`min-h-[40px] rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  currentTab === 'about'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sobre
              </button>
            </div>
          </div>
        )}

        {/* Tab Body */}
        <main className="flex-1 px-4 py-5 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-24 md:pb-10">
          {/* Estado vazio quando não há paciente com vínculo ativo */}
          {patients.length === 0 && currentTab !== 'patients' && currentTab !== 'about' && currentTab !== 'management' && (
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
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => navigateToTab('management')}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold underline-offset-2 hover:underline"
                    >
                      <SlidersHorizontal size={12} className="w-3 h-3 shrink-0" />
                      <span>
                        {patientRuleMeta?.config_mode === 'group' && patientRuleMeta?.group_name
                          ? `Grupo (${patientRuleMeta.group_name})`
                          : patientRuleMeta?.config_mode === 'custom'
                          ? 'Individual'
                          : 'Global'}
                        {' · '}
                        {careSettings.require_caregiver_confirm
                          ? 'Com validação'
                          : careSettings.require_confirm_after_missed
                          ? 'Valida se perdida'
                          : 'Confirmação direta'}
                        {' · '}
                        {careSettings.overdue_notify_minutes > 0
                          ? `Aviso +${formatMinutesLabelPt(careSettings.overdue_notify_minutes)}`
                          : 'Aviso atraso desligado'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
                  {selectedPatient.role !== 'independente' && (
                    <button
                      type="button"
                      onClick={() => handleOpenPatientChat(selectedPatient.patient_id)}
                      className="relative col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-200 font-semibold text-xs border border-emerald-500/35 transition-colors whitespace-nowrap"
                    >
                      <MessageSquare size={15} className="w-4 h-4 shrink-0 text-emerald-300" />
                      <span>Conversar</span>
                      {(unreadChatByPatient[selectedPatient.patient_id] || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold tabular-nums">
                          {unreadChatByPatient[selectedPatient.patient_id]}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateToTab('management')}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-200 font-semibold text-xs border border-indigo-500/30 transition-colors whitespace-nowrap"
                  >
                    <SlidersHorizontal size={15} className="w-4 h-4 shrink-0 text-indigo-300" />
                    <span>Gerenciar</span>
                  </button>
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
                    className="col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                  >
                    <Calendar size={15} className="w-4 h-4 shrink-0" />
                    <span>Compromisso</span>
                  </button>
                </div>
              </div>

              {/* Aviso caso outros pacientes acompanhados possuam solicitações pendentes */}
              {otherPatientsPendingIds.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-500/35 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                      <AlertTriangle size={15} className="w-4 h-4 shrink-0" />
                      <span>Outros pacientes aguardando sua confirmação de dose</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Toque em um paciente abaixo para abrir e aprovar ou recusar a solicitação:
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {otherPatientsPendingIds.map((pid) => {
                      const otherP = patients.find((p) => String(p.patient_id) === pid);
                      const count = pendingApprovalsByPatient[pid] || 0;
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => setSelectedPatientId(pid)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>{otherP?.nome?.split(' ')[0] || 'Paciente'}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold tabular-nums">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                          ? formatBrazilTime(dose.administered_at)
                          : null;
                        const recordedTimeStr = dose.recorded_at
                          ? formatBrazilTime(dose.recorded_at)
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
                                {dose.pending_approval && (
                                  <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 mt-1">
                                    Pedido do paciente: <strong>&ldquo;{dose.pending_approval.reason || 'Confirmação pendente'}&rdquo;</strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="sm:self-center shrink-0">
                              {dose.pending_approval ? (
                                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleResolveApprovalRequest(dose.pending_approval.id, 'approved')}
                                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                                  >
                                    <Check size={14} className="w-3.5 h-3.5" />
                                    <span>Aprovar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleResolveApprovalRequest(dose.pending_approval.id, 'rejected')}
                                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                                  >
                                    <X size={14} className="w-3.5 h-3.5" />
                                    <span>Recusar</span>
                                  </button>
                                </div>
                              ) : (
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
                              )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patients
                    .filter((p) => p.nome.toLowerCase().includes(searchPatient.toLowerCase()))
                    .map((p) => {
                      const overview = patientsOverview.find(
                        (ov) => String(ov.patient_id) === String(p.patient_id)
                      );
                      const pendingCount = pendingApprovalsByPatient[String(p.patient_id)] || 0;
                      const unreadChat = unreadChatByPatient[p.patient_id] || 0;
                      const modeLabel =
                        overview?.config_mode === 'group'
                          ? `Grupo: ${overview.group_name || 'Ala'}`
                          : overview?.config_mode === 'custom'
                          ? 'Regras individuais'
                          : 'Padrão global';
                      const modeBadgeClass =
                        overview?.config_mode === 'group'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : overview?.config_mode === 'custom'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300';

                      return (
                        <div
                          key={p.patient_id}
                          onClick={() => setSelectedPatientId(p.patient_id)}
                          className={`bg-[#131d31] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                            selectedPatientId === p.patient_id
                              ? 'border-blue-500 ring-1 ring-blue-500/40'
                              : 'border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          {/* Cabeçalho limpo sem sobreposição de botões */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-base shrink-0">
                                {p.nome.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <h3 className="font-bold text-white text-sm sm:text-base leading-snug break-words">
                                  {p.nome}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/70 text-slate-200 font-medium">
                                    {p.relationship_label}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-300">
                                    {p.blood_type ? `Sangue ${p.blood_type}` : 'Sangue N/I'}
                                  </span>
                                  {p.is_managed && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                                      Dependente
                                    </span>
                                  )}
                                  {overview && (
                                    <span className={`px-2 py-0.5 rounded-md border font-semibold ${modeBadgeClass}`}>
                                      {modeLabel}
                                    </span>
                                  )}
                                </div>

                                {pendingCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatientId(p.patient_id);
                                      navigateToTab('dashboard');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-[11px] font-bold transition-colors"
                                  >
                                    <AlertTriangle size={12} className="w-3 h-3 text-amber-300 shrink-0" />
                                    <span>
                                      {pendingCount} dose{pendingCount === 1 ? '' : 's'} aguardando aprovação
                                    </span>
                                  </button>
                                )}
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
                              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                            >
                              <Trash2 size={16} className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Barra dedicada de ações no rodapé do card */}
                          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                            {p.role !== 'independente' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPatientChat(p.patient_id);
                                }}
                                title={`Conversar com ${p.nome}`}
                                aria-label={`Conversar com ${p.nome}`}
                                className="relative min-h-[40px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/35 text-emerald-200 text-xs font-semibold transition-colors whitespace-nowrap"
                              >
                                <MessageSquare size={14} className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                                <span>Conversar</span>
                                {unreadChat > 0 && (
                                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                                    {unreadChat}
                                  </span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPatientId(p.patient_id);
                                navigateToTab('management');
                              }}
                              title="Configurar regras de gerenciamento deste paciente"
                              aria-label={`Gerenciar regras de ${p.nome}`}
                              className="min-h-[40px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/35 text-indigo-200 text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <SlidersHorizontal size={14} className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
                              <span>Gerenciar</span>
                            </button>
                            <button
                              type="button"
                              disabled={pairingLoading}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPatientPairing(p);
                              }}
                              title="Vincular celular Android do paciente"
                              aria-label={`Vincular celular de ${p.nome}`}
                              className="min-h-[40px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-blue-200 text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <Smartphone size={14} className="w-3.5 h-3.5 shrink-0 text-blue-300" />
                              <span>Vincular</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPatientId(p.patient_id);
                                navigateToTab('dashboard');
                              }}
                              title={`Abrir doses de ${p.nome}`}
                              className={`min-h-[40px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                                pendingCount > 0
                                  ? 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/40 text-amber-200'
                                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                              }`}
                            >
                              <Home size={14} className="w-3.5 h-3.5 shrink-0" />
                              <span>{pendingCount > 0 ? `Doses (${pendingCount})` : 'Ver Doses'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PAINEL DE GERENCIAMENTO (GLOBAL, GRUPOS E POR PACIENTE) */}
          {currentTab === 'management' && (() => {
            const globalCount = patientsOverview.filter((p) => p.config_mode === 'global').length;
            const groupCount = patientsOverview.filter((p) => p.config_mode === 'group').length;
            const customCount = patientsOverview.filter((p) => p.config_mode === 'custom').length;

            // Helper reutilizável para editar as regras clínicas em qualquer escopo (Paciente, Global ou Grupo)
            const renderRuleEditor = ({ draft, onChangeDraft, idPrefix, readOnly = false }) => {
              const safeDraft = normalizeCareSettings(draft);
              const matchingPreset = CARE_MANAGEMENT_PRESETS.find(
                (preset) => JSON.stringify(normalizeCareSettings(preset.settings)) === JSON.stringify(safeDraft)
              );
              const isOverduePreset = OVERDUE_NOTIFY_OPTIONS.some(
                (opt) => opt.minutes === Number(safeDraft.overdue_notify_minutes)
              );
              const isMissedWindowPreset = MISSED_DOSE_WINDOW_OPTIONS.some(
                (opt) => opt.minutes === Number(safeDraft.missed_dose_minutes)
              );

              const updateDraft = (updater) => {
                if (readOnly) return;
                onChangeDraft((prev) => {
                  const base = normalizeCareSettings(prev);
                  return typeof updater === 'function' ? updater(base) : { ...base, ...updater };
                });
              };

              return (
                <div className="space-y-5">
                  {readOnly && (
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Modo somente visualização: estas regras estão sendo herdadas automaticamente. Para ajustar os parâmetros aqui, altere no escopo correspondente ou personalize este paciente.
                      </span>
                    </div>
                  )}

                  {/* Perfis Rápidos de Acompanhamento */}
                  <div className={`bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 space-y-3.5 ${readOnly ? 'opacity-80' : ''}`}>
                    <div>
                      <h2 className="text-sm font-bold text-white">Perfis Rápidos de Acompanhamento</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Escolha um modelo pronto ou personalize cada regra detalhadamente abaixo.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {CARE_MANAGEMENT_PRESETS.map((preset) => {
                        const isSelectedPreset = matchingPreset?.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => updateDraft(() => normalizeCareSettings(preset.settings))}
                            className={`text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                              readOnly ? 'cursor-not-allowed' : ''
                            } ${
                              isSelectedPreset
                                ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/40'
                                : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">{preset.label}</span>
                              {isSelectedPreset && (
                                <CheckCircle2 size={15} className="w-4 h-4 text-blue-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{preset.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grid Principal: Validação de Doses + Notificações & Estoque */}
                  <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${readOnly ? 'opacity-85' : ''}`}>
                    {/* Bloco 1: Confirmação de Doses e Autonomia */}
                    <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                          <ShieldCheck size={18} className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white">Confirmação e Autonomia de Doses</h2>
                          <p className="text-xs text-slate-400">
                            Controle quando o paciente precisa da sua aprovação no aplicativo Android.
                          </p>
                        </div>
                      </div>

                      {/* Regra 1: Precisa confirmar que o paciente tomou a dose */}
                      <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-white">
                              Precisa confirmar que o paciente tomou a dose?
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {safeDraft.require_caregiver_confirm
                                ? 'Ativado: ao tocar em "Tomei", o paciente envia uma solicitação para sua aprovação e o app avança para a próxima dose.'
                                : 'Desativado: quando estiver dentro do prazo, o paciente confirma a dose diretamente sem aguardar sua validação.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            disabled={readOnly}
                            aria-checked={safeDraft.require_caregiver_confirm}
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                require_caregiver_confirm: !prev.require_caregiver_confirm,
                              }))
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                              readOnly ? 'cursor-not-allowed opacity-70' : ''
                            } ${
                              safeDraft.require_caregiver_confirm
                                ? 'bg-blue-600 border-blue-500'
                                : 'bg-slate-700 border-slate-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                safeDraft.require_caregiver_confirm ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Regra 2: Confirmar após dose perdida */}
                      <div
                        className={`p-4 rounded-xl border space-y-3 transition-colors ${
                          !safeDraft.require_caregiver_confirm
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-[#0b1120]/60 border-slate-800/80 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                Confirmar após a dose ser considerada perdida?
                              </span>
                              {safeDraft.require_caregiver_confirm && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  Aplicado se desativar acima
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {safeDraft.require_confirm_after_missed
                                ? `Ativado: mesmo com confirmação direta no horário, se passarem mais de ${formatMinutesLabelPt(
                                    safeDraft.missed_dose_minutes
                                  )} (dose perdida), o paciente precisará da sua aprovação para confirmar depois.`
                                : 'Desativado: mesmo depois que a dose for considerada perdida, o paciente ainda pode confirmar sozinho sem validação.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            disabled={readOnly}
                            aria-checked={safeDraft.require_confirm_after_missed}
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                require_confirm_after_missed: !prev.require_confirm_after_missed,
                              }))
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                              readOnly ? 'cursor-not-allowed opacity-70' : ''
                            } ${
                              safeDraft.require_confirm_after_missed
                                ? 'bg-amber-500 border-amber-400'
                                : 'bg-slate-700 border-slate-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                safeDraft.require_confirm_after_missed ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Regra 3: Exigir aprovação para desfazer dose */}
                      <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-white">
                              Exigir aprovação para desfazer dose tomada?
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Evita que o paciente desmarque por engano uma medicação já registrada no dia.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            disabled={readOnly}
                            aria-checked={safeDraft.require_confirm_undo}
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                require_confirm_undo: !prev.require_confirm_undo,
                              }))
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                              readOnly ? 'cursor-not-allowed opacity-70' : ''
                            } ${
                              safeDraft.require_confirm_undo
                                ? 'bg-blue-600 border-blue-500'
                                : 'bg-slate-700 border-slate-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                safeDraft.require_confirm_undo ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Regra 4: Janela de Dose Perdida */}
                      <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-white">
                            Prazo para considerar a dose como &ldquo;Perdida&rdquo;
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Após esse tempo sem registro no dia, a dose sai do card principal do paciente e fica marcada como perdida.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {MISSED_DOSE_WINDOW_OPTIONS.map((opt) => {
                            const activeOpt = Number(safeDraft.missed_dose_minutes) === opt.minutes;
                            return (
                              <button
                                key={opt.minutes}
                                type="button"
                                disabled={readOnly}
                                onClick={() =>
                                  updateDraft((prev) => ({ ...prev, missed_dose_minutes: opt.minutes }))
                                }
                                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                  readOnly ? 'cursor-not-allowed' : ''
                                } ${
                                  activeOpt
                                    ? 'bg-blue-600 text-white border-blue-500'
                                    : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600'
                                }`}
                              >
                                {opt.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                        {!isMissedWindowPreset && (
                          <p className="text-[11px] text-blue-300 tabular-nums">
                            Prazo personalizado ativo: {safeDraft.missed_dose_minutes} min ({formatMinutesLabelPt(safeDraft.missed_dose_minutes)})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bloco 2: Notificações ao Cuidador + Estoque + Prescrição */}
                    <div className="space-y-5">
                      <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center justify-center shrink-0">
                            <Bell size={18} className="w-4 h-4" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-white">Alertas e Notificações ao Cuidador</h2>
                            <p className="text-xs text-slate-400">
                              Defina em quanto tempo deseja ser notificado se o paciente não tomar o remédio.
                            </p>
                          </div>
                        </div>

                        {/* Regra 5: Período para notificar se não tomou */}
                        <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-bold text-white">
                              Notificar cuidador se não tomar após:
                            </div>
                            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold tabular-nums">
                              {formatMinutesLabelPt(safeDraft.overdue_notify_minutes)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {OVERDUE_NOTIFY_OPTIONS.map((opt) => {
                              const activeOpt = Number(safeDraft.overdue_notify_minutes) === opt.minutes;
                              return (
                                <button
                                  key={opt.minutes}
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      overdue_notify_minutes: opt.minutes,
                                    }))
                                  }
                                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                    readOnly ? 'cursor-not-allowed' : ''
                                  } ${
                                    activeOpt
                                      ? opt.minutes === 0
                                        ? 'bg-rose-600 text-white border-rose-500'
                                        : 'bg-blue-600 text-white border-blue-500'
                                      : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  {opt.shortLabel}
                                </button>
                              );
                            })}
                          </div>
                          <div className="pt-1 flex flex-wrap items-center gap-2.5">
                            <label htmlFor={`${idPrefix}-custom-overdue-mins`} className="text-[11px] text-slate-400">
                              Ou informe em minutos (0 = desativado):
                            </label>
                            <input
                              id={`${idPrefix}-custom-overdue-mins`}
                              type="number"
                              disabled={readOnly}
                              min={0}
                              max={720}
                              step={5}
                              value={safeDraft.overdue_notify_minutes}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0)));
                                updateDraft((prev) => ({ ...prev, overdue_notify_minutes: val }));
                              }}
                              className="w-24 bg-[#131d31] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold tabular-nums focus:outline-none focus:border-blue-500 disabled:opacity-60"
                            />
                            {!isOverduePreset && (
                              <span className="text-[11px] text-blue-300">Personalizado</span>
                            )}
                          </div>
                        </div>

                        {/* Regra 6: Alerta de uso SOS */}
                        <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-white">
                                Alertar uso de medicamento SOS
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                Envia uma notificação imediata quando o paciente registrar uma dose eventual (SOS).
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              disabled={readOnly}
                              aria-checked={safeDraft.notify_sos_usage}
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  notify_sos_usage: !prev.notify_sos_usage,
                                }))
                              }
                              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                                readOnly ? 'cursor-not-allowed opacity-70' : ''
                              } ${
                                safeDraft.notify_sos_usage
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-slate-700 border-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                  safeDraft.notify_sos_usage ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Regra 7: Alerta de estoque baixo */}
                        <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-white">
                                Alertar estoque baixo de medicamentos
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                Avisa você quando algum medicamento atingir o limite mínimo de unidades.
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              disabled={readOnly}
                              aria-checked={safeDraft.notify_low_stock}
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  notify_low_stock: !prev.notify_low_stock,
                                }))
                              }
                              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                                readOnly ? 'cursor-not-allowed opacity-70' : ''
                              } ${
                                safeDraft.notify_low_stock
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-slate-700 border-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                  safeDraft.notify_low_stock ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {safeDraft.notify_low_stock && (
                            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                              <label htmlFor={`${idPrefix}-low-stock-threshold`} className="text-xs text-slate-300">
                                Avisar quando restarem até (unidades):
                              </label>
                              <div className="flex items-center gap-2">
                                {[3, 5, 7, 10].map((qty) => (
                                  <button
                                    key={qty}
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() =>
                                      updateDraft((prev) => ({ ...prev, low_stock_threshold: qty }))
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors tabular-nums ${
                                      readOnly ? 'cursor-not-allowed' : ''
                                    } ${
                                      Number(safeDraft.low_stock_threshold) === qty
                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                        : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600'
                                    }`}
                                  >
                                    {qty}
                                  </button>
                                ))}
                                <input
                                  id={`${idPrefix}-low-stock-threshold`}
                                  type="number"
                                  disabled={readOnly}
                                  min={1}
                                  max={50}
                                  value={safeDraft.low_stock_threshold}
                                  onChange={(e) => {
                                    const v = Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1)));
                                    updateDraft((prev) => ({ ...prev, low_stock_threshold: v }));
                                  }}
                                  className="w-16 bg-[#131d31] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-semibold tabular-nums focus:outline-none focus:border-blue-500 disabled:opacity-60"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloco 3: Controle de Prescrição */}
                      <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                            <Pill size={18} className="w-4 h-4" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-white">Controle da Prescrição no App</h2>
                            <p className="text-xs text-slate-400">
                              Defina se o paciente pode alterar a lista de medicamentos pelo próprio celular.
                            </p>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-white">
                                Permitir paciente adicionar, editar ou excluir medicamentos
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {safeDraft.allow_patient_med_edit
                                  ? 'Permitido: o paciente pode gerenciar remédios no app Android normalmente.'
                                  : 'Bloqueado: apenas você (cuidador) altera receitas e horários; o paciente visualiza os medicamentos e confirma doses.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              disabled={readOnly}
                              aria-checked={safeDraft.allow_patient_med_edit}
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  allow_patient_med_edit: !prev.allow_patient_med_edit,
                                }))
                              }
                              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                                readOnly ? 'cursor-not-allowed opacity-70' : ''
                              } ${
                                safeDraft.allow_patient_med_edit
                                  ? 'bg-emerald-600 border-emerald-500'
                                  : 'bg-rose-600 border-rose-500'
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                  safeDraft.allow_patient_med_edit ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-5 sm:space-y-6">
                {/* Cabeçalho Principal + Seletor de Escopo (Paciente / Global / Grupos) */}
                <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                        <SlidersHorizontal size={20} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            Painel de Gerenciamento
                          </h1>
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold tabular-nums">
                            {patientsOverview.length} paciente(s) · {globalCount} Global · {groupCount} em Grupos · {customCount} Individual
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                          Administre regras clínicas no padrão <strong className="text-slate-200">Global</strong> (toda a clínica), por <strong className="text-slate-200">Grupos / Alas</strong> ou de forma <strong className="text-slate-200">Individual</strong> por paciente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Escopo em 3 Abas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 rounded-xl bg-[#0b1120] border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setManagementScope('patient')}
                      className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        managementScope === 'patient'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <User size={15} className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        Por Paciente{selectedPatient ? `: ${selectedPatient.nome.split(' ')[0]}` : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagementScope('global')}
                      className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        managementScope === 'global'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <Building2 size={15} className="w-4 h-4 shrink-0" />
                      <span>Global (Toda a Clínica)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagementScope('groups')}
                      className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        managementScope === 'groups'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <Layers size={15} className="w-4 h-4 shrink-0" />
                      <span>Grupos / Alas ({careGroups.length})</span>
                    </button>
                  </div>
                </div>

                {/* ================= ESCOPO 1: POR PACIENTE ================= */}
                {managementScope === 'patient' && (
                  <>
                    {!selectedPatient ? (
                      <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-6 sm:p-8 text-center space-y-4">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center justify-center mx-auto">
                          <Users size={20} className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 max-w-md mx-auto">
                          <h2 className="text-base font-bold text-white">Nenhum paciente selecionado</h2>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Vincule ou selecione um paciente para ajustar regras individuais, ou já deixe configuradas as regras <strong>Globais</strong> e os <strong>Grupos</strong> da sua clínica.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setManagementScope('global')}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                          >
                            Configurar Padrão Global
                          </button>
                          <button
                            type="button"
                            onClick={() => setManagementScope('groups')}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                          >
                            Gerenciar Grupos
                          </button>
                        </div>
                      </div>
                    ) : (() => {
                      const activeMode = normalizeConfigMode(patientConfigModeDraft, 'global');
                      const selectedPatientGroup = careGroups.find((g) => g.id === patientGroupIdDraft) || null;
                      const previewInheritedDraft =
                        activeMode === 'group'
                          ? normalizeCareSettings(selectedPatientGroup?.settings || globalCareSettings)
                          : normalizeCareSettings(globalCareSettings);
                      const isCustomMode = activeMode === 'custom';
                      const effectiveRuleDraft = isCustomMode ? careSettingsDraft : previewInheritedDraft;

                      const hasPatientUnsavedChanges =
                        activeMode !== normalizeConfigMode(patientRuleMeta.config_mode, 'global') ||
                        (activeMode === 'group' && (patientGroupIdDraft || null) !== (patientRuleMeta.group_id || null)) ||
                        (isCustomMode &&
                          JSON.stringify(normalizeCareSettings(careSettingsDraft)) !==
                            JSON.stringify(normalizeCareSettings(careSettings)));

                      return (
                        <div className="space-y-5">
                          {/* Cartão de Herança / Modo do Paciente */}
                          <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-base sm:text-lg font-bold text-white">
                                    Paciente: {selectedPatient.nome}
                                  </h2>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                      patientRuleMeta.config_mode === 'group'
                                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                        : patientRuleMeta.config_mode === 'custom'
                                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                    }`}
                                  >
                                    {patientRuleMeta.config_mode === 'group'
                                      ? `Em grupo: ${patientRuleMeta.group_name || 'Grupo'}`
                                      : patientRuleMeta.config_mode === 'custom'
                                      ? 'Regras individuais'
                                      : 'Herdando Global'}
                                  </span>
                                  {hasPatientUnsavedChanges && (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                                      Alterações não salvas
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400">
                                  Escolha se este paciente segue o padrão geral da clínica, participa de um grupo ou possui regras próprias.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
                                {isCustomMode && (
                                  <button
                                    type="button"
                                    disabled={careSettingsSaving || careSettingsLoading}
                                    onClick={() => setCareSettingsDraft({ ...DEFAULT_CARE_SETTINGS })}
                                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                                  >
                                    <RotateCcw size={14} className="w-3.5 h-3.5" />
                                    <span>Restaurar Padrão</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={careSettingsSaving || careSettingsLoading}
                                  onClick={() => handleSaveCareSettings()}
                                  className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-colors"
                                >
                                  {careSettingsSaving ? (
                                    <Loader2 size={14} className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save size={14} className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {careSettingsSaving
                                      ? 'Salvando...'
                                      : isCustomMode
                                      ? 'Salvar Regras Individuais'
                                      : 'Aplicar Modo ao Paciente'}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* 3 opções de modo para o paciente */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <button
                                type="button"
                                onClick={() => setPatientConfigModeDraft('global')}
                                className={`text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                                  activeMode === 'global'
                                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/40'
                                    : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                                    <Globe size={14} className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Herdar Global</span>
                                  </span>
                                  {activeMode === 'global' && (
                                    <CheckCircle2 size={15} className="w-4 h-4 text-indigo-400 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  Aplica automaticamente as regras globais configuradas para toda a clínica.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setPatientConfigModeDraft('group');
                                  if (!patientGroupIdDraft && careGroups.length > 0) {
                                    setPatientGroupIdDraft(careGroups[0].id);
                                  }
                                }}
                                className={`text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                                  activeMode === 'group'
                                    ? 'bg-emerald-600/15 border-emerald-500 ring-1 ring-emerald-500/40'
                                    : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                                    <Layers size={14} className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Seguir Grupo</span>
                                  </span>
                                  {activeMode === 'group' && (
                                    <CheckCircle2 size={15} className="w-4 h-4 text-emerald-400 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  Compartilha as regras de uma ala ou perfil de cuidado da clínica.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (activeMode !== 'custom') {
                                    setCareSettingsDraft(previewInheritedDraft);
                                  }
                                  setPatientConfigModeDraft('custom');
                                }}
                                className={`text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                                  activeMode === 'custom'
                                    ? 'bg-amber-600/15 border-amber-500 ring-1 ring-amber-500/40'
                                    : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                                    <SlidersHorizontal size={14} className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Personalizado</span>
                                  </span>
                                  {activeMode === 'custom' && (
                                    <CheckCircle2 size={15} className="w-4 h-4 text-amber-400 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  Regras exclusivas configuradas individualmente para {selectedPatient.nome.split(' ')[0]}.
                                </p>
                              </button>
                            </div>

                            {/* Seletor do grupo quando Seguir Grupo está ativo */}
                            {activeMode === 'group' && (
                              <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {careGroups.length > 0 ? (
                                  <>
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <label htmlFor="patient-group-select" className="text-xs font-bold text-white block">
                                        Grupo vinculado a este paciente:
                                      </label>
                                      <select
                                        id="patient-group-select"
                                        value={patientGroupIdDraft}
                                        onChange={(e) => setPatientGroupIdDraft(e.target.value)}
                                        className="w-full sm:max-w-sm bg-[#131d31] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                                      >
                                        <option value="">Selecione um grupo...</option>
                                        {careGroups.map((grp) => (
                                          <option key={grp.id} value={grp.id}>
                                            {grp.name} ({grp.member_count} paciente{grp.member_count === 1 ? '' : 's'})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {selectedPatientGroup && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            selectGroupForEdit(selectedPatientGroup);
                                            setManagementScope('groups');
                                          }}
                                          className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                                        >
                                          Editar Grupo
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCareSettingsDraft(previewInheritedDraft);
                                          setPatientConfigModeDraft('custom');
                                        }}
                                        className="min-h-[38px] px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-colors"
                                      >
                                        Personalizar só para {selectedPatient.nome.split(' ')[0]}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <p className="text-xs text-slate-400">
                                      Você ainda não criou nenhum grupo na clínica. Crie seu primeiro grupo para vincular pacientes por ala ou perfil.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        startCreateNewGroup();
                                        setManagementScope('groups');
                                      }}
                                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                                    >
                                      <Plus size={14} className="w-3.5 h-3.5" />
                                      <span>Criar Primeiro Grupo</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Atalhos quando Herdar Global está ativo */}
                            {activeMode === 'global' && (
                              <div className="p-3.5 rounded-xl bg-[#0b1120] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs text-slate-400">
                                  Qualquer alteração no escopo <strong className="text-indigo-300">Global</strong> atualiza este paciente automaticamente.
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setManagementScope('global')}
                                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
                                  >
                                    Editar Regras Globais
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCareSettingsDraft(previewInheritedDraft);
                                      setPatientConfigModeDraft('custom');
                                    }}
                                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
                                  >
                                    Personalizar só para {selectedPatient.nome.split(' ')[0]}
                                  </button>
                                </div>
                              </div>
                            )}
                            {/* Resumo rápido da regra ativa em tela para facilitar visualização no celular */}
                            {(() => {
                              const normalizedEffective = normalizeCareSettings(effectiveRuleDraft);
                              return (
                                <div className="p-3.5 rounded-xl bg-[#0b1120] border border-slate-800/90 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                      Resumo da regra em edição
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      Role abaixo para ajustar cada interruptor
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                    <span
                                      className={`px-2.5 py-1 rounded-lg border font-semibold ${
                                        normalizedEffective.require_caregiver_confirm
                                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                          : 'bg-slate-800 border-slate-700 text-slate-300'
                                      }`}
                                    >
                                      Confirmar toda dose tomada:{' '}
                                      {normalizedEffective.require_caregiver_confirm ? 'SIM' : 'NÃO (Direto)'}
                                    </span>
                                    <span
                                      className={`px-2.5 py-1 rounded-lg border font-semibold ${
                                        normalizedEffective.require_confirm_after_missed
                                          ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                                          : 'bg-slate-800 border-slate-700 text-slate-300'
                                      }`}
                                    >
                                      Confirmar após dose perdida:{' '}
                                      {normalizedEffective.require_confirm_after_missed ? 'SIM' : 'NÃO'}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                                      Dose perdida após {formatMinutesLabelPt(normalizedEffective.missed_dose_minutes)}
                                    </span>
                                  </div>
                                  {!normalizedEffective.require_caregiver_confirm &&
                                    normalizedEffective.require_confirm_after_missed && (
                                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                                        Com esta combinação, doses tomadas no horário ficam como <strong>Tomado</strong> direto. Apenas doses já perdidas (ou desfeitas) pedem sua validação. Para aprovar toda dose tomada, ative{' '}
                                        <strong>&ldquo;Precisa confirmar que o paciente tomou a dose?&rdquo;</strong> abaixo e salve.
                                      </p>
                                    )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Regras efetivas / editáveis do paciente */}
                          {renderRuleEditor({
                            draft: effectiveRuleDraft,
                            onChangeDraft: setCareSettingsDraft,
                            idPrefix: 'patient',
                            readOnly: !isCustomMode,
                          })}

                          {/* Barra de Salvamento no Rodapé */}
                          <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-400 leading-relaxed">
                              {hasPatientUnsavedChanges ? (
                                <span className="text-amber-300 font-semibold">
                                  Há alterações pendentes para {selectedPatient.nome}. Clique em salvar para aplicar.
                                </span>
                              ) : (
                                <span>
                                  Configurações sincronizadas para <strong className="text-slate-200">{selectedPatient.nome}</strong>. Alterações ficam registradas na auditoria.
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={careSettingsSaving || careSettingsLoading}
                              onClick={() => handleSaveCareSettings()}
                              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                            >
                              {careSettingsSaving ? (
                                <Loader2 size={15} className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save size={15} className="w-4 h-4" />
                              )}
                              <span>
                                {careSettingsSaving
                                  ? 'Salvando...'
                                  : isCustomMode
                                  ? 'Salvar Configurações Individuais'
                                  : 'Confirmar Modo do Paciente'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ================= ESCOPO 2: GLOBAL (TODA A CLÍNICA) ================= */}
                {managementScope === 'global' && (() => {
                  const hasGlobalUnsaved =
                    JSON.stringify(normalizeCareSettings(globalCareSettingsDraft)) !==
                    JSON.stringify(normalizeCareSettings(globalCareSettings));

                  return (
                    <div className="space-y-5">
                      <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base sm:text-lg font-bold text-white">
                                Regras Globais da Clínica
                              </h2>
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                  globalCareSettings.is_configured
                                    ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                {globalCareSettings.is_configured ? 'Personalizado na clínica' : 'Padrão MediCare'}
                              </span>
                              {hasGlobalUnsaved && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                                  Alterações não salvas
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Aplicado automaticamente a todos os pacientes em modo <strong className="text-slate-200">Global</strong> ({globalCount}) e a novos pacientes vinculados.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              disabled={careSettingsSaving}
                              onClick={() => setGlobalCareSettingsDraft({ ...DEFAULT_CARE_SETTINGS })}
                              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                            >
                              <RotateCcw size={14} className="w-3.5 h-3.5" />
                              <span>Restaurar Padrão</span>
                            </button>
                            <button
                              type="button"
                              disabled={careSettingsSaving}
                              onClick={() => handleSaveGlobalCareSettings({ applyToAll: false })}
                              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-colors"
                            >
                              {careSettingsSaving ? (
                                <Loader2 size={14} className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save size={14} className="w-3.5 h-3.5" />
                              )}
                              <span>{careSettingsSaving ? 'Salvando...' : 'Salvar Padrão Global'}</span>
                            </button>
                            {patientsOverview.length > 0 && (
                              <button
                                type="button"
                                disabled={careSettingsSaving}
                                onClick={() => setConfirmApplyGlobalToAll((v) => !v)}
                                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
                              >
                                <Users size={14} className="w-3.5 h-3.5" />
                                <span>Aplicar a Todos ({patientsOverview.length})</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {confirmApplyGlobalToAll && (
                          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
                              <AlertTriangle size={16} className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                Isso vai sobrescrever o modo atual de <strong>todos os {patientsOverview.length} paciente(s)</strong> (inclusive os que estão em Grupos ou Personalizado) para seguirem estas regras Globais. Deseja confirmar?
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmApplyGlobalToAll(false)}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={careSettingsSaving}
                                onClick={() => handleSaveGlobalCareSettings({ applyToAll: true })}
                                className="min-h-[36px] px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                              >
                                Confirmar para Todos
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Editor de Regras Globais */}
                      {renderRuleEditor({
                        draft: globalCareSettingsDraft,
                        onChangeDraft: setGlobalCareSettingsDraft,
                        idPrefix: 'global',
                        readOnly: false,
                      })}

                      {/* Quadro de Pacientes da Clínica */}
                      <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-white">Quadro de Pacientes da Clínica</h3>
                            <p className="text-xs text-slate-400">
                              Veja rapidamente qual regra cada paciente utiliza hoje e altere em um clique.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setManagementScope('groups')}
                            className="self-start sm:self-auto min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
                          >
                            Gerenciar Grupos ({careGroups.length})
                          </button>
                        </div>

                        {patientsOverview.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 text-center bg-[#0b1120] rounded-xl border border-slate-800">
                            Nenhum paciente vinculado ainda. Quando um paciente for cadastrado ou vinculado, ele herdará automaticamente este padrão Global.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {patientsOverview.map((pat) => {
                              const modeLabel =
                                pat.config_mode === 'group'
                                  ? `Grupo: ${pat.group_name || 'Sem nome'}`
                                  : pat.config_mode === 'custom'
                                  ? 'Individual'
                                  : 'Global';
                              return (
                                <div
                                  key={pat.patient_id}
                                  className="p-3.5 rounded-xl bg-[#0b1120] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-bold text-white truncate">{pat.nome}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                          pat.config_mode === 'group'
                                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                            : pat.config_mode === 'custom'
                                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                            : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                        }`}
                                      >
                                        {modeLabel}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                      {pat.relationship_label} · Atraso: {formatMinutesLabelPt(pat.settings.overdue_notify_minutes)} ·{' '}
                                      {pat.settings.require_caregiver_confirm ? 'Exige aprovação' : 'Confirmação livre'}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={careSettingsSaving || pat.config_mode === 'global'}
                                      onClick={() => handleQuickAssignPatientMode(pat.patient_id, 'global')}
                                      className={`min-h-[34px] px-3 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        pat.config_mode === 'global'
                                          ? 'bg-indigo-600 text-white border-indigo-500'
                                          : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600'
                                      }`}
                                    >
                                      Global
                                    </button>
                                    {careGroups.length > 0 && (
                                      <select
                                        aria-label={`Vincular ${pat.nome} a grupo`}
                                        disabled={careSettingsSaving}
                                        value={pat.config_mode === 'group' ? pat.group_id || '' : ''}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleQuickAssignPatientMode(pat.patient_id, 'group', e.target.value);
                                          }
                                        }}
                                        className="min-h-[34px] bg-[#131d31] border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                                      >
                                        <option value="">Mover para Grupo...</option>
                                        {careGroups.map((grp) => (
                                          <option key={grp.id} value={grp.id}>
                                            Grupo: {grp.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPatientId(pat.patient_id);
                                        setPatientConfigModeDraft('custom');
                                        setCareSettingsDraft(normalizeCareSettings(pat.settings));
                                        setManagementScope('patient');
                                      }}
                                      className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
                                    >
                                      Personalizar
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ================= ESCOPO 3: GRUPOS / ALAS DA CLÍNICA ================= */}
                {managementScope === 'groups' && (() => {
                  const filteredGroupPatients = patientsOverview.filter((p) => {
                    const q = groupMemberSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      String(p.nome || '').toLowerCase().includes(q) ||
                      String(p.relationship_label || '').toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* Coluna Esquerda: Lista de Grupos */}
                      <div className="lg:col-span-4 bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-base font-bold text-white">Grupos / Alas</h2>
                            <p className="text-[11px] text-slate-400">
                              Agrupe pacientes por ala, turno ou grau de dependência.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={startCreateNewGroup}
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-colors"
                          >
                            <Plus size={14} className="w-3.5 h-3.5" />
                            <span>Novo Grupo</span>
                          </button>
                        </div>

                        {careGroups.length === 0 ? (
                          <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 text-center space-y-2">
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Nenhum grupo criado ainda. Exemplos: <em>Ala A - Supervisão Total</em>, <em>Autônomos</em> ou <em>Turno Noite</em>.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {careGroups.map((grp) => {
                              const isSelected = selectedGroupId === grp.id;
                              return (
                                <button
                                  key={grp.id}
                                  type="button"
                                  onClick={() => selectGroupForEdit(grp)}
                                  className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                                    isSelected
                                      ? 'bg-emerald-600/15 border-emerald-500 ring-1 ring-emerald-500/40'
                                      : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: grp.color || '#3b82f6' }}
                                      />
                                      <span className="text-xs font-bold text-white truncate">{grp.name}</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold tabular-nums shrink-0">
                                      {grp.member_count} pac.
                                    </span>
                                  </div>
                                  {grp.description && (
                                    <p className="text-[11px] text-slate-400 line-clamp-2">{grp.description}</p>
                                  )}
                                  <p className="text-[10px] text-slate-500">
                                    Atraso: {formatMinutesLabelPt(grp.settings?.overdue_notify_minutes)} ·{' '}
                                    {grp.settings?.require_caregiver_confirm ? 'Exige validação' : 'Confirmação livre'}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Coluna Direita: Editor do Grupo + Membros + Regras */}
                      <div className="lg:col-span-8 space-y-5">
                        {!selectedGroupId ? (
                          <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-8 text-center space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center mx-auto">
                              <Layers size={22} className="w-5 h-5" />
                            </div>
                            <div className="space-y-1 max-w-md mx-auto">
                              <h3 className="text-base font-bold text-white">
                                {careGroups.length > 0 ? 'Selecione um grupo para editar' : 'Crie o primeiro grupo da clínica'}
                              </h3>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                Cada grupo possui um conjunto próprio de regras clínicas aplicadas automaticamente a todos os pacientes vinculados a ele.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={startCreateNewGroup}
                              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                            >
                              <Plus size={15} className="w-4 h-4" />
                              <span>Criar Grupo Agora</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 space-y-5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <h3 className="text-base sm:text-lg font-bold text-white">
                                  {selectedGroupId === 'new' ? 'Novo Grupo de Pacientes' : `Editar Grupo: ${groupDraft.name || 'Grupo'}`}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2">
                                  {groupDraft.id && (
                                    <button
                                      type="button"
                                      disabled={careSettingsSaving}
                                      onClick={() =>
                                        setConfirmDeleteGroupId((prev) => (prev === groupDraft.id ? null : groupDraft.id))
                                      }
                                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors"
                                    >
                                      <Trash2 size={14} className="w-3.5 h-3.5" />
                                      <span>Excluir Grupo</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={careSettingsSaving}
                                    onClick={handleSaveCareGroup}
                                    className="min-h-[40px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-colors"
                                  >
                                    {careSettingsSaving ? (
                                      <Loader2 size={14} className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Save size={14} className="w-3.5 h-3.5" />
                                    )}
                                    <span>{careSettingsSaving ? 'Salvando...' : 'Salvar Grupo e Membros'}</span>
                                  </button>
                                </div>
                              </div>

                              {groupDraft.id && confirmDeleteGroupId === groupDraft.id && (
                                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <span className="text-xs text-rose-200">
                                    Ao excluir este grupo, os {groupDraft.patientIds.length} paciente(s) vinculados voltarão ao modo <strong>Global</strong>. Confirmar exclusão?
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteGroupId(null)}
                                      className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={careSettingsSaving}
                                      onClick={() => handleDeleteCareGroup(groupDraft.id)}
                                      className="min-h-[34px] px-4 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                                    >
                                      Confirmar Exclusão
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Campos de Identificação e Cor do Grupo */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label htmlFor="group-name-input" className="text-xs font-semibold text-slate-300 block">
                                    Nome do Grupo / Ala *
                                  </label>
                                  <input
                                    id="group-name-input"
                                    type="text"
                                    maxLength={80}
                                    value={groupDraft.name}
                                    onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Ala A - Idosos Dependentes"
                                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label htmlFor="group-desc-input" className="text-xs font-semibold text-slate-300 block">
                                    Descrição (opcional)
                                  </label>
                                  <input
                                    id="group-desc-input"
                                    type="text"
                                    maxLength={180}
                                    value={groupDraft.description}
                                    onChange={(e) => setGroupDraft((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ex: Pacientes acamados ou com risco de atraso"
                                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-xs font-semibold text-slate-300 mr-1">Cor de destaque:</span>
                                {GROUP_COLORS.map((clr) => {
                                  const selectedClr = groupDraft.color === clr.id;
                                  return (
                                    <button
                                      key={clr.id}
                                      type="button"
                                      title={clr.label}
                                      onClick={() => setGroupDraft((prev) => ({ ...prev, color: clr.id }))}
                                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                                        selectedClr ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                                      }`}
                                      style={{ backgroundColor: clr.id }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Checklist de Pacientes no Grupo */}
                              <div className="p-4 rounded-xl bg-[#0b1120] border border-slate-800 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-bold text-white">
                                      Pacientes neste Grupo ({groupDraft.patientIds.length} selecionado{groupDraft.patientIds.length === 1 ? '' : 's'})
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                      Marque os pacientes que devem seguir as regras deste grupo.
                                    </p>
                                  </div>
                                  {patientsOverview.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setGroupDraft((prev) => ({
                                            ...prev,
                                            patientIds: Array.from(
                                              new Set([
                                                ...prev.patientIds,
                                                ...filteredGroupPatients.map((p) => p.patient_id),
                                              ])
                                            ),
                                          }))
                                        }
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200"
                                      >
                                        Marcar Todos
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setGroupDraft((prev) => ({ ...prev, patientIds: [] }))}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-400"
                                      >
                                        Limpar
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {patientsOverview.length > 0 ? (
                                  <>
                                    <div className="relative">
                                      <Search size={14} className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                      <input
                                        type="text"
                                        value={groupMemberSearch}
                                        onChange={(e) => setGroupMemberSearch(e.target.value)}
                                        placeholder="Buscar paciente por nome..."
                                        className="w-full bg-[#131d31] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                      />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                      {filteredGroupPatients.map((pat) => {
                                        const isMember = groupDraft.patientIds.includes(pat.patient_id);
                                        const otherGroupBadge =
                                          pat.config_mode === 'group' && pat.group_id !== groupDraft.id
                                            ? `No grupo: ${pat.group_name}`
                                            : pat.config_mode === 'custom'
                                            ? 'Hoje: Individual'
                                            : 'Hoje: Global';
                                        return (
                                          <button
                                            key={pat.patient_id}
                                            type="button"
                                            onClick={() =>
                                              setGroupDraft((prev) => ({
                                                ...prev,
                                                patientIds: isMember
                                                  ? prev.patientIds.filter((id) => id !== pat.patient_id)
                                                  : [...prev.patientIds, pat.patient_id],
                                              }))
                                            }
                                            className={`w-full text-left px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                                              isMember
                                                ? 'bg-emerald-600/15 border-emerald-500/50 text-white'
                                                : 'bg-[#131d31] border-slate-800 text-slate-300 hover:border-slate-700'
                                            }`}
                                          >
                                            <span className="inline-flex items-center gap-2.5 min-w-0">
                                              {isMember ? (
                                                <CheckSquare size={16} className="w-4 h-4 text-emerald-400 shrink-0" />
                                              ) : (
                                                <Square size={16} className="w-4 h-4 text-slate-500 shrink-0" />
                                              )}
                                              <span className="text-xs font-semibold truncate">{pat.nome}</span>
                                            </span>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 shrink-0">
                                              {otherGroupBadge}
                                            </span>
                                          </button>
                                        );
                                      })}
                                      {filteredGroupPatients.length === 0 && (
                                        <p className="text-xs text-slate-500 text-center py-3">
                                          Nenhum paciente encontrado para &ldquo;{groupMemberSearch}&rdquo;.
                                        </p>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-slate-400">
                                    Você pode salvar este grupo agora e vincular pacientes depois conforme forem cadastrados.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Editor de Regras do Grupo */}
                            {renderRuleEditor({
                              draft: groupDraft.settings,
                              onChangeDraft: (updater) =>
                                setGroupDraft((prev) => {
                                  const nextSettings =
                                    typeof updater === 'function'
                                      ? updater(normalizeCareSettings(prev.settings))
                                      : normalizeCareSettings(updater);
                                  return { ...prev, settings: nextSettings };
                                }),
                              idPrefix: 'group',
                              readOnly: false,
                            })}

                            {/* Rodapé Salvar Grupo */}
                            <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <span className="text-xs text-slate-400">
                                Todas as alterações aplicadas a este grupo valerão para os <strong className="text-slate-200">{groupDraft.patientIds.length}</strong> paciente(s) selecionados.
                              </span>
                              <button
                                type="button"
                                disabled={careSettingsSaving}
                                onClick={handleSaveCareGroup}
                                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                              >
                                {careSettingsSaving ? (
                                  <Loader2 size={15} className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save size={15} className="w-4 h-4" />
                                )}
                                <span>{careSettingsSaving ? 'Salvando...' : 'Salvar Grupo e Regras'}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

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
                      setScheduleBaseTime('08:00');
                      setSelectedIntervalHours(null);
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
                      setScheduleBaseTime('08:00');
                      setSelectedIntervalHours(null);
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
                        : med.treatment_days
                        ? `Temporário (${med.treatment_days}d)`
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

                          <button
                            type="button"
                            onClick={() => setMedToDelete(med)}
                            aria-label={`Remover ${med.nome}`}
                            title="Remover da prescrição ativa"
                            className="min-w-[36px] min-h-[36px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center justify-center shrink-0 transition-colors"
                          >
                            <Trash2 size={15} className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="tabular-nums">
                            <span className="text-slate-400">Horários: </span>
                            <span className="font-semibold text-white font-mono">
                              {horarios.length > 0
                                ? horarios.join(', ')
                                : med.treatment_type === 'sos'
                                ? 'Sob demanda (SOS)'
                                : 'Não definido'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-slate-400">Estoque:</span>
                            <span
                              className={`font-bold ${
                                isLowStock ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {med.treatment_type === 'sos'
                                ? `${med.quantidade} un`
                                : `${med.quantidade} un (${daysRemaining}d)`}
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

          {/* TAB 4: CALENDÁRIO & AGENDA (ESPELHADO NO CALENDÁRIO DO PACIENTE) */}
          {currentTab === 'agenda' && selectedPatient && (() => {
            const { cells, monthSummary, upcomingEvents } = calendarMonthData;
            const currentMonthPrefix = todayIso.slice(0, 7);
            const viewedMonthPrefix = `${calYear}-${String(calMonthIndex + 1).padStart(2, '0')}`;
            const isViewingCurrentMonth = currentMonthPrefix === viewedMonthPrefix;
            const calQueryTrim = calSearchQuery.trim().toLowerCase();

            const searchResults = [];
            if (showCalSearch && calQueryTrim.length >= 2) {
              calendarNotes.forEach((n) => {
                if (
                  String(n.content || '').toLowerCase().includes(calQueryTrim) ||
                  String(n.mood || '').toLowerCase().includes(calQueryTrim)
                ) {
                  searchResults.push({
                    key: `note-${n.id}`,
                    kind: 'Nota',
                    title: n.content,
                    sub: `${formatDateBr(n.date)}${n.mood ? ` · ${n.mood}` : ''}`,
                    date: String(n.date || '').slice(0, 10),
                  });
                }
              });
              appointments.forEach((ev) => {
                if (isStockEventRecord(ev)) return;
                if (
                  String(ev.title || '').toLowerCase().includes(calQueryTrim) ||
                  String(ev.doctor || '').toLowerCase().includes(calQueryTrim) ||
                  String(ev.location || '').toLowerCase().includes(calQueryTrim)
                ) {
                  searchResults.push({
                    key: `ev-${ev.id}`,
                    kind: 'Evento',
                    title: ev.title,
                    sub: `${formatDateBr(ev.date)}${ev.time ? ` às ${ev.time}` : ''}${ev.doctor ? ` · ${ev.doctor}` : ''}`,
                    date: String(ev.date || '').slice(0, 10),
                  });
                }
              });
              stockMovements.forEach((sm) => {
                const label = sm.med_name || 'Medicamento';
                if (
                  label.toLowerCase().includes(calQueryTrim) ||
                  String(sm.notes || '').toLowerCase().includes(calQueryTrim)
                ) {
                  const smDate = sm.created_at ? getBrazilDateIso(sm.created_at) : todayIso;
                  const delta = Number(sm.quantity_delta ?? sm.quantity_changed ?? 0);
                  searchResults.push({
                    key: `sm-${sm.id}`,
                    kind: 'Estoque',
                    title: `${label} (${delta >= 0 ? `+${delta}` : delta} un)`,
                    sub: `${formatDateBr(smDate)}${sm.notes ? ` · ${sm.notes}` : ''}`,
                    date: smDate,
                  });
                }
              });
              medications.forEach((m) => {
                if (String(m.nome || '').toLowerCase().includes(calQueryTrim)) {
                  searchResults.push({
                    key: `med-${m.id}`,
                    kind: 'Remédio',
                    title: `${m.nome} ${m.dosagem || ''}`.trim(),
                    sub: Array.isArray(m.horarios) && m.horarios.length > 0 ? `Horários: ${m.horarios.join(', ')}` : 'Uso SOS',
                    date: todayIso,
                  });
                }
              });
              searchResults.sort((a, b) => b.date.localeCompare(a.date));
            }

            return (
              <div className="space-y-5 sm:space-y-6">
                {/* Cabeçalho + Busca + Ações Rápidas */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Calendário &amp; Agenda
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                      Histórico de doses, consultas, anotações e estoque de {selectedPatient.nome}.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCalSearch((prev) => {
                          if (prev) setCalSearchQuery('');
                          return !prev;
                        });
                      }}
                      aria-label="Buscar no calendário"
                      title="Buscar notas, eventos ou medicamentos"
                      className={`min-w-[42px] min-h-[42px] px-3 rounded-xl border flex items-center justify-center transition-colors ${
                        showCalSearch
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#131d31] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Search size={16} className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNoteForm({ id: null, date: activeSelectedCalDate, content: '', mood: '' });
                        setShowNoteModal(true);
                      }}
                      className="min-h-[42px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131d31] hover:bg-slate-800 border border-slate-700 text-blue-300 font-semibold text-xs transition-colors whitespace-nowrap"
                    >
                      <FileText size={14} className="w-3.5 h-3.5" />
                      <span>Nova Anotação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewAppointmentForm({ ...EMPTY_APPOINTMENT_FORM, date: activeSelectedCalDate });
                        setShowAppointmentModal(true);
                      }}
                      className="min-h-[42px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors whitespace-nowrap"
                    >
                      <Plus size={15} className="w-4 h-4" />
                      <span>Novo Evento</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Busca Opcional */}
                {showCalSearch && (
                  <div className="bg-[#131d31] rounded-2xl border border-slate-800 p-4 space-y-3">
                    <div className="relative">
                      <Search size={15} className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={calSearchQuery}
                        onChange={(e) => setCalSearchQuery(e.target.value)}
                        placeholder="Buscar anotações, consultas, reposições ou medicamentos..."
                        className="w-full bg-[#0b1120] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 min-h-[42px] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {calQueryTrim.length >= 2 && (
                      <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto">
                        {searchResults.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2 text-center">
                            Nenhum resultado para &ldquo;{calSearchQuery}&rdquo;.
                          </p>
                        ) : (
                          searchResults.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => handleSelectCalDate(item.date)}
                              className="w-full text-left py-2.5 px-2 hover:bg-slate-800/50 rounded-lg flex items-center justify-between gap-3 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-blue-300 uppercase">
                                    {item.kind}
                                  </span>
                                  <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.sub}</p>
                              </div>
                              <ChevronRight size={14} className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Grade Principal: Mini-Calendário Mensal (esq) + Painel do Dia Selecionado (dir) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Card do Calendário Mensal */}
                  <div className="lg:col-span-7 bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handlePrevCalMonth}
                        aria-label="Mês anterior"
                        className="w-9 h-9 rounded-xl bg-[#0b1120] border border-slate-800 hover:border-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft size={18} className="w-4 h-4" />
                      </button>

                      <div className="text-center flex items-center gap-2.5">
                        <div>
                          <div className="text-base sm:text-lg font-bold text-white leading-tight">
                            {MONTHS_PT[calMonthIndex]}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium tabular-nums">{calYear}</div>
                        </div>
                        {!isViewingCurrentMonth && (
                          <button
                            type="button"
                            onClick={handleJumpTodayCal}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold hover:bg-blue-500/25 transition-colors"
                          >
                            Hoje
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextCalMonth}
                        aria-label="Próximo mês"
                        className="w-9 h-9 rounded-xl bg-[#0b1120] border border-slate-800 hover:border-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                      >
                        <ChevronRight size={18} className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cabeçalho dias da semana */}
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      {WEEKDAYS_SHORT_PT.map((wd) => (
                        <div key={wd} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
                          {wd}
                        </div>
                      ))}
                    </div>

                    {/* Células do Mês */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {cells.map((cell) => {
                        if (cell.empty) {
                          return <div key={cell.key} className="h-12 sm:h-13" />;
                        }
                        const isSelected = cell.dateIso === activeSelectedCalDate;
                        const statusBg =
                          cell.isToday && isSelected
                            ? 'bg-blue-600 text-white border-blue-400'
                            : cell.isToday
                            ? 'bg-blue-600/25 text-white border-blue-500/60'
                            : cell.dayDoseStat === 'all_taken'
                            ? 'bg-emerald-500/15 text-slate-100 border-emerald-500/30'
                            : cell.dayDoseStat === 'partial'
                            ? 'bg-amber-500/15 text-slate-100 border-amber-500/30'
                            : cell.dayDoseStat === 'missed'
                            ? 'bg-rose-500/15 text-slate-100 border-rose-500/30'
                            : 'bg-[#0b1120]/70 text-slate-200 border-slate-800/80';

                        return (
                          <button
                            key={cell.key}
                            type="button"
                            onClick={() => handleSelectCalDate(cell.dateIso)}
                            className={`h-12 sm:h-13 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all relative ${statusBg} ${
                              isSelected
                                ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-[#131d31]'
                                : 'hover:border-slate-600'
                            } ${cell.isFuture && !isSelected ? 'opacity-65' : ''}`}
                          >
                            <span
                              className={`text-xs sm:text-sm tabular-nums leading-none ${
                                cell.isToday || isSelected ? 'font-extrabold' : 'font-semibold'
                              }`}
                            >
                              {cell.dayNum}
                            </span>
                            <div className="flex items-center justify-center gap-0.5 min-h-[6px]">
                              {cell.dayDoseStat && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    cell.dayDoseStat === 'all_taken'
                                      ? 'bg-emerald-400'
                                      : cell.dayDoseStat === 'partial'
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                  }`}
                                />
                              )}
                              {cell.hasSos && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                              {cell.hasNote && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                              {cell.hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                              {cell.hasStock && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Legenda (igual ao Calendário do Paciente) */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Tomado
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> Parcial
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400" /> Perdido
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-400" /> SOS
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400" /> Nota
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400" /> Evento
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-400" /> Estoque
                      </span>
                    </div>
                  </div>

                  {/* Painel de Detalhes do Dia Selecionado */}
                  <div className="lg:col-span-5 bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-white truncate">
                          {formatFullDateBr(activeSelectedCalDate)}
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Detalhes e registros deste dia
                        </p>
                      </div>
                      {activeSelectedCalDate === todayIso && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold shrink-0">
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* 1. Doses do Dia */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Medicações ({selectedDayDetails.doses.length})
                        </span>
                      </div>

                      {selectedDayDetails.doses.length === 0 ? (
                        <p className="text-xs text-slate-500 bg-[#0b1120]/60 rounded-xl px-3 py-2.5 border border-slate-800/60">
                          Nenhuma dose programada para esta data.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                          {selectedDayDetails.doses.map((dose) => {
                            const statusChip =
                              dose.status === 'confirmed'
                                ? { label: 'Tomada', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
                                : dose.status === 'missed'
                                ? { label: 'Não confirmada', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
                                : { label: 'Prevista', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
                            return (
                              <div
                                key={dose.id}
                                className="p-2.5 rounded-xl bg-[#0b1120] border border-slate-800 flex items-center justify-between gap-2.5"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-blue-300 tabular-nums">
                                      {dose.hora}
                                    </span>
                                    <span className="text-xs font-semibold text-white truncate">
                                      {dose.med_name}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${statusChip.cls}`}>
                                      {statusChip.label}
                                    </span>
                                    {dose.dosagem && (
                                      <span className="text-[11px] text-slate-400">{dose.dosagem}</span>
                                    )}
                                  </div>
                                </div>
                                {activeSelectedCalDate <= todayIso && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDoseTarget(dose);
                                      setDoseAdministeredTime(dose.hora);
                                      setDoseActionReason('');
                                      setConfirmDoseSave(false);
                                      setShowDoseModal(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] font-semibold transition-colors shrink-0"
                                  >
                                    {dose.status === 'pending' ? 'Registrar' : 'Retificar'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedDayDetails.sosDoses.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {selectedDayDetails.sosDoses.map((s) => (
                            <div
                              key={s.id}
                              className="p-2.5 rounded-xl bg-orange-950/20 border border-orange-500/30 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-orange-300">Uso SOS: {s.med_name}</span>
                                <p className="text-[11px] text-slate-300 truncate">{s.reason}</p>
                              </div>
                              <span className="font-mono text-[11px] text-orange-200 shrink-0">{s.hora}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. Compromissos / Eventos do Dia */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Consultas e Eventos ({selectedDayDetails.events.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewAppointmentForm({ ...EMPTY_APPOINTMENT_FORM, date: activeSelectedCalDate });
                            setShowAppointmentModal(true);
                          }}
                          className="text-[11px] font-semibold text-purple-300 hover:text-purple-200"
                        >
                          + Agendar neste dia
                        </button>
                      </div>

                      {selectedDayDetails.events.length === 0 ? (
                        <p className="text-xs text-slate-500">Sem consultas ou exames nesta data.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayDetails.events.map((ev) => (
                            <div
                              key={ev.id}
                              className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start justify-between gap-2.5"
                            >
                              <div className="min-w-0 space-y-0.5 text-xs">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-white">{ev.title}</span>
                                  <span className="text-[10px] text-purple-300 uppercase font-semibold">
                                    · {ev.type || 'consulta'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-2">
                                  {ev.time && <span>{ev.time}</span>}
                                  {ev.doctor && <span>· {ev.doctor}</span>}
                                  {ev.location && <span>· {ev.location}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleDeleteAppointment(ev.id)}
                                aria-label="Remover compromisso"
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors shrink-0"
                              >
                                <Trash2 size={14} className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. Anotações do Dia */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Anotações ({selectedDayDetails.notes.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteForm({ id: null, date: activeSelectedCalDate, content: '', mood: '' });
                            setShowNoteModal(true);
                          }}
                          className="text-[11px] font-semibold text-blue-300 hover:text-blue-200"
                        >
                          + Adicionar nota
                        </button>
                      </div>

                      {selectedDayDetails.notes.length === 0 ? (
                        <p className="text-xs text-slate-500">Sem anotações registradas para esta data.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayDetails.notes.map((n) => (
                            <div
                              key={n.id}
                              className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start justify-between gap-2.5"
                            >
                              <div className="min-w-0 space-y-1 text-xs">
                                {n.mood && (
                                  <span className="inline-block px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold">
                                    {n.mood}
                                  </span>
                                )}
                                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                  {n.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNoteForm({
                                      id: n.id,
                                      date: String(n.date || activeSelectedCalDate).slice(0, 10),
                                      content: n.content || '',
                                      mood: n.mood || '',
                                    });
                                    setShowNoteModal(true);
                                  }}
                                  aria-label="Editar anotação"
                                  className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                  <Pencil size={13} className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleDeleteCalendarNote(n.id)}
                                  aria-label="Remover anotação"
                                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors"
                                >
                                  <Trash2 size={13} className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 4. Movimentações de Estoque no Dia */}
                    {selectedDayDetails.stockMoves.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Estoque no Dia ({selectedDayDetails.stockMoves.length})
                        </span>
                        <div className="space-y-1.5">
                          {selectedDayDetails.stockMoves.map((sm) => {
                            const delta = Number(sm.quantity_delta ?? sm.quantity_changed ?? 0);
                            return (
                              <div
                                key={sm.id}
                                className="p-2.5 rounded-xl bg-teal-950/20 border border-teal-500/30 text-xs flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold text-teal-200 truncate block">
                                    {sm.med_name || 'Medicamento'} ({delta >= 0 ? `+${delta}` : delta} un)
                                  </span>
                                  {sm.notes && (
                                    <span className="text-[11px] text-slate-400 truncate block">{sm.notes}</span>
                                  )}
                                </div>
                                <Package size={14} className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Próximos Compromissos + Resumo Mensal de 8 Cards (igual ao Paciente) */}
                {upcomingEvents.length > 0 && (
                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Calendar size={16} className="w-4 h-4 text-purple-400" />
                        <span>Próximos Compromissos</span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {upcomingEvents.map((apt) => (
                        <button
                          key={apt.id}
                          type="button"
                          onClick={() => handleSelectCalDate(String(apt.date || '').slice(0, 10))}
                          className="text-left p-3.5 rounded-xl bg-[#0b1120] border border-slate-800 hover:border-purple-500/40 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-white text-xs sm:text-sm truncate">{apt.title}</span>
                              <span className="text-[11px] text-purple-300 font-semibold capitalize">
                                · {apt.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 tabular-nums">
                              <span>
                                {formatDateBr(apt.date)}
                                {apt.time ? ` às ${apt.time}` : ''}
                              </span>
                              {apt.doctor && <span>· {apt.doctor}</span>}
                              {apt.location && <span>· {apt.location}</span>}
                            </div>
                          </div>
                          <ChevronRight size={15} className="w-4 h-4 text-purple-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 size={16} className="w-4 h-4 text-blue-400" />
                      <span>
                        Resumo — {MONTHS_PT[calMonthIndex]} {calYear}
                      </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-emerald-400 tabular-nums">
                        {monthSummary.adherencePct !== null ? `${monthSummary.adherencePct}%` : '—'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Adesão</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-blue-400 tabular-nums">
                        {monthSummary.takenCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Tomadas</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-amber-400 tabular-nums">
                        {monthSummary.lateCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Atrasos</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-rose-400 tabular-nums">
                        {monthSummary.missedCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Perdidas</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-sky-400 tabular-nums">
                        {monthSummary.notesCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Anotações</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-purple-400 tabular-nums">
                        {monthSummary.eventsCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Consultas</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-orange-400 tabular-nums">
                        {monthSummary.sosCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Uso SOS</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800/80 text-center">
                      <div className="text-lg font-extrabold text-teal-400 tabular-nums">
                        {monthSummary.restockCount}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Reposições</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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
                  {auditLogs.map((log) => {
                    const formatted = formatAuditLogEntry(log);
                    const toneClasses =
                      formatted.tone === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : formatted.tone === 'amber'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : formatted.tone === 'rose'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : formatted.tone === 'indigo'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        : formatted.tone === 'blue'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700';

                    return (
                      <div key={log.id} className="p-4 sm:p-5 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${toneClasses}`}>
                              {formatted.category}
                            </span>
                            <span className="font-bold text-white text-sm leading-snug">
                              {formatted.title}
                            </span>
                          </div>
                          <span className="text-slate-400 tabular-nums shrink-0">
                            {formatBrazilDateTime(log.created_at)}
                          </span>
                        </div>

                        {(formatted.contextSummary || formatted.actorLabel) && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-300">
                            {formatted.contextSummary && <span>{formatted.contextSummary}</span>}
                            {formatted.contextSummary && formatted.actorLabel && (
                              <span aria-hidden="true" className="text-slate-600">·</span>
                            )}
                            {formatted.actorLabel && (
                              <span className="text-slate-400">
                                Por: <strong className="text-slate-200 font-medium">{formatted.actorLabel}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-slate-400 leading-relaxed">
                          Motivo: <strong className="text-slate-200 font-medium">{formatted.reason}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: SOBRE, VERSÕES E DOWNLOADS ANDROID */}
          {currentTab === 'about' && (() => {
            const webInfo = systemVersions?.web || {
              name: 'MediCare Cuidador Web',
              version: '2.0.0',
              swVersion: 'medicare-cuidador-v5',
              timezone: 'America/Sao_Paulo',
            };
            const patientApp = systemVersions?.patientAndroid || {
              name: 'MediCare Paciente',
              package: 'br.com.medicare.paciente',
              versionName: '2.8.8',
              versionCode: 288,
              apkAvailable: true,
              apkSizeBytes: 0,
              updatedAt: null,
              downloadUrl: '/api/apk',
            };
            const caregiverApp = systemVersions?.caregiverAndroid || {
              name: 'MediCare Cuidador',
              package: 'br.com.medicare.cuidador',
              versionName: '2.0.0',
              versionCode: 200,
              apkAvailable: false,
              apkSizeBytes: 0,
              updatedAt: null,
              downloadUrl: '/api/apk/cuidador',
            };
            const formatApkSize = (bytes) => {
              const num = Number(bytes || 0);
              if (num <= 0) return 'Disponível para download';
              if (num >= 1024 * 1024) {
                return `${(num / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
              }
              return `${Math.round(num / 1024)} KB`;
            };

            return (
              <div className="space-y-6">
                {/* Cabeçalho */}
                <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <Image
                      src={medicareLogo}
                      alt="MediCare"
                      width={52}
                      height={52}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg shadow-blue-950/50 shrink-0"
                    />
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        Sobre o MediCare
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5 leading-relaxed">
                        Consulte as versões da plataforma Web, dos aplicativos Android e faça o download direto dos instaladores.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={loadSystemVersions}
                    disabled={versionsLoading}
                    className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw size={14} className={`w-3.5 h-3.5 ${versionsLoading ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{versionsLoading ? 'Verificando...' : 'Atualizar versões'}</span>
                  </button>
                </div>

                {/* Resumo de Versões: Web vs App Android */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Versão da Web</span>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                        <Globe size={16} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-white tabular-nums">v{webInfo.version}</div>
                      <p className="text-xs text-slate-400 mt-1">
                        Portal & Painel Cuidador ({webInfo.swVersion})
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>Fuso: Brasília (UTC-03:00)</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                        {pwaInstall.isInstalled ? 'Modo App (PWA)' : 'Navegador Web'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">App Paciente (Android)</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                        <HeartHandshake size={16} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-white tabular-nums">
                        v{patientApp.versionName || '2.8.8'}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 tabular-nums">
                        Build {patientApp.versionCode || '—'} · {patientApp.package}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>{formatApkSize(patientApp.apkSizeBytes)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md border font-semibold ${
                          patientApp.apkAvailable
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {patientApp.apkAvailable ? 'APK disponível' : 'Indisponível'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">App Cuidador (Android)</span>
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                        <ShieldCheck size={16} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-white tabular-nums">
                        v{caregiverApp.versionName || webInfo.version}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 tabular-nums">
                        Build {caregiverApp.versionCode || '—'} · {caregiverApp.package}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        {caregiverApp.apkAvailable ? formatApkSize(caregiverApp.apkSizeBytes) : 'APK + PWA Android'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border font-semibold ${
                          caregiverApp.apkAvailable
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {caregiverApp.apkAvailable ? 'APK disponível' : 'Via PWA / Servidor'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Downloads para Android */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Download MediCare Paciente Android */}
                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                            <Smartphone size={20} className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-base sm:text-lg font-bold text-white">
                              MediCare Paciente para Android
                            </h2>
                            <p className="text-xs text-emerald-400 font-semibold tabular-nums">
                              Versão {patientApp.versionName} (Build {patientApp.versionCode})
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Aplicativo nativo completo para o celular do paciente: alarmes exatos em tela cheia, registro rápido de doses, lembretes de consultas, estoque e vínculo por código com cuidadores.
                      </p>

                      {patientApp.updatedAt && (
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          Atualizado em: {formatBrazilDateTime(patientApp.updatedAt)} · {formatApkSize(patientApp.apkSizeBytes)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {patientApp.apkAvailable ? (
                        <a
                          href="/api/apk"
                          download="MediCare-Paciente.apk"
                          className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition-colors"
                        >
                          <Download size={18} className="w-4 h-4 shrink-0" />
                          <span>Baixar MediCare Paciente (.APK)</span>
                        </a>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                          O arquivo MediCare-Paciente.apk ainda não foi compilado neste servidor.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download MediCare Cuidador Android */}
                  <div className="bg-[#131d31] rounded-2xl border border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                            <Smartphone size={20} className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-base sm:text-lg font-bold text-white">
                              MediCare Cuidador para Android
                            </h2>
                            <p className="text-xs text-blue-400 font-semibold tabular-nums">
                              Versão {caregiverApp.versionName || webInfo.version} (Build {caregiverApp.versionCode || 200})
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Acesso dedicado no celular do cuidador para acompanhar doses em tempo real, confirmar administrações, receber alertas de atraso e gerenciar pacientes vinculados.
                      </p>

                      {caregiverApp.updatedAt && (
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          Atualizado em: {formatBrazilDateTime(caregiverApp.updatedAt)} · {formatApkSize(caregiverApp.apkSizeBytes)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {caregiverApp.apkAvailable ? (
                        <a
                          href="/api/apk/cuidador"
                          download="MediCare-Cuidador.apk"
                          className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-colors"
                        >
                          <Download size={18} className="w-4 h-4 shrink-0" />
                          <span>Baixar MediCare Cuidador (.APK)</span>
                        </a>
                      ) : (
                        <div className="p-3 rounded-xl bg-[#0b1120] border border-slate-800 text-xs text-slate-300 leading-relaxed">
                          O instalador <strong className="text-white">MediCare-Cuidador.apk</strong> será disponibilizado aqui após rodar o build do APK no servidor. Enquanto isso, instale instantaneamente como aplicativo via navegador abaixo:
                        </div>
                      )}

                      {pwaInstall.isInstalled ? (
                        <div className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 size={15} className="w-4 h-4 shrink-0" />
                          <span>App Web (PWA) já instalado neste aparelho</span>
                        </div>
                      ) : pwaInstall.isInstallable ? (
                        <button
                          type="button"
                          onClick={() => pwaInstall.install()}
                          className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors"
                        >
                          <Download size={15} className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Instalar App Rápido no Android (PWA)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowAndroidPwaGuide((prev) => !prev)}
                          className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                        >
                          <Info size={15} className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>{showAndroidPwaGuide ? 'Ocultar guia PWA' : 'Como instalar direto pelo Chrome / Safari'}</span>
                        </button>
                      )}

                      {showAndroidPwaGuide && !pwaInstall.isInstalled && !pwaInstall.isInstallable && (
                        <div className="p-3.5 rounded-xl bg-[#0b1120] border border-slate-800 text-xs text-slate-300 space-y-1.5 leading-relaxed">
                          <p className="font-bold text-white">Instalação rápida sem APK (PWA):</p>
                          {pwaInstall.isIOS ? (
                            <p>No Safari do iPhone/iPad, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>
                          ) : (
                            <p>No Google Chrome ou Edge do Android, toque no menu <strong>⋮</strong> (canto superior direito) e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instruções de instalação de APK no Android */}
                <div className="bg-[#131d31]/80 rounded-2xl border border-slate-800/80 p-4 sm:p-5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Info size={16} className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
                    <p className="font-bold text-white">Dica ao instalar o arquivo .APK no Android</p>
                    <p>
                      Ao abrir o arquivo baixado (<strong>MediCare-Paciente.apk</strong> ou <strong>MediCare-Cuidador.apk</strong>), caso o Android exiba um aviso de segurança, toque em <strong>Configurações</strong> e ative <strong>Permitir desta fonte</strong> para concluir a instalação.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
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
                onClick={() => navigateToTab('management')}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <SlidersHorizontal size={18} className="w-4 h-4 text-indigo-300" />
                  Painel de Gerenciamento
                </span>
                <ChevronRight size={16} className="w-4 h-4 text-indigo-300" />
              </button>

              <button
                type="button"
                onClick={() => navigateToTab('reports')}
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
                onClick={() => navigateToTab('audit')}
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
                onClick={() => navigateToTab('about')}
                className="w-full min-h-[50px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0b1120] border border-slate-800 text-slate-100 text-sm font-semibold"
              >
                <span className="flex items-center gap-3">
                  <Info size={18} className="w-4 h-4 text-emerald-400" />
                  Sobre, Versões & Apps Android
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

              <PWAInstallButton
                variant="menu"
                onAfterAction={() => setShowMobileMenuSheet(false)}
              />

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
                placeholder="Ex: MED-123456"
                className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder-slate-500 uppercase focus:outline-none focus:border-blue-500"
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
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Tipo de Tratamento *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'continuous',
                      label: 'Contínuo',
                      sub: 'Uso diário',
                      activeClass: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
                    },
                    {
                      id: 'temporary',
                      label: 'Temporário',
                      sub: 'Por dias',
                      activeClass: 'bg-amber-500/15 border-amber-500 text-amber-300',
                    },
                    {
                      id: 'sos',
                      label: 'SOS',
                      sub: 'Se necessário',
                      activeClass: 'bg-blue-500/15 border-blue-500 text-blue-300',
                    },
                  ].map((opt) => {
                    const isSelected = newMedForm.treatment_type === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setNewMedForm((prev) => ({
                            ...prev,
                            treatment_type: opt.id,
                            ...(opt.id === 'sos' ? { horarios: '' } : {}),
                          }));
                          if (opt.id === 'sos') {
                            setSelectedIntervalHours(null);
                          }
                        }}
                        className={`min-h-[52px] px-2.5 py-2 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? opt.activeClass
                            : 'bg-[#0b1120] border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{opt.label}</div>
                        <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {newMedForm.treatment_type === 'temporary' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    Duração do Tratamento (dias) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMedForm.treatment_days}
                    onChange={(e) => setNewMedForm({ ...newMedForm, treatment_days: e.target.value })}
                    placeholder="Ex: 7, 10, 14"
                    className="w-full bg-[#0b1120] border border-amber-500/40 rounded-xl px-3 py-2 min-h-[42px] text-sm text-white"
                  />
                </div>
              )}

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

              {newMedForm.treatment_type === 'sos' ? (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 leading-relaxed">
                  Uso Sob Demanda (SOS): este medicamento não terá horários fixos e ficará disponível no app do paciente para registro sempre que utilizado.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs text-slate-300">Horários (HH:MM) *</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">1ª dose:</span>
                      <input
                        type="time"
                        value={scheduleBaseTime}
                        onChange={(e) => {
                          const nextBase = e.target.value || '08:00';
                          setScheduleBaseTime(nextBase);
                          if (selectedIntervalHours) {
                            const nextList = buildIntervalScheduleList(nextBase, selectedIntervalHours);
                            setNewMedForm((prev) => ({ ...prev, horarios: nextList.join(', ') }));
                          }
                        }}
                        className="bg-[#0b1120] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#0b1120] border border-slate-800 space-y-2">
                    <span className="block text-[11px] font-semibold text-slate-400">
                      Sugestão por intervalo:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SCHEDULE_INTERVAL_PRESETS.map((preset) => {
                        const isActive = selectedIntervalHours === preset.hours;
                        return (
                          <button
                            key={preset.hours}
                            type="button"
                            onClick={() => {
                              setSelectedIntervalHours(preset.hours);
                              const list = buildIntervalScheduleList(scheduleBaseTime || '08:00', preset.hours);
                              setNewMedForm((prev) => ({ ...prev, horarios: list.join(', ') }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              isActive
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-[#131d31] border-slate-700 text-slate-300 hover:border-blue-500/60 hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    value={newMedForm.horarios}
                    onChange={(e) => {
                      setSelectedIntervalHours(null);
                      setNewMedForm({ ...newMedForm, horarios: e.target.value });
                    }}
                    placeholder="Ex: 08:00, 16:00, 00:00"
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  value={newMedForm.observacoes}
                  onChange={(e) => setNewMedForm({ ...newMedForm, observacoes: e.target.value })}
                  placeholder="Ex: Tomar após as refeições"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
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
              <strong>{selectedDoseTarget.hora}</strong>
              {selectedDoseTarget.dose_date ? ` (${formatDateBr(selectedDoseTarget.dose_date)})` : ''} · Paciente:{' '}
              <strong>{selectedPatient?.nome}</strong>.
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
      {/* MODAL: NOVA ANOTAÇÃO NO CALENDÁRIO                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNoteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowNoteModal(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-bold text-white mb-3">
              {noteForm.id ? 'Editar Anotação do Calendário' : 'Nova Anotação no Calendário'}
            </h3>
            <form onSubmit={handleSaveCalendarNote} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={noteForm.date}
                  onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2 min-h-[44px] text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Etiqueta / Tipo (opcional)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['Rotina', 'Sintoma', 'Pressão/Glicemia', 'Efeito colateral', 'Observação'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNoteForm({ ...noteForm, mood: noteForm.mood === tag ? '' : tag })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        noteForm.mood === tag
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#0b1120] border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Anotação Clínica *</label>
                <textarea
                  rows={4}
                  required
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  placeholder="Ex: Paciente relatou tontura leve pela manhã; pressão 120x80 mmHg..."
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Anotação'}
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

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: CONFIRMAR REMOÇÃO DE MEDICAMENTO                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {medToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={18} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remover Medicamento?</h3>
                <p className="text-xs text-slate-400">
                  {medToDelete.nome} ({medToDelete.dosagem})
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              O medicamento será desativado das prescrições de <strong>{selectedPatient?.nome}</strong> (Estoque atual:{' '}
              <strong>{medToDelete.quantidade} un</strong>). O histórico de doses já registradas será preservado.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setMedToDelete(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteMedication}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
              >
                {actionLoading ? 'Removendo...' : 'Confirmar Remoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: VINCULAR CELULAR DO PACIENTE (CÓDIGO DE ATIVAÇÃO)   */}
      {/* ─────────────────────────────────────────────────────────── */}
      {pairingModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Smartphone size={20} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">Vincular Celular do Paciente</h3>
                <p className="text-xs text-slate-400 truncate">{pairingModalData.nome}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0b1120] border border-slate-700/80 text-center space-y-3 mb-4">
              <span className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Código de Ativação (uso único · válido por 7 dias)
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold tracking-widest text-blue-400 select-all py-1">
                {pairingModalData.code}
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(pairingModalData.code);
                        setCopiedPairingCode(true);
                        showToast('Código copiado!');
                      }
                    } catch (_) {
                      showToast('Selecione e copie o código manualmente.', 'error');
                    }
                  }}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  {copiedPairingCode ? <Check size={14} className="w-3.5 h-3.5" /> : <Copy size={14} className="w-3.5 h-3.5" />}
                  <span>{copiedPairingCode ? 'Copiado!' : 'Copiar Código'}</span>
                </button>
                <button
                  type="button"
                  disabled={pairingLoading}
                  onClick={() =>
                    handleOpenPatientPairing({
                      patient_id: pairingModalData.patientId,
                      nome: pairingModalData.nome,
                    })
                  }
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={`w-3.5 h-3.5 ${pairingLoading ? 'animate-spin' : ''}`} />
                  <span>Novo Código</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 space-y-1.5 mb-5 leading-relaxed">
              <p className="font-semibold text-blue-300">Como conectar no celular do paciente:</p>
              <p>1. Instale e abra o app <strong>MediCare Paciente</strong> no celular da pessoa.</p>
              <p>2. Na tela de login, toque em <strong>&quot;Já fui cadastrado pelo cuidador (Código)&quot;</strong>.</p>
              <p>
                3. Informe o código <strong>{pairingModalData.code}</strong>. O perfil pré-criado, os medicamentos e o vínculo com você serão baixados na hora.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPairingModalData(null)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: CENTRAL DE NOTIFICAÇÕES DO CUIDADOR                 */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showNotificationsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowNotificationsModal(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 p-5 sm:p-6 max-w-lg w-full shadow-2xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-4 sm:hidden shrink-0" />
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Bell size={18} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">Notificações e Alertas</h3>
                  <p className="text-[11px] text-slate-400">
                    {unreadNotifCount > 0
                      ? `${unreadNotifCount} alerta(s) não lido(s)`
                      : 'Todos os alertas visualizados'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] font-semibold transition-colors"
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotificationsModal(false)}
                  aria-label="Fechar notificações"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={16} className="w-4 h-4" />
                </button>
              </div>
            </div>

            {typeof window !== 'undefined' && 'Notification' in window && pushPermission !== 'granted' && (
              <div className="mb-4 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="space-y-0.5 text-xs">
                  <p className="font-semibold text-blue-200">
                    {pushPermission === 'denied'
                      ? 'Notificações bloqueadas no navegador'
                      : 'Receba alertas na barra do aparelho'}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {pushPermission === 'denied'
                      ? 'Libere a permissão de notificações nas configurações do navegador para ser avisado quando uma dose atrasar.'
                      : pushConfigured
                      ? 'Ative para receber avisos quando o paciente pedir confirmação ou passar de 1 hora sem tomar o remédio.'
                      : 'Ative para receber avisos em tempo real sempre que o painel estiver em segundo plano.'}
                  </p>
                </div>
                {pushPermission !== 'denied' && (
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={handleEnablePushNotifications}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    {pushLoading ? 'Ativando...' : 'Ativar Alertas'}
                  </button>
                )}
              </div>
            )}

            {totalPendingApprovals > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-2.5 shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-200">
                    {totalPendingApprovals} solicitação(ões) de dose aguardando sua aprovação
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">
                    Abra a aba Doses para aprovar ou recusar agora.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const firstPendingPid = allApprovalRequests[0]?.patient_id;
                    if (firstPendingPid) {
                      setSelectedPatientId(String(firstPendingPid));
                    }
                    setShowNotificationsModal(false);
                    navigateToTab('dashboard');
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                >
                  Ir para Doses
                </button>
              </div>
            )}

            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
              {notificationsList.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-xl bg-[#0b1120] border border-slate-800/80 text-slate-400 text-xs leading-relaxed">
                  Nenhuma notificação recente. Você será avisado automaticamente quando o paciente solicitar confirmação de dose ou ficar mais de 1 hora sem registrar a medicação.
                </div>
              ) : (
                notificationsList.map((notif) => {
                  const isOverdue = notif.tipo === 'atraso';
                  const isCaregiverReq = notif.tipo === 'cuidador';
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleMarkNotificationRead(notif.id, true)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors space-y-1.5 ${
                        notif.lida
                          ? 'bg-[#0b1120]/70 border-slate-800/80 opacity-80 hover:opacity-100'
                          : isOverdue
                          ? 'bg-rose-950/25 border-rose-500/40 hover:border-rose-400/60'
                          : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : isCaregiverReq
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isOverdue
                            ? 'Atraso (+1h)'
                            : isCaregiverReq
                            ? 'Solicitação do paciente'
                            : 'Aviso'}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
                          {!notif.lida && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" aria-label="Não lida" />
                          )}
                          <span>{formatBrazilDateTime(notif.created_at)}</span>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-white leading-snug">{notif.titulo}</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{notif.mensagem}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL / DRAWER: CHAT CUIDADOR <-> PACIENTE                 */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showChatDrawer && selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-end sm:p-4"
          onClick={() => setShowChatDrawer(false)}
        >
          <div
            className="bg-[#131d31] rounded-t-3xl sm:rounded-2xl border border-slate-800 w-full sm:max-w-md h-[86vh] sm:h-[640px] sm:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-800/90 shrink-0 space-y-3">
              <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedPatient.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {selectedPatient.nome}
                    </h3>
                    <p className="text-[11px] text-emerald-300/90 font-medium truncate">
                      {selectedPatient.relationship_label} · Chat direto seguro
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChatDrawer(false)}
                  aria-label="Fechar conversa"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X size={18} className="w-4 h-4" />
                </button>
              </div>

              {patients.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {patients.map((p) => {
                    const activeP = p.patient_id === selectedPatient.patient_id;
                    const pUnread = unreadChatByPatient[p.patient_id] || 0;
                    return (
                      <button
                        key={p.patient_id}
                        type="button"
                        onClick={() => handleOpenPatientChat(p.patient_id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                          activeP
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200'
                            : 'bg-[#0b1120] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{p.nome.split(' ')[0]}</span>
                        {pUnread > 0 && (
                          <span className="px-1 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-extrabold tabular-nums">
                            {pUnread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#0b1120]/60">
              {selectedPatient.role === 'independente' ? (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/35 text-xs text-amber-200 leading-relaxed">
                  Este paciente configurou a conta no modo <strong>Independente</strong>. Enquanto estiver neste modo, apenas o Assistente de Saúde com IA fica ativo no aplicativo do paciente.
                </div>
              ) : chatLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                  <Loader2 size={16} className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Carregando mensagens...</span>
                </div>
              ) : chatErrorMsg ? (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/35 text-xs text-rose-200 leading-relaxed">
                  {chatErrorMsg}
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-[#131d31] border border-slate-800/80 space-y-2">
                  <MessageSquare size={22} className="w-5 h-5 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-white">Nenhuma mensagem ainda</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Envie uma mensagem para {selectedPatient.nome}. Ela aparecerá na aba Assistente &rarr; Falar com o Cuidador do aplicativo Android.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isCaregiver = msg.sender_role === 'cuidador';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCaregiver ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                          isCaregiver
                            ? 'bg-emerald-600 text-white rounded-br-sm'
                            : 'bg-[#131d31] border border-slate-800 text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        {!isCaregiver && (
                          <div className="text-[10px] font-bold text-emerald-300 mb-0.5">
                            {msg.sender_name || selectedPatient.nome}
                          </div>
                        )}
                        <div>{msg.message}</div>
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] tabular-nums ${
                            isCaregiver ? 'text-emerald-100/80' : 'text-slate-400'
                          }`}
                        >
                          <span>{formatBrazilTime(msg.created_at) || ''}</span>
                          {isCaregiver && (
                            <CheckCheck
                              size={12}
                              className={`w-3 h-3 ${msg.read_at ? 'text-sky-200' : 'text-emerald-100/60'}`}
                              title={msg.read_at ? 'Lida pelo paciente' : 'Enviada'}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatScrollEndRef} />
            </div>

            {selectedPatient.role !== 'independente' && !chatErrorMsg && (
              <form
                onSubmit={handleSendCaregiverChatMessage}
                className="p-3.5 border-t border-slate-800/90 bg-[#131d31] flex items-end gap-2 shrink-0"
              >
                <textarea
                  rows={1}
                  maxLength={2000}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendCaregiverChatMessage(e);
                    }
                  }}
                  placeholder={`Escreva para ${selectedPatient.nome.split(' ')[0]}...`}
                  className="flex-1 bg-[#0b1120] border border-slate-700/80 rounded-xl px-3.5 py-2.5 min-h-[42px] max-h-28 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  aria-label="Enviar mensagem"
                  className="min-w-[44px] min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white flex items-center justify-center transition-colors shrink-0"
                >
                  {chatSending ? (
                    <Loader2 size={16} className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send size={16} className="w-4 h-4" />
                  )}
                </button>
              </form>
            )}
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
            const mobileBadgeCount = item.id === 'dashboard' ? totalPendingApprovals : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 rounded-xl transition-colors focus:outline-none ${
                  isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute top-1 w-5 h-0.5 rounded-full bg-blue-400" aria-hidden="true" />
                )}
                <div className="relative">
                  <Icon size={20} className="w-5 h-5 shrink-0" />
                  {mobileBadgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold flex items-center justify-center border border-[#0f172a] tabular-nums">
                      {mobileBadgeCount > 9 ? '9+' : mobileBadgeCount}
                    </span>
                  )}
                </div>
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
              currentTab === 'management' || currentTab === 'reports' || currentTab === 'audit' || currentTab === 'about' || showMobileMenuSheet
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            {(currentTab === 'management' || currentTab === 'reports' || currentTab === 'audit' || currentTab === 'about') && (
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
