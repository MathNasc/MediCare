function translateAuthError(err) {
  if (!err) return "Erro desconhecido.";
  const msg = typeof err === "string" ? err : err.message;
  if (!msg) return "Erro de autenticação.";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("at least 6 characters")) return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("Email not confirmed")) return "Por favor, confirme seu e-mail antes de entrar.";
  if (msg.includes("Failed to fetch")) return "Verifique sua conexão com a internet e tente novamente.";
  if (msg.includes("rate limit")) return "Muitas tentativas. Tente novamente mais tarde.";
  return "Erro ao autenticar. Verifique seus dados e tente novamente.";
}

// ─── Unified DB Layer ─────────────────────────────────────────────────────────
import { isSupabaseEnabled, SupabaseAuth, SupaMeds, SupaHist } from './supabase';

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── In-Memory / Local Storage Fallbacks (When Supabase is not configured) ────
const DEFAULT_MEDS = [
  {
    id: 'med-1',
    user_id: 'default',
    nome: 'Paracetamol',
    dosagem: '750mg',
    tipo: 'comprimido',
    instrucoes: 'Tomar com água após o café',
    quantidade: 20,
    aviso_estoque: 5,
    horarios: ['08:00', '20:00'],
    dias_semana: [0, 1, 2, 3, 4, 5, 6],
    status: 'ativo',
    ativo: true,
    treatment_type: 'continuous',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-2',
    user_id: 'default',
    nome: 'Losartana Potássica',
    dosagem: '50mg',
    tipo: 'comprimido',
    instrucoes: 'Em jejum pela manhã',
    quantidade: 14,
    aviso_estoque: 5,
    horarios: ['09:00'],
    dias_semana: [0, 1, 2, 3, 4, 5, 6],
    status: 'ativo',
    ativo: true,
    treatment_type: 'continuous',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-3',
    user_id: 'default',
    nome: 'Vitamina D',
    dosagem: '2.000 UI',
    tipo: 'gotas',
    instrucoes: '1 cápsula ao almoço',
    quantidade: 30,
    aviso_estoque: 7,
    horarios: ['12:30'],
    dias_semana: [0, 1, 2, 3, 4, 5, 6],
    status: 'ativo',
    ativo: true,
    treatment_type: 'continuous',
    created_at: new Date().toISOString(),
  },
];

function getLocalMeds() {
  if (typeof window === 'undefined') return DEFAULT_MEDS;
  const raw = localStorage.getItem('mc_local_meds');
  if (!raw) {
    localStorage.setItem('mc_local_meds', JSON.stringify(DEFAULT_MEDS));
    return DEFAULT_MEDS;
  }
  try { return JSON.parse(raw) || DEFAULT_MEDS; } catch { return DEFAULT_MEDS; }
}

function setLocalMeds(meds) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mc_local_meds', JSON.stringify(meds));
  }
}

