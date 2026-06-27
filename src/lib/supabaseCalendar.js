import { supabase } from './supabase';

// ─── Notes ────────────────────────────────────────────────────────────────────
export const NotesDB = {
  async list(userId, from, to) {
    if (!supabase) return localNotes.list(userId, from, to);
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
    if (!supabase) return localNotes.add(note);
    const { data, error } = await supabase.from('notes').insert(note).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    if (!supabase) return localNotes.update(id, payload);
    await supabase.from('notes').update(payload).eq('id', id);
  },
  async delete(id) {
    if (!supabase) return localNotes.delete(id);
    await supabase.from('notes').delete().eq('id', id);
  },
};

// ─── Health Events ────────────────────────────────────────────────────────────
export const EventsDB = {
  async list(userId, from, to) {
    if (!supabase) return localEvents.list(userId, from, to);
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
    if (!supabase) return localEvents.add(event);
    const { data, error } = await supabase.from('health_events').insert(event).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    if (!supabase) return localEvents.update(id, payload);
    await supabase.from('health_events').update(payload).eq('id', id);
  },
  async delete(id) {
    if (!supabase) return localEvents.delete(id);
    await supabase.from('health_events').delete().eq('id', id);
  },
};

// ─── Dose Observations ────────────────────────────────────────────────────────
export const ObsDB = {
  async list(userId, from, to) {
    if (!supabase) return localObs.list(userId, from, to);
    const { data } = await supabase
      .from('dose_observations')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);
    return data || [];
  },
  async add(obs) {
    if (!supabase) return localObs.add(obs);
    const { data, error } = await supabase.from('dose_observations').insert(obs).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    if (!supabase) return localObs.delete(id);
    await supabase.from('dose_observations').delete().eq('id', id);
  },
};

// ─── localStorage fallbacks ───────────────────────────────────────────────────
function uid() {
  return crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now();
}

function getLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const localNotes = {
  list: (userId, from, to) => getLS('mc_notes').filter(n => n.user_id === userId && n.date >= from && n.date <= to),
  add: (note) => { const row = { ...note, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; setLS('mc_notes', [...getLS('mc_notes'), row]); return row; },
  update: (id, payload) => setLS('mc_notes', getLS('mc_notes').map(n => n.id === id ? { ...n, ...payload } : n)),
  delete: (id) => setLS('mc_notes', getLS('mc_notes').filter(n => n.id !== id)),
};

const localEvents = {
  list: (userId, from, to) => getLS('mc_events').filter(e => e.user_id === userId && e.date >= from && e.date <= to),
  add: (event) => { const row = { ...event, id: uid(), created_at: new Date().toISOString() }; setLS('mc_events', [...getLS('mc_events'), row]); return row; },
  update: (id, payload) => setLS('mc_events', getLS('mc_events').map(e => e.id === id ? { ...e, ...payload } : e)),
  delete: (id) => setLS('mc_events', getLS('mc_events').filter(e => e.id !== id)),
};

const localObs = {
  list: (userId, from, to) => getLS('mc_obs').filter(o => o.user_id === userId && o.date >= from && o.date <= to),
  add: (obs) => { const row = { ...obs, id: uid(), created_at: new Date().toISOString() }; setLS('mc_obs', [...getLS('mc_obs'), row]); return row; },
  delete: (id) => setLS('mc_obs', getLS('mc_obs').filter(o => o.id !== id)),
};
