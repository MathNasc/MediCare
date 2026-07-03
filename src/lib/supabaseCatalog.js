// src/lib/supabaseCatalog.js
// Serviço para gerenciar medicamentos personalizados do usuário no Supabase.
// Medicamentos do catálogo global são somente leitura via RPC search_medications.

import { supabase } from './supabase';

// ─── Catálogo global (somente leitura via RPC) ─────────────────────────────────
export const CatalogDB = {
  /**
   * Pesquisa no catálogo global via Supabase fulltext.
   * Complementa a busca local do catalogSearch.js.
   */
  async search(query, limit = 20) {
    if (!supabase || !query?.trim()) return [];
    try {
      const { data, error } = await supabase
        .rpc('search_medications', { query: query.trim(), result_limit: limit });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[CatalogDB.search]', err?.message);
      return [];
    }
  },

  /**
   * Busca um medicamento específico pelo ID no catálogo.
   */
  async findById(id) {
    if (!supabase || !id) return null;
    try {
      const { data } = await supabase
        .from('medication_catalog')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  },
};

// ─── Medicamentos personalizados (por usuário) ─────────────────────────────────
export const CustomMedDB = {
  /**
   * Lista todos os medicamentos personalizados do usuário.
   */
  async list(userId) {
    if (!supabase || !userId) return [];
    try {
      const { data } = await supabase
        .from('custom_medications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return (data || []).map(d => ({ ...d, is_custom: true }));
    } catch {
      return [];
    }
  },

  /**
   * Salva um medicamento personalizado (cria ou atualiza).
   */
  async save(userId, payload) {
    if (!supabase || !userId) return null;
    try {
      const row = {
        user_id:             userId,
        commercial_name:     payload.commercial_name || payload.nome,
        active_ingredient:   payload.active_ingredient,
        dosage:              payload.dosage || payload.dosagem,
        pharmaceutical_form: payload.pharmaceutical_form,
        presentation:        payload.presentation,
        unit:                payload.unit || payload.unidade || 'comprimido',
        manufacturer:        payload.manufacturer,
        medicine_type:       payload.medicine_type || 'outro',
      };

      if (payload.id && !payload.id.startsWith('local-')) {
        // Atualizar
        const { data } = await supabase
          .from('custom_medications')
          .update(row)
          .eq('id', payload.id)
          .eq('user_id', userId)
          .select()
          .single();
        return data;
      } else {
        // Inserir
        const { data } = await supabase
          .from('custom_medications')
          .insert(row)
          .select()
          .single();
        return data;
      }
    } catch (err) {
      console.warn('[CustomMedDB.save]', err?.message);
      return null;
    }
  },

  /**
   * Remove um medicamento personalizado.
   */
  async delete(userId, id) {
    if (!supabase || !userId || !id) return;
    try {
      await supabase
        .from('custom_medications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[CustomMedDB.delete]', err?.message);
    }
  },

  /**
   * Pesquisa nos medicamentos personalizados do usuário.
   */
  async search(userId, query) {
    if (!supabase || !userId || !query?.trim()) return [];
    try {
      const { data } = await supabase
        .from('custom_medications')
        .select('*')
        .eq('user_id', userId)
        .or(
          `commercial_name.ilike.%${query}%,` +
          `active_ingredient.ilike.%${query}%,` +
          `manufacturer.ilike.%${query}%`
        )
        .limit(10);
      return (data || []).map(d => ({ ...d, is_custom: true }));
    } catch {
      return [];
    }
  },
};