function getLocalHist() {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('mc_local_hist');
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function setLocalHist(hist) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mc_local_hist', JSON.stringify(hist));
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const AuthDB = {
  async register(nome, email, pass, role = 'independente') {
    if (!isSupabaseEnabled) {
      const localUser = {
        id: 'user-local-' + uid().slice(0, 8),
        nome: nome || 'Usuário MediCare',
        email: email || 'usuario@medicare.local',
        role,
        created_at: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('mc_local_user', JSON.stringify(localUser));
      }
      return { user: localUser };
    }
    const { data, error } = await SupabaseAuth.signUp(email, pass, nome, role);
    if (error) return { error: translateAuthError(error) };
    
    if (!data?.session) {
      if (data?.user?.identities && data.user.identities.length === 0) {
        return { error: 'Este e-mail já está cadastrado. Faça login.' };
      }
      return { message: 'Conta criada. Verifique seu e-mail para confirmar sua conta.' };
    }
    
    return { user: { id: data.user.id, nome, email, role, created_at: data.user.created_at } };
  },

  async login(email, pass) {
    if (!isSupabaseEnabled) {
      let localUser = null;
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('mc_local_user');
        if (stored) {
          try { localUser = JSON.parse(stored); } catch (e) {}
        }
      }
      if (!localUser) {
        localUser = {
          id: 'user-local-' + uid().slice(0, 8),
          nome: email ? email.split('@')[0] : 'Usuário MediCare',
          email: email || 'usuario@medicare.local',
          role: 'independente',
          created_at: new Date().toISOString()
        };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('mc_local_user', JSON.stringify(localUser));
      }
      return { user: localUser };
    }
    const { data, error } = await SupabaseAuth.signIn(email, pass);
    if (error) return { error: translateAuthError(error) };
    if (!data?.session) return { error: 'Falha ao autenticar: sessão não estabelecida.' };
    const u = data.user;
    const role = await SupabaseAuth.getProfileRole(u.id);
    return { user: { id: u.id, nome: u.user_metadata?.nome || email, email: u.email, role, created_at: u.created_at } };
  },

  async logout() {
    if (isSupabaseEnabled) await SupabaseAuth.signOut();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('mc_local_user');
        localStorage.removeItem('mc_fs');
        localStorage.removeItem('mc_theme');
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (e) {}
    }
  },

  async current() {
    if (typeof window === 'undefined') return null;
    if (!isSupabaseEnabled) {
      const stored = localStorage.getItem('mc_local_user');
      if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
      }
      // Demo auto-user for instant preview in AI Studio
      const defaultUser = {
        id: 'user-local-preview',
        nome: 'Usuário MediCare',
        email: 'usuario@medicare.local',
        role: 'independente',
        created_at: new Date().toISOString()
      };
      localStorage.setItem('mc_local_user', JSON.stringify(defaultUser));
      return defaultUser;
    }
    try {
      const session = await SupabaseAuth.getSession();
      if (!session) return null;
      const u = session.user;
      const { supabase } = await import('./supabase');
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
      return { id: u.id, nome: u.user_metadata?.nome || u.email, email: u.email, role: data?.role || 'independente', created_at: u.created_at, role_change_pin: data?.role_change_pin };
    } catch { return null; }
  },

  async resetPassword(email) {
    if (!isSupabaseEnabled) return { error: null, message: 'Link de redefinição enviado (modo local).' };
    const { error } = await SupabaseAuth.resetPassword(email);
    return { error: error?.message || null };
  },

  async updateRole(userId, role) {
    if (!isSupabaseEnabled) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('mc_local_user');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            u.role = role;
            localStorage.setItem('mc_local_user', JSON.stringify(u));
          } catch (e) {}
        }
      }
      return true;
    }
    const { supabase } = await import('./supabase');
    if (!supabase) return false;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    return !error;
  },
};

// ─── Medications ──────────────────────────────────────────────────────────────
export const MedDB = {
  async list(userId) {
    if (!isSupabaseEnabled) return getLocalMeds();
    return SupaMeds.list(userId);
  },

  async add(med) {
    if (!isSupabaseEnabled) {
      const meds = getLocalMeds();
      const newMed = {
        ...med,
        id: med.id || ('med-' + uid().slice(0, 8)),
        user_id: userId(med.user_id),
        status: med.status || 'ativo',
        ativo: med.ativo !== undefined ? med.ativo : true,
        created_at: new Date().toISOString()
      };
      meds.push(newMed);
      setLocalMeds(meds);
      return newMed;
    }
    return SupaMeds.add(med);
  },

  async update(id, data) {
    if (!isSupabaseEnabled) {
      const meds = getLocalMeds();
      const idx = meds.findIndex(m => m.id === id);
      if (idx !== -1) {
        meds[idx] = { ...meds[idx], ...data, updated_at: new Date().toISOString() };
        setLocalMeds(meds);
      }
      return;
    }
    return SupaMeds.update(id, data);
  },

  async delete(id) {
    if (!isSupabaseEnabled) {
      const meds = getLocalMeds().filter(m => m.id !== id);
      setLocalMeds(meds);
      return;
    }
    return SupaMeds.delete(id);
  },
};

function userId(id) {
  return id || 'default';
}

// ─── History ──────────────────────────────────────────────────────────────────
export const HistDB = {
  async list(userId) {
    if (!isSupabaseEnabled) return getLocalHist();
    return SupaHist.list(userId);
  },

  async add(row) {
    if (!isSupabaseEnabled) {
      const hist = getLocalHist();
      const newRow = {
        ...row,
        id: row.id || ('hist-' + uid().slice(0, 8)),
        status: row.status || 'confirmed',
        created_at: row.created_at || new Date().toISOString()
      };
      hist.unshift(newRow);
      setLocalHist(hist);
      return newRow;
    }
    return SupaHist.add(row);
  },

  async delete(id) {
    if (!isSupabaseEnabled) {
      const hist = getLocalHist();
      const target = hist.find(h => h.id === id);
      if (target) {
        target.status = 'pending';
        setLocalHist(hist);
      }
      return true;
    }
    return SupaHist.delete(id);
  }
};
