import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isSupabaseEnabled = Boolean(supabase);

// ─── Alerta de configuração ───────────────────────────────────────────────────

// ninguém perceber — dados de usuários e medicamentos ficam presos no
// navegador de cada pessoa, sem sincronizar nem persistir de verdade.
// Causa mais comum: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// foram salvas na Vercel, mas nenhum novo deploy foi gerado depois disso
// (essas variáveis são embutidas no build, não lidas em tempo real).
if (typeof window !== 'undefined' && !isSupabaseEnabled) {
  console.error(
    '[MediCare] ⚠ Supabase NÃO configurado neste build. ' +
    'O aplicativo não funcionará corretamente sem o banco de dados. ' +
    'Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ' +
    'ambiente de deploy e gere um novo deploy.'
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const SupabaseAuth = {
  async signUp(email, password, nome) {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { nome } },
    });
    if (!error && data.user && data.session) {
      await supabase.from('profiles').upsert({ id: data.user.id, nome, email });
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
  async getProfileRole(userId) {
    if (!supabase) return 'independente';
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (error) {
        console.error('getProfileRole error:', error);
        return 'independente';
      }
      return data?.role || 'independente';
    } catch { return 'independente'; }
  },
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
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
  async list(userId, limit = 500) {
    if (!supabase) return [];
    const { data } = await supabase.from('historico_doses').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  },
  async add(row) {
    if (!supabase) return null;
    // IDEMPOTENCY GUARD
    if (row.hora && row.med_id && row.created_at) {
       const d = new Date(row.created_at);
       const start = new Date(d); start.setHours(0,0,0,0);
       const end = new Date(d); end.setHours(23,59,59,999);
       const { data: existing } = await supabase.from('historico_doses')
         .select('*')
         .eq('user_id', row.user_id)
         .eq('med_id', row.med_id)
         .eq('hora', row.hora)
         .gte('created_at', start.toISOString())
         .lte('created_at', end.toISOString())
         .limit(1);
       if (existing && existing.length > 0) {
         if (existing[0].status === 'confirmed') return existing[0];
         const { data, error } = await supabase.from('historico_doses').update(row).eq('id', existing[0].id).select().single();
         if (error) throw error;
         return data;
       }
    }
    const { data, error } = await supabase.from('historico_doses').insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    if (!supabase) return false;
    // Delete is blocked by RLS in this system (audit trail), so we update status to pending
    const { error } = await supabase.from('historico_doses').update({ status: 'pending' }).eq('id', id);
    if (error) throw error;
    return true;
  }
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

// ─── Push Subscriptions (Web Push / VAPID) ────────────────────────────────────


// (endpoint + chaves de criptografia), uma por dispositivo — o `endpoint` é
// único, então um mesmo usuário pode ter várias linhas (celular + tablet etc).
export const SupaPush = {
  async saveSubscription(userId, subscription) {
    if (!supabase || !subscription?.endpoint) return;
    const { endpoint, keys } = subscription;
    const { error } = await supabase.from('push_subscriptions').upsert(
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
    if (!supabase || !endpoint) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  },
  async list(userId) {
    if (!supabase) return [];
    const { data } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
    return data || [];
  },
};
