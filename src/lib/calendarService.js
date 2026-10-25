/**
 * calendarService.js
 *
 * Serviços de gerenciamento de calendário: Anotações (Notes), Eventos de Saúde (Events)
 * e Observações de Dose (Obs). Suporta persistência remota e fallback local.
 */

import { databaseClient } from './databaseClient';

function getLocal(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocal(key, val) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

// ─── Notes ────────────────────────────────────────────────────────────────────
export const NotesDB = {
  async list(userId, from, to) {
    if (!databaseClient) {
      const list = getLocal('mc_local_notes');
      return list.filter(n => (!from || n.date >= from) && (!to || n.date <= to));
    }
    const { data } = await databaseClient
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    return data || [];
  },

  async add(note) {
    if (!databaseClient) {
      const list = getLocal('mc_local_notes');
      const item = { ...note, id: 'note-' + Date.now(), created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_notes', list);
      return item;
    }
    const { data, error } = await databaseClient.from('notes').insert(note).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    if (!databaseClient) {
      const list = getLocal('mc_local_notes').map(n => n.id === id ? { ...n, ...payload } : n);
      setLocal('mc_local_notes', list);
      return;
    }
    await databaseClient.from('notes').update(payload).eq('id', id);
  },

  async delete(id) {
    if (!databaseClient) {
      const list = getLocal('mc_local_notes').filter(n => n.id !== id);
      setLocal('mc_local_notes', list);
      return;
    }
    await databaseClient.from('notes').delete().eq('id', id);
  },
};

// ─── Health Events ────────────────────────────────────────────────────────────
export const EventsDB = {
  async list(userId, from, to) {
    if (!databaseClient) {
      const list = getLocal('mc_local_events');
      return list.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
    }
    const { data } = await databaseClient
      .from('health_events')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    return data || [];
  },

  async add(event) {
    if (!databaseClient) {
      const list = getLocal('mc_local_events');
      const item = { ...event, id: 'ev-' + Date.now(), created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_events', list);
      return item;
    }
    const { data, error } = await databaseClient.from('health_events').insert(event).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    if (!databaseClient) {
      const list = getLocal('mc_local_events').map(e => e.id === id ? { ...e, ...payload } : e);
      setLocal('mc_local_events', list);
      return;
    }
    await databaseClient.from('health_events').update(payload).eq('id', id);
  },

  async delete(id) {
    if (!databaseClient) {
      const list = getLocal('mc_local_events').filter(e => e.id !== id);
      setLocal('mc_local_events', list);
      return;
    }
    await databaseClient.from('health_events').delete().eq('id', id);
  },
};

// ─── Dose Observations ────────────────────────────────────────────────────────
export const ObsDB = {
  async list(userId, from, to) {
    if (!databaseClient) {
      const list = getLocal('mc_local_obs');
      return list.filter(o => (!from || o.date >= from) && (!to || o.date <= to));
    }
    const { data } = await databaseClient
      .from('dose_observations')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);
    return data || [];
  },

  async add(obs) {
    if (!databaseClient) {
      const list = getLocal('mc_local_obs');
      const item = { ...obs, id: 'obs-' + Date.now(), created_at: new Date().toISOString() };
      list.push(item);
      setLocal('mc_local_obs', list);
      return item;
    }
    const { data, error } = await databaseClient.from('dose_observations').insert(obs).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    if (!databaseClient) {
      const list = getLocal('mc_local_obs').filter(o => o.id !== id);
      setLocal('mc_local_obs', list);
      return;
    }
    await databaseClient.from('dose_observations').delete().eq('id', id);
  },
};

export const calendarService = {
  Notes: NotesDB,
  Events: EventsDB,
  Observations: ObsDB,
};
