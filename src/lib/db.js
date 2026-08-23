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

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const AuthDB = {
  async register(nome, email, pass, role = 'independente') {
    if (!isSupabaseEnabled) return { error: 'O banco de dados não está configurado. Tente novamente mais tarde.' };
    const { data, error } = await SupabaseAuth.signUp(email, pass, nome, role);
    if (error) return { error: translateAuthError(error) };
    
    if (!data?.session) {
      if (data?.user?.identities && data.user.identities.length === 0) {
        return { error: 'Este e-mail já está cadastrado. Faça login.' };
      }
      return { error: 'Conta criada. Verifique seu e-mail para confirmar sua conta.' };
    }
    
    return { user: { id: data.user.id, nome, email, role, created_at: data.user.created_at } };
  },

  async login(email, pass) {
    if (!isSupabaseEnabled) return { error: 'O banco de dados não está configurado. Tente novamente mais tarde.' };
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
    if (!isSupabaseEnabled) return null;
    try {
      const session = await SupabaseAuth.getSession();
      if (!session) return null;
      const u = session.user;
      const role = await SupabaseAuth.getProfileRole(u.id);
      return { id: u.id, nome: u.user_metadata?.nome || u.email, email: u.email, role, created_at: u.created_at };
    } catch { return null; }
  },

  async resetPassword(email) {
    if (!isSupabaseEnabled) return { error: 'O banco de dados não está configurado. Tente novamente mais tarde.' };
    const { error } = await SupabaseAuth.resetPassword(email);
    return { error: error?.message || null };
  },

  async updateRole(userId, role) {
    if (!isSupabaseEnabled) return false;
    const { supabase } = await import('./supabase');
    if (!supabase) return false;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    return !error;
  },
};

// ─── Medications ──────────────────────────────────────────────────────────────
export const MedDB = {
  async list(userId) {
    if (!isSupabaseEnabled) throw new Error('Não foi possível sincronizar seus dados. O banco de dados não está configurado.');
    return SupaMeds.list(userId);
  },

  async add(med) {
    if (!isSupabaseEnabled) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    return SupaMeds.add(med);
  },

  async update(id, data) {
    if (!isSupabaseEnabled) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    return SupaMeds.update(id, data);
  },

  async delete(id) {
    if (!isSupabaseEnabled) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    return SupaMeds.delete(id);
  },
};

// ─── History ──────────────────────────────────────────────────────────────────
export const HistDB = {
  async list(userId) {
    if (!isSupabaseEnabled) throw new Error('Não foi possível sincronizar seus dados. O banco de dados não está configurado.');
    return SupaHist.list(userId);
  },

  async add(row) {
    if (!isSupabaseEnabled) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    return SupaHist.add(row);
  },

  async delete(id) {
    if (!isSupabaseEnabled) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    return SupaHist.delete(id);
  }
};
