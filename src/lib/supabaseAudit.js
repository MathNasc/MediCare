// src/lib/supabaseAudit.js
// Serviço de correção retroativa e consulta de auditoria.
// Todo caminho de escrita passa pela função security definer
// `confirm_dose_retroactive` no Supabase — nunca escreve direto na tabela.

import { supabase } from './supabase';

export const AuditDB = {
  /**
   * Confirma ou corrige uma dose em uma data passada.
   * - Paciente: só funciona dentro de 24h da dose original (validado no banco).
   * - Cuidador: motivo é obrigatório (validado no banco).
   * - Independente: sem restrição de tempo.
   *
   * @returns {Promise<{success:boolean, id?:string, action?:string, error?:string}>}
   */
  async confirmRetroactive({ patientId, medId, hora, doseDate, newStatus = 'confirmed', reason = null }) {
    if (!supabase) return { success: false, error: 'Supabase não configurado' };
    try {
      const { data, error } = await supabase.rpc('confirm_dose_retroactive', {
        p_patient_id: patientId,
        p_med_id:     medId,
        p_hora:       hora,
        p_dose_date:  doseDate, // formato 'YYYY-MM-DD'
        p_new_status: newStatus,
        p_reason:     reason,
      });
      if (error) return { success: false, error: error.message };
      return data; // já vem no formato { success, id, action } ou { success:false, error }
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Lista o log de auditoria de um paciente (visível para o próprio paciente,
   * para quem realizou a alteração, ou para cuidadores ativos vinculados).
   */
  async listLogs(patientId, limit = 50) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('list_audit_logs', {
        p_patient_id: patientId,
        p_limit: limit,
      });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Busca informações de correção (quem corrigiu, quando) para um conjunto
   * de registros de histórico — usado para exibir o badge "Corrigido pelo cuidador".
   */
  async getCorrections(historicoIds = []) {
    if (!supabase || !historicoIds.length) return {};
    try {
      const { data } = await supabase
        .from('dose_corrections')
        .select('*')
        .in('historico_id', historicoIds);
      const map = {};
      (data || []).forEach(row => { map[row.historico_id] = row; });
      return map;
    } catch {
      return {};
    }
  },
};
