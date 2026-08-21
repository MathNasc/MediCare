import { supabase, isSupabaseEnabled } from './supabase';

export const ProfileDB = {
  async getProfile(userId) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
  async updateProfile(userId, payload) {
    if (!isSupabaseEnabled || !supabase) return false;
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) console.error('updateProfile error:', error);
    return !error;
  },
  async uploadAvatar(userId, file) {
    if (!isSupabaseEnabled || !supabase) return null;
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
    if (!isSupabaseEnabled || !supabase) return [];
    const { data } = await supabase.from('allergies').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addAllergy(userId, name) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { data, error } = await supabase.from('allergies').insert({ user_id: userId, name }).select().single();
    if (error) console.error('addAllergy error:', error);
    return data;
  },
  async deleteAllergy(id) {
    if (!isSupabaseEnabled || !supabase) return;
    await supabase.from('allergies').delete().eq('id', id);
  },
  async listConditions(userId) {
    if (!isSupabaseEnabled || !supabase) return [];
    const { data } = await supabase.from('health_conditions').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addCondition(userId, payload) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { data, error } = await supabase.from('health_conditions').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addCondition error:', error);
    return data;
  },
  async deleteCondition(id) {
    if (!isSupabaseEnabled || !supabase) return;
    await supabase.from('health_conditions').delete().eq('id', id);
  },
  async listEmergencyContacts(userId) {
    if (!isSupabaseEnabled || !supabase) return [];
    const { data } = await supabase.from('emergency_contacts').select('*').eq('user_id', userId).order('priority');
    return data || [];
  },
  async addEmergencyContact(userId, payload) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { data, error } = await supabase.from('emergency_contacts').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addEmergencyContact error:', error);
    return data;
  },
  async updateEmergencyContact(id, payload) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { error } = await supabase.from('emergency_contacts').update(payload).eq('id', id);
    return !error;
  },
  async deleteEmergencyContact(id) {
    if (!isSupabaseEnabled || !supabase) return;
    await supabase.from('emergency_contacts').delete().eq('id', id);
  },
  async listProfessionals(userId) {
    if (!isSupabaseEnabled || !supabase) return [];
    const { data } = await supabase.from('healthcare_professionals').select('*').eq('user_id', userId).order('created_at');
    return data || [];
  },
  async addProfessional(userId, payload) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { data, error } = await supabase.from('healthcare_professionals').insert({ ...payload, user_id: userId }).select().single();
    if (error) console.error('addProfessional error:', error);
    return data;
  },
  async updateProfessional(id, payload) {
    if (!isSupabaseEnabled || !supabase) return null;
    const { error } = await supabase.from('healthcare_professionals').update(payload).eq('id', id);
    return !error;
  },
  async deleteProfessional(id) {
    if (!isSupabaseEnabled || !supabase) return;
    await supabase.from('healthcare_professionals').delete().eq('id', id);
  }
};
