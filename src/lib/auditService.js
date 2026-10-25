/**
 * auditService.js
 *
 * Serviço de correção retroativa e consulta de auditoria clínica.
 * Utiliza procedures de banco com controle transacional e verificação de permissões.
 */

import { databaseClient } from './databaseClient';

export const AuditDB = {
  /**
   * Confirma ou corrige uma dose em uma data passada.
   * - Paciente: funciona dentro da janela permitida pela regra de negócio.
   * - Cuidador: motivo é obrigatório (validado no banco).
   * - Independente: sem restrição de tempo.
   *
   * @returns {Promise<{success:boolean, id?:string, action?:string, error?:string}>}
   */
  async confirmRetroactive({ patientId, medId, hora, doseDate, newStatus = 'confirmed', reason = null }) {
    if (!databaseClient) return { success: false, error: 'Banco de dados remoto não configurado' };
    try {
      const { data, error } = await databaseClient.rpc('confirm_dose_retroactive', {
        p_patient_id: patientId,
        p_med_id:     medId,
        p_hora:       hora,
        p_dose_date:  doseDate, // formato 'YYYY-MM-DD'
        p_new_status: newStatus,
        p_reason:     reason,
      });
      if (error) return { success: false, error: error.message };
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Lista o log de auditoria de um paciente (visível para o próprio paciente,
   * para quem realizou a alteração, ou para cuidadores ativos vinculados).
   */
  async listLogs(patientId, limit = 50) {
    if (!databaseClient) return [];
    try {
      const { data, error } = await databaseClient.rpc('list_audit_logs', {
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
   * Busca informações de correção para um conjunto de registros de histórico.
   */
  async getCorrections(historicoIds = []) {
    if (!databaseClient || !historicoIds.length) return {};
    try {
      const { data } = await databaseClient
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

export const auditService = AuditDB;
