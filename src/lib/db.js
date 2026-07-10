// ─── Unified DB Layer ─────────────────────────────────────────────────────────
// Auto-switches between Supabase (production) and localStorage (demo/offline)

import { isSupabaseEnabled, SupabaseAuth, SupaMeds, SupaHist } from './supabase';

// ─── localStorage fallback ────────────────────────────────────────────────────
const LS_KEY = 'mc_v3';

function getStore() {
  if (typeof window === 'undefined') return { users: [], meds: [], history: [] };
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : { users: [], meds: [], history: [] };
  } catch { return { users: [], meds: [], history: [] }; }
}

function saveStore(d) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const AuthDB = {
  // `role` — papel RBAC escolhido no cadastro: 'paciente' | 'cuidador' | 'independente'
  async register(nome, email, pass, role = 'independente') {
    if (isSupabaseEnabled) {
      const { data, error } = await SupabaseAuth.signUp(email, pass, nome, role);
      if (error) return { error: typeof error === 'string' ? error : error.message };
      return { user: { id: data.user.id, nome, email, role, created_at: data.user.created_at } };
    }
    const db = getStore();
    if (db.users.find((u) => u.email === email)) return { error: 'E-mail já cadastrado' };
    const user = { id: uid(), nome, email, pass, role, created_at: new Date().toISOString() };
    db.users.push(user); saveStore(db);
    if (typeof window !== 'undefined') localStorage.setItem('mc_uid', user.id);
    return { user };
  },

  async login(email, pass) {
    if (isSupabaseEnabled) {
      const { data, error } = await SupabaseAuth.signIn(email, pass);
      if (error) return { error: typeof error === 'string' ? error : error.message };
      const u = data.user;
      const role = await SupabaseAuth.getProfileRole(u.id);
      return { user: { id: u.id, nome: u.user_metadata?.nome || email, email: u.email, role, created_at: u.created_at } };
    }
    const db = getStore();
    const user = db.users.find((u) => u.email === email && u.pass === pass);
    if (!user) return { error: 'E-mail ou senha inválidos' };
    if (typeof window !== 'undefined') localStorage.setItem('mc_uid', user.id);
    return { user: { ...user, role: user.role || 'independente' } };
  },

  async logout() {
    if (isSupabaseEnabled) await SupabaseAuth.signOut();
    if (typeof window !== 'undefined') localStorage.removeItem('mc_uid');
  },

  async current() {
    if (typeof window === 'undefined') return null;
    if (isSupabaseEnabled) {
      try {
        const session = await SupabaseAuth.getSession();
        if (!session) return null;
        const u = session.user;
        const role = await SupabaseAuth.getProfileRole(u.id);
        return { id: u.id, nome: u.user_metadata?.nome || u.email, email: u.email, role, created_at: u.created_at };
      } catch { return null; }
    }
    const id = localStorage.getItem('mc_uid');
    if (!id) return null;
    const user = getStore().users.find((u) => u.id === id) || null;
    return user ? { ...user, role: user.role || 'independente' } : null;
  },

  async resetPassword(email) {
    if (isSupabaseEnabled) {
      const { error } = await SupabaseAuth.resetPassword(email);
      return { error: error?.message || null };
    }
    return { error: null };
  },

  /**
   * Atualiza o papel (role) do usuário — usado na tela de Perfil caso o
   * usuário deseje trocar de "Independente" para "Paciente"/"Cuidador" etc.
   */
  async updateRole(userId, role) {
    if (isSupabaseEnabled) {
      const { supabase } = await import('./supabase');
      if (!supabase) return false;
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      return !error;
    }
    const db = getStore();
    db.users = db.users.map((u) => (u.id === userId ? { ...u, role } : u));
    saveStore(db);
    return true;
  },
};

// ─── Medications ──────────────────────────────────────────────────────────────
export const MedDB = {
  async list(userId) {
    if (isSupabaseEnabled) return SupaMeds.list(userId);
    return getStore().meds.filter((m) => m.user_id === userId);
  },
  async add(med) {
    if (isSupabaseEnabled) return SupaMeds.add(med);
    const db = getStore();
    const row = { id: uid(), created_at: new Date().toISOString(), ...med };
    db.meds.push(row); saveStore(db); return row;
  },
  async update(id, data) {
    if (isSupabaseEnabled) return SupaMeds.update(id, data);
    const db = getStore();
    db.meds = db.meds.map((m) => (m.id === id ? { ...m, ...data } : m));
    saveStore(db);
  },
  async delete(id) {
    if (isSupabaseEnabled) return SupaMeds.delete(id);
    const db = getStore();
    db.meds = db.meds.filter((m) => m.id !== id);
    saveStore(db);
  },
};

// ─── History ──────────────────────────────────────────────────────────────────
export const HistDB = {
  async list(userId) {
    if (isSupabaseEnabled) return SupaHist.list(userId);
    return getStore().history
      .filter((h) => h.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  async add(row) {
    if (isSupabaseEnabled) return SupaHist.add(row);
    const db = getStore();
    db.history.push({ id: uid(), created_at: new Date().toISOString(), ...row });
    saveStore(db);
  },
};
