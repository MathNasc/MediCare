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
      const movement = {
        id: 'sm-' + Math.random().toString(36).slice(2, 9),
        medication_id: medicationId,
        movement_type: movementType,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        quantity_delta: quantityAfter - quantityBefore,
        purchase_price: purchasePrice,
        purchase_location: purchaseLocation,
        batch,
        expiration_date: expirationDate,
        notes,
        created_at: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        const list = JSON.parse(localStorage.getItem('mc_local_stock_movements') || '[]');
        list.unshift(movement);
        localStorage.setItem('mc_local_stock_movements', JSON.stringify(list));
      }
      return { success: true, movement };
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
    if (!supabase) {
      if (typeof window === 'undefined') return [];
      const list = JSON.parse(localStorage.getItem('mc_local_stock_movements') || '[]');
      const filtered = medId ? list.filter(m => m.medication_id === medId) : list;
      return filtered.slice(0, limit);
    }
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
    if (!supabase) {
      const all = await this.getAllForecasts();
      return all.find(f => f.med_id === medId) || null;
    }
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
    if (!supabase) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('mc_local_meds') : null;
        const meds = raw ? JSON.parse(raw) : [];
        return meds.map(m => {
          const dailyDoses = (m.horarios || []).length || 1;
          const daysLeft = Math.floor((m.quantidade || 0) / dailyDoses);
          const depletionDate = new Date();
          depletionDate.setDate(depletionDate.getDate() + daysLeft);
          return {
            med_id: m.id,
            nome: m.nome,
            dosagem: m.dosagem,
            quantidade: m.quantidade,
            doses_per_day: dailyDoses,
            days_remaining: daysLeft,
            depletion_date: depletionDate.toISOString().split('T')[0]
          };
        }).sort((a, b) => a.days_remaining - b.days_remaining);
      } catch {
        return [];
      }
    }
    try {
      const { data, error } = await supabase.rpc('get_all_stock_forecasts');
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },
};
