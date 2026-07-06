// src/lib/supabaseCaregiver.js
// Serviço completo para o sistema de cuidado compartilhado.
// Cobre: convites, relacionamentos, notas, dashboard do cuidador.

import { supabase } from './supabase';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://medicare-amber-five.vercel.app';

// ─── Permissões ───────────────────────────────────────────────────────────────
export const PERMISSION_LEVELS = {
  viewer:    { label: 'Apenas Visualização', icon: '👁',  color: '#8b949e', description: 'Visualiza medicamentos, histórico e adesão' },
  caregiver: { label: 'Cuidador',            icon: '🤝',  color: '#3b82f6', description: 'Confirma doses, adiciona observações e recebe alertas' },
  admin:     { label: 'Administrador',       icon: '⚙️', color: '#8b5cf6', description: 'Edita medicamentos, horários e gerencia cuidadores' },
};

export const STATUS_LABELS = {
  pending:  { label: 'Aguardando',  color: '#f59e0b' },
  active:   { label: 'Ativo',       color: '#22c55e' },
  declined: { label: 'Recusado',    color: '#ef4444' },
  revoked:  { label: 'Revogado',    color: '#6e7681' },
};

// ─── Relacionamentos ──────────────────────────────────────────────────────────
export const CaregiverDB = {
  /**
   * Lista todos os cuidadores do paciente.
   */
  async listMyCaregivers(patientId) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('caregiver_relationships')
      .select('*, caregiver:caregiver_id(id, nome, email)')
      .eq('patient_id', patientId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false });
    return data || [];
  },

  /**
   * Lista todos os pacientes que um cuidador acompanha.
   */
  async listMyPatients(caregiverId) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('caregiver_relationships')
      .select('*, patient:patient_id(id, nome, email)')
      .eq('caregiver_id', caregiverId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false });
    return data || [];
  },

  /**
   * Cria um convite para um novo cuidador.
   */
  async createInvite({ patientId, permissionLevel = 'viewer', inviteEmail = null, relationshipLabel = null }) {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data, error } = await supabase
      .from('caregiver_relationships')
      .insert({
        patient_id:         patientId,
        permission_level:   permissionLevel,
        invite_email:       inviteEmail,
        relationship_label: relationshipLabel,
        status:             'pending',
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return {
      relationship: data,
      inviteUrl: `${APP_URL}/convite/${data.invite_token}`,
    };
  },

  /**
   * Aceita um convite pelo token (via RPC segura do Supabase).
   */
  async acceptInvite(token) {
    if (!supabase) return { error: 'Supabase não configurado' };
    const { data, error } = await supabase
      .rpc('accept_caregiver_invite', { p_token: token });
    if (error) return { error: error.message };
    return data; // { success, relationship_id, patient_id } ou { success: false, error }
  },

  /**
   * Lê dados de um convite pelo token (antes de aceitar — tela de preview).
   */
  async getInviteByToken(token) {
    if (!supabase) return null;
    const { data } = await supabase
      .from('caregiver_relationships')
      .select('*, patient:patient_id(nome, email)')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .maybeSingle();
    return data;
  },

  /**
   * Revoga o acesso de um cuidador (somente paciente pode fazer isso).
   */
  async revoke(relationshipId) {
    if (!supabase) return false;
    const { data } = await supabase
      .rpc('revoke_caregiver', { p_relationship_id: relationshipId });
    return data === true;
  },

  /**
   * Recusa um convite (feito pelo cuidador).
   */
  async declineInvite(relationshipId) {
    if (!supabase) return false;
    const { error } = await supabase
      .from('caregiver_relationships')
      .update({ status: 'declined' })
      .eq('id', relationshipId)
      .eq('caregiver_id', supabase.auth.getUser()?.id);
    return !error;
  },

  /**
   * Altera o nível de permissão de um cuidador (somente paciente).
   */
  async updatePermission(relationshipId, permissionLevel, patientId) {
    if (!supabase) return false;
    const { error } = await supabase
      .from('caregiver_relationships')
      .update({ permission_level: permissionLevel })
      .eq('id', relationshipId)
      .eq('patient_id', patientId);
    return !error;
  },

  /**
   * Atualiza o label de relacionamento (ex: "Mãe", "Filho").
   */
  async updateLabel(relationshipId, label, patientId) {
    if (!supabase) return false;
    const { error } = await supabase
      .from('caregiver_relationships')
      .update({ relationship_label: label })
      .eq('id', relationshipId)
      .eq('patient_id', patientId);
    return !error;
  },

  /**
   * Regenera o token de convite (em caso de expiração).
   */
  async regenerateToken(relationshipId, patientId) {
    if (!supabase) return null;
    // Força trigger de geração de novo token usando update com campo dummy
    const { data } = await supabase
      .from('caregiver_relationships')
      .update({
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        caregiver_id: null,
      })
      .eq('id', relationshipId)
      .eq('patient_id', patientId)
      .select()
      .single();
    if (!data) return null;
    return `${APP_URL}/convite/${data.invite_token}`;
  },
};

// ─── Dashboard do cuidador (dados do paciente) ────────────────────────────────
export const CaregiverDashDB = {
  /**
   * Busca resumo do paciente via RPC segura.
   */
  async getPatientSummary(patientId) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .rpc('get_patient_summary', { p_patient_id: patientId });
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Busca medicamentos ativos do paciente (RLS garante acesso).
   */
  async getPatientMeds(patientId) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('medicamentos')
      .select('*')
      .eq('user_id', patientId)
      .eq('ativo', true)
      .order('nome');
    return data || [];
  },

  /**
   * Busca histórico recente do paciente.
   */
  async getPatientHistory(patientId, limit = 50) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('historico_doses')
      .select('*')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  },

  /**
   * Confirma uma dose remotamente (requer permissão 'caregiver' ou 'admin').
   */
  async confirmDoseRemotely({ patientId, medId, hora }) {
    if (!supabase) return false;
    const now = new Date();
    const [h, m] = hora.split(':').map(Number);
    const planned = new Date();
    planned.setHours(h, m, 0, 0);
    const delay = Math.max(0, Math.round((now - planned) / 60000));

    const { error } = await supabase
      .from('historico_doses')
      .insert({
        med_id:         medId,
        user_id:        patientId,
        hora,
        status:         'confirmed',
        atraso_minutos: delay,
      });
    return !error;
  },
};

// ─── Notas do cuidador ────────────────────────────────────────────────────────
export const CaregiverNotesDB = {
  async list(patientId, limit = 30) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('caregiver_notes')
      .select('*, caregiver:caregiver_id(nome)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  },

  async add({ relationshipId, patientId, caregiverId, title, description, metadata = {} }) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('caregiver_notes')
      .insert({ relationship_id: relationshipId, patient_id: patientId, caregiver_id: caregiverId, title, description, metadata })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id, caregiverId) {
    if (!supabase) return;
    await supabase
      .from('caregiver_notes')
      .delete()
      .eq('id', id)
      .eq('caregiver_id', caregiverId);
  },
};
