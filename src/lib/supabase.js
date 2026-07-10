import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isSupabaseEnabled = Boolean(supabase);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const SupabaseAuth = {
  // `role` define o papel RBAC do usuário: 'paciente' | 'cuidador' | 'independente'
  async signUp(email, password, nome, role = 'independente') {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { nome, role } },
    });
    if (!error && data.user) {
      // Upsert de segurança — o trigger handle_new_user já cria o perfil,
      // isto garante que o role escolhido na tela seja respeitado mesmo
      // se o trigger rodar antes deste ponto.
      await supabase.from('profiles').upsert({ id: data.user.id, nome, email, role });
    }
    return { data, error };
  },
  async signIn(email, password) {
    if (!supabase) return { error: 'Supabase não configurado' };
    return supabase.auth.signInWithPassword({ email, password });
  },
  async signOut() { if (supabase) await supabase.auth.signOut(); },
  async resetPassword(email) {
    if (!supabase) return { error: 'Supabase não configurado' };
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/reset-password`,
    });
  },
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  /**
   * Busca o papel (role) do perfil do usuário — usado para hidratar o
   * objeto `user` do contexto global com a informação de RBAC.
   */
  async getProfileRole(userId) {
    if (!supabase || !userId) return 'independente';
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      return data?.role || 'independente';
    } catch {
      return 'independente';
    }
  },
  onAuthStateChange(cb) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(cb);
  },
};

// ─── Medications ──────────────────────────────────────────────────────────────
export const SupaMeds = {
  async list(userId) {
    if (!supabase) return [];
    const { data } = await supabase.from('medicamentos').select('*')
      .eq('user_id', userId).order('created_at');
    return data || [];
  },
  async add(med) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('medicamentos').insert(med).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    if (!supabase) return;
    await supabase.from('medicamentos').update(updates).eq('id', id);
  },
  async delete(id) {
    if (!supabase) return;
    await supabase.from('medicamentos').delete().eq('id', id);
  },
  subscribe(userId, callback) {
    if (!supabase) return null;
    return supabase.channel('meds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicamentos', filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
  },
};

// ─── History ──────────────────────────────────────────────────────────────────
export const SupaHist = {
  async list(userId, limit = 50) {
    if (!supabase) return [];
    const { data } = await supabase.from('historico_doses').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  },
  async add(row) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('historico_doses').insert(row).select().single();
    if (error) throw error;
    return data;
  },
};

// ─── Caregivers ───────────────────────────────────────────────────────────────
export const SupaCaregivers = {
  async list(patientId) {
    if (!supabase) return [];
    const { data } = await supabase.from('cuidadores').select('*, profiles(*)')
      .eq('paciente_id', patientId);
    return data || [];
  },
  async invite(patientId, email) {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data: p } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (!p) return { error: 'Usuário não encontrado' };
    return supabase.from('cuidadores').insert({ paciente_id: patientId, cuidador_id: p.id, nivel_acesso: 'leitura', status: 'pendente' });
  },
  async getPatients(caregiverId) {
    if (!supabase) return [];
    const { data } = await supabase.from('cuidadores').select('*, profiles!paciente_id(*)')
      .eq('cuidador_id', caregiverId).eq('status', 'ativo');
    return data || [];
  },
};

// ─── FCM Tokens ───────────────────────────────────────────────────────────────
export const SupaFCM = {
  async saveToken(userId, token) {
    if (!supabase) return;
    await supabase.from('fcm_tokens').upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  },
};
