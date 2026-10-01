import { supabase, isSupabaseEnabled } from './supabase';

function getLocal(key, fallback = []) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key, val) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

export const ProfileDB = {
  async getProfile(userId) {
    if (!isSupabaseEnabled || !supabase) {
      const stored = getLocal('mc_local_profile_' + userId, null);
      if (stored) return stored;
      return {
        id: userId,
        nome: 'Usuário MediCare',
        email: 'usuario@medicare.local',
        tipo_sanguineo: 'O+',
        role: 'independente',
        emergency_settings: { onboarding_completed: true },
      };
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
  async updateProfile(userId, payload) {
    if (!isSupabaseEnabled || !supabase) {
      const current = await this.getProfile(userId);
      const updated = { ...current, ...payload };
      setLocal('mc_local_profile_' + userId, updated);
      return true;
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) console.error('updateProfile error:', error);
    return !error;
  },
  async uploadAvatar(userId, file) {
    if (!isSupabaseEnabled || !supabase) {
      return URL.createObjectURL(file);
    }
    const ext = file.name.split('.').pop();
    const filePath = `${userId}/avatar-${Date.now()}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('uploadAvatar error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl;
  },
  async listAllergies(userId) {
    if (!isSupabaseEnabled || !supabase) return getLocal('mc_local_allergies_' + userId, []);
    const { data } = await supabase.from('allergies').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addAllergy(userId, name) {
    if (!isSupabaseEnabled || !supabase) {
      const list = getLocal('mc_local_allergies_' + userId, []);
      const item = { id: 'allergy-' + Date.now(), user_id: userId, name, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_allergies_' + userId, list);
      return item;
    }
    const { data, error } = await supabase.from('allergies').insert({ user_id: userId, name }).select().single();
    if (error) console.error('addAllergy error:', error);
    return data;
  },
  async deleteAllergy(id) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_allergies_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await supabase.from('allergies').delete().eq('id', id);
  },
  async listConditions(userId) {
    if (!isSupabaseEnabled || !supabase) return getLocal('mc_local_conditions_' + userId, []);
    const { data } = await supabase.from('health_conditions').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addCondition(userId, payload) {
    if (!isSupabaseEnabled || !supabase) {
      const list = getLocal('mc_local_conditions_' + userId, []);
      const item = { id: 'cond-' + Date.now(), ...payload, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_conditions_' + userId, list);
      return item;
    }
    const { data, error } = await supabase.from('health_conditions').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addCondition error:', error);
    return data;
  },
  async deleteCondition(id) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_conditions_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await supabase.from('health_conditions').delete().eq('id', id);
  },
  async listEmergencyContacts(userId) {
    if (!isSupabaseEnabled || !supabase) return getLocal('mc_local_emergency_contacts_' + userId, []);
    const { data } = await supabase.from('emergency_contacts').select('*').eq('user_id', userId).order('priority');
    return data || [];
  },
  async addEmergencyContact(userId, payload) {
    if (!isSupabaseEnabled || !supabase) {
      const list = getLocal('mc_local_emergency_contacts_' + userId, []);
      const item = { id: 'emg-' + Date.now(), ...payload, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_emergency_contacts_' + userId, list);
      return item;
    }
    const { data, error } = await supabase.from('emergency_contacts').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addEmergencyContact error:', error);
    return data;
  },
  async updateEmergencyContact(id, payload) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_emergency_contacts_')) {
            const list = getLocal(k, []).map(item => item.id === id ? { ...item, ...payload } : item);
            setLocal(k, list);
          }
        }
      }
      return true;
    }
    const { error } = await supabase.from('emergency_contacts').update(payload).eq('id', id);
    return !error;
  },
  async deleteEmergencyContact(id) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_emergency_contacts_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await supabase.from('emergency_contacts').delete().eq('id', id);
  },
  async listProfessionals(userId) {
    if (!isSupabaseEnabled || !supabase) return getLocal('mc_local_professionals_' + userId, []);
    const { data } = await supabase.from('healthcare_professionals').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addProfessional(userId, payload) {
    if (!isSupabaseEnabled || !supabase) {
      const list = getLocal('mc_local_professionals_' + userId, []);
      const item = { id: 'prof-' + Date.now(), ...payload, user_id: userId, created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_professionals_' + userId, list);
      return item;
    }
    const { data, error } = await supabase.from('healthcare_professionals').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addProfessional error:', error);
    return data;
  },
  async updateProfessional(id, payload) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_professionals_')) {
            const list = getLocal(k, []).map(item => item.id === id ? { ...item, ...payload } : item);
            setLocal(k, list);
          }
        }
      }
      return true;
    }
    const { error } = await supabase.from('healthcare_professionals').update(payload).eq('id', id);
    return !error;
  },
  async deleteProfessional(id) {
    if (!isSupabaseEnabled || !supabase) {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mc_local_professionals_')) {
            const list = getLocal(k, []).filter(item => item.id !== id);
            setLocal(k, list);
          }
        }
      }
      return;
    }
    await supabase.from('healthcare_professionals').delete().eq('id', id);
  }
};
