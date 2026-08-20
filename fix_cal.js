const fs = require('fs');
const content = `import { supabase } from './supabase';

// ─── Notes ────────────────────────────────────────────────────────────────────
export const NotesDB = {
  async list(userId, from, to) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. O banco de dados não está configurado.');
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    return data || [];
  },

  async add(note) {
    if (!supabase) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    const { data, error } = await supabase.from('notes').insert(note).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    await supabase.from('notes').update(payload).eq('id', id);
  },

  async delete(id) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    await supabase.from('notes').delete().eq('id', id);
  },
};

// ─── Health Events ────────────────────────────────────────────────────────────
export const EventsDB = {
  async list(userId, from, to) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. O banco de dados não está configurado.');
    const { data } = await supabase
      .from('health_events')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    return data || [];
  },

  async add(event) {
    if (!supabase) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    const { data, error } = await supabase.from('health_events').insert(event).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    await supabase.from('health_events').update(payload).eq('id', id);
  },

  async delete(id) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    await supabase.from('health_events').delete().eq('id', id);
  },
};

// ─── Dose Observations ────────────────────────────────────────────────────────
export const ObsDB = {
  async list(userId, from, to) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. O banco de dados não está configurado.');
    const { data } = await supabase
      .from('dose_observations')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);
    return data || [];
  },

  async add(obs) {
    if (!supabase) throw new Error('Seus dados não foram salvos na nuvem. Verifique sua conexão e tente novamente.');
    const { data, error } = await supabase.from('dose_observations').insert(obs).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    if (!supabase) throw new Error('Não foi possível sincronizar seus dados. Verifique sua conexão e tente novamente.');
    await supabase.from('dose_observations').delete().eq('id', id);
  },
};
`;
fs.writeFileSync('src/lib/supabaseCalendar.js', content);
