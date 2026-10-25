/**
 * databaseClient.js
 *
 * Camada de abstração e cliente de banco de dados e autenticação.
 * A implementação atual utiliza @supabase/supabase-js como driver de acesso ao PostgreSQL e Auth.
 */

import { createClient } from '@supabase/supabase-js';

const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const databaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const databaseClient = databaseUrl && databaseAnonKey
  ? createClient(databaseUrl, databaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

// Alias para compatibilidade técnica com módulos internos
export const supabase = databaseClient;

export const isDatabaseConfigured = Boolean(databaseClient);
export const isSupabaseEnabled = isDatabaseConfigured;

if (typeof window !== 'undefined' && !isDatabaseConfigured) {
  console.info('[MediCare] Modo de armazenamento local ativo.');
}

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {
  async signUp(email, password, nome) {
    if (!databaseClient) return { error: 'Serviço de autenticação remota não configurado' };
    const { data, error } = await databaseClient.auth.signUp({
      email, password, options: { data: { nome } },
    });
    if (!error && data.user && data.session) {
      await databaseClient.from('profiles').upsert({ id: data.user.id, nome, email });
    }
    return { data, error };
  },
  async signIn(email, password) {
    if (!databaseClient) return { error: 'Serviço de autenticação remota não configurado' };
    return databaseClient.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    if (databaseClient) await databaseClient.auth.signOut();
  },
  async resetPassword(email) {
    if (!databaseClient) return { error: 'Serviço de autenticação remota não configurado' };
    return databaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/reset-password`,
    });
  },
  async getProfileRole(userId) {
    if (!databaseClient) return 'independente';
    try {
      const { data, error } = await databaseClient.from('profiles').select('role').eq('id', userId).single();
      if (error) {
        console.error('getProfileRole error:', error);
        return 'independente';
      }
      return data?.role || 'independente';
    } catch {
      return 'independente';
    }
  },
  async getSession() {
    if (!databaseClient) return null;
    const { data } = await databaseClient.auth.getSession();
    return data.session;
  },
  onAuthStateChange(cb) {
    if (!databaseClient) return { data: { subscription: { unsubscribe: () => {} } } };
    return databaseClient.auth.onAuthStateChange(cb);
  },
};

export const SupabaseAuth = authService;

// ─── Medication Service ───────────────────────────────────────────────────────
export const medicationService = {
  async list(userId) {
    if (!databaseClient) return [];
    const { data } = await databaseClient.from('medicamentos').select('*')
      .eq('user_id', userId).order('created_at');
    return data || [];
  },
  async add(med) {
    if (!databaseClient) return null;
    const { data, error } = await databaseClient.from('medicamentos').insert(med).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    if (!databaseClient) return;
    await databaseClient.from('medicamentos').update(updates).eq('id', id);
  },
  async delete(id) {
    if (!databaseClient) return;
    await databaseClient.from('medicamentos').delete().eq('id', id);
  },
  subscribe(userId, callback) {
    if (!databaseClient) return null;
    return databaseClient.channel('meds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicamentos', filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
  },
};

export const SupaMeds = medicationService;

// ─── History Service ──────────────────────────────────────────────────────────
export const historyService = {
  async list(userId, limit = 500) {
    if (!databaseClient) return [];
    const { data } = await databaseClient.from('historico_doses').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  },
  async add(row) {
    if (!databaseClient) return null;
    // Idempotency guard
    if (row.hora && row.med_id && row.created_at) {
      const d = new Date(row.created_at);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const { data: existing } = await databaseClient.from('historico_doses')
        .select('*')
        .eq('user_id', row.user_id)
        .eq('med_id', row.med_id)
        .eq('hora', row.hora)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .limit(1);
      if (existing && existing.length > 0) {
        if (existing[0].status === 'confirmed') return existing[0];
        const { data, error } = await databaseClient.from('historico_doses').update(row).eq('id', existing[0].id).select().single();
        if (error) throw error;
        return data;
      }
    }
    const { data, error } = await databaseClient.from('historico_doses').insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    if (!databaseClient) return false;
    const { error } = await databaseClient.from('historico_doses').update({ status: 'pending' }).eq('id', id);
    if (error) throw error;
    return true;
  }
};

export const SupaHist = historyService;

// ─── Caregivers Legacy Service ────────────────────────────────────────────────
export const caregiverRelationshipService = {
  async list(patientId) {
    if (!databaseClient) return [];
    const { data } = await databaseClient.from('cuidadores').select('*, profiles(*)')
      .eq('paciente_id', patientId);
    return data || [];
  },
  async invite(patientId, email) {
    if (!databaseClient) return { error: 'Serviço de banco remoto não configurado' };
    const { data: p } = await databaseClient.from('profiles').select('id').eq('email', email).single();
    if (!p) return { error: 'Usuário não encontrado' };
    return databaseClient.from('cuidadores').insert({ paciente_id: patientId, cuidador_id: p.id, nivel_acesso: 'leitura', status: 'pendente' });
  },
  async getPatients(caregiverId) {
    if (!databaseClient) return [];
    const { data } = await databaseClient.from('cuidadores').select('*, profiles!paciente_id(*)')
      .eq('cuidador_id', caregiverId).eq('status', 'ativo');
    return data || [];
  },
};

export const SupaCaregivers = caregiverRelationshipService;

// ─── Push Subscriptions Service ───────────────────────────────────────────────
export const pushSubscriptionService = {
  async saveSubscription(userId, subscription) {
    if (!databaseClient || !subscription?.endpoint) return;
    const { endpoint, keys } = subscription;
    const { error } = await databaseClient.from('push_subscriptions').upsert(
      {
        user_id:    userId,
        endpoint,
        p256dh:     keys?.p256dh,
        auth:       keys?.auth,
        timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
  },
  async removeSubscription(endpoint) {
    if (!databaseClient || !endpoint) return;
    await databaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
  },
  async list(userId) {
    if (!databaseClient) return [];
    const { data } = await databaseClient.from('push_subscriptions').select('*').eq('user_id', userId);
    return data || [];
  },
};

export const SupaPush = pushSubscriptionService;
