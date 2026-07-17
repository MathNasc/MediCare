// src/lib/supabaseStock.js
// Serviço de movimentações de estoque. Todo registro passa pela função
// security definer `record_stock_movement`, que garante atomicidade entre
// a movimentação e o evento de calendário correspondente (quando a
// quantidade aumenta). Nada aqui apaga histórico — apenas insere.

import { supabase } from './supabase';

export const MOVEMENT_TYPES = {
  purchase:   { label: 'Compra',        icon: '🛒', color: '#22c55e' },
  adjustment: { label: 'Ajuste Manual', icon: '📉', color: '#f59e0b' },
  correction: { label: 'Correção',      icon: '✏️', color: '#3b82f6' },
  return:     { label: 'Devolução',     icon: '↩️', color: '#8b949e' },
};

export function getMovementMeta(type) {
  return MOVEMENT_TYPES[type] || MOVEMENT_TYPES.adjustment;
}

export const StockDB = {
  /**
   * Registra uma movimentação de estoque. Cria automaticamente um evento
   * de calendário quando a quantidade aumenta (reposição/correção positiva).
   */
  async recordMovement({
    medicationId, movementType, quantityBefore, quantityAfter,
    purchasePrice = null, purchaseLocation = null, batch = null,
    expirationDate = null, notes = null,
  }) {
    if (!supabase) {
      console.warn('[StockDB.recordMovement] Supabase não configurado — nada foi gravado.');
      return { success: false, error: 'Supabase não configurado' };
    }
    try {
      const { data, error } = await supabase.rpc('record_stock_movement', {
        p_medication_id: medicationId,
        p_movement_type: movementType,
        p_quantity_before: quantityBefore,
        p_quantity_after: quantityAfter,
        p_purchase_price: purchasePrice,
        p_purchase_location: purchaseLocation,
        p_batch: batch,
        p_expiration_date: expirationDate,
        p_notes: notes,
      });
      // ─── Diagnóstico temporário ───────────────────────────────────────────
      // Remova este console.log assim que confirmar que o fluxo está
      // funcionando corretamente em produção. Ele mostra exatamente o que
      // a RPC retornou (ou o erro do PostgREST, se houver).
      console.log('[StockDB.recordMovement] params ->', {
        medicationId, movementType, quantityBefore, quantityAfter,
      });
      console.log('[StockDB.recordMovement] rpc result ->', { data, error });
      // ────────────────────────────────────────────────────────────────────
      if (error) return { success: false, error: error.message };
      return data;
    } catch (err) {
      console.error('[StockDB.recordMovement] exceção inesperada:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Lista movimentações — de um medicamento específico ou de todos.
   */
  async list(medId = null, limit = 50) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('list_stock_movements', {
        p_med_id: medId,
        p_limit: limit,
      });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Previsão de término de estoque para um medicamento específico.
   */
  async getForecast(medId) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_stock_forecast', { p_med_id: medId });
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Previsão de término de estoque para todos os medicamentos ativos
   * (não-SOS), ordenado do que vai acabar primeiro. Usado no card do
   * dashboard "Próxima reposição prevista".
   */
  async getAllForecasts() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('get_all_stock_forecasts');
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },
};
