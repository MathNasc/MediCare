/**
 * caregiverService.js
 *
 * Serviço de gerenciamento do sistema de cuidado compartilhado:
 * Convites, vínculos de supervisão, notas de cuidadores e dashboard do paciente.
 */

import { databaseClient } from './databaseClient';

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
    if (!databaseClient) return [];
    
    const { data: rels, error } = await databaseClient
      .from('caregiver_relationships')
      .select('*')
      .eq('patient_id', patientId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false });
      
    if (error || !rels || rels.length === 0) return [];
    
    const caregiverIds = rels.map(r => r.caregiver_id).filter(Boolean);
    if (caregiverIds.length === 0) return rels;
    
    const { data: profiles } = await databaseClient
      .from('profiles')
      .select('id, nome, email')
      .in('id', caregiverIds);
      
    const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    
    return rels.map(r => ({
      ...r,
      caregiver: r.caregiver_id ? (profilesMap[r.caregiver_id] || { id: r.caregiver_id, nome: 'Cuidador Desconhecido' }) : null
    }));
  },

  /**
   * Lista todos os pacientes que um cuidador acompanha.
   */
  async listMyPatients(caregiverId) {
    if (!databaseClient) return [];
    
    const { data: rels, error: relsErr } = await databaseClient
      .from('caregiver_relationships')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false });
      
    if (relsErr) {
      console.error("ListMyPatients Rels Error:", relsErr);
      return [];
    }
    
    if (!rels || rels.length === 0) return [];

    const patientIds = rels.map(r => r.patient_id);
    const { data: profiles, error: profErr } = await databaseClient
      .from('profiles')
      .select('id, nome, email')
      .in('id', patientIds);
      
    if (profErr) {
      console.error("ListMyPatients Profiles Error:", profErr);
    }
    
    const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    
    return rels.map(r => ({
      ...r,
      patient: profilesMap[r.patient_id] || { id: r.patient_id, nome: 'Paciente Desconhecido' }
    }));
  },

  /**
   * Cria um convite para um novo cuidador.
   */
  async createInvite({ patientId, permissionLevel = 'viewer', inviteEmail = null, relationshipLabel = null }) {
    if (!databaseClient) return { error: 'Banco de dados remoto não configurado' };
    const { data, error } = await databaseClient
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
   * Aceita um convite pelo token (via RPC transacional).
   */
  async acceptInvite(token) {
    if (!databaseClient) return { error: 'Banco de dados remoto não configurado' };
    const { data, error } = await databaseClient
      .rpc('accept_caregiver_invite', { p_token: token });
    if (error) return { error: error.message };
    return data;
  },

  /**
   * Lê dados de um convite pelo token (antes de aceitar — tela de preview).
   */
  async getInviteByToken(token) {
    if (!databaseClient) return null;
    const { data: rel, error } = await databaseClient
      .from('caregiver_relationships')
      .select('*')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .maybeSingle();
      
    if (error || !rel) return null;
    
    const { data: prof } = await databaseClient
      .from('profiles')
      .select('nome, email')
      .eq('id', rel.patient_id)
      .maybeSingle();
      
    return {
      ...rel,
      patient: prof || { nome: 'Paciente' }
    };
  },

  /**
   * Revoga o acesso de um cuidador.
   */
  async revoke(relationshipId) {
    if (!databaseClient) return false;
    const { data } = await databaseClient
      .rpc('revoke_caregiver', { p_relationship_id: relationshipId });
    return data === true;
  },

  /**
   * Recusa um convite (feito pelo cuidador).
   */
  async declineInvite(relationshipId) {
    if (!databaseClient) return false;
    const { data: userData } = await databaseClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return false;
    const { error } = await databaseClient
      .from('caregiver_relationships')
      .update({ status: 'declined' })
      .eq('id', relationshipId)
      .eq('caregiver_id', uid);
    return !error;
  },

  /**
   * Altera o nível de permissão de um cuidador.
   */
  async updatePermission(relationshipId, permissionLevel, patientId) {
    if (!databaseClient) return false;
    const { error } = await databaseClient
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
    if (!databaseClient) return false;
    const { error } = await databaseClient
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
    if (!databaseClient) return null;
    const { data } = await databaseClient
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
   * Busca resumo do paciente via RPC.
   */
  async getPatientSummary(patientId) {
    if (!databaseClient) return null;
    try {
      const { data, error } = await databaseClient
        .rpc('get_patient_summary', { p_patient_id: patientId });
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Busca medicamentos ativos do paciente.
   */
  async getPatientMeds(patientId) {
    if (!databaseClient) return [];
    const { data } = await databaseClient
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
    if (!databaseClient) return [];
    const { data } = await databaseClient
      .from('historico_doses')
      .select('*')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  },

  /**
   * Confirma uma dose remotamente.
   */
  async confirmDoseRemotely({ patientId, medId, hora }) {
    if (!databaseClient) return false;
    const now = new Date();
    const [h, m] = hora.split(':').map(Number);
    const planned = new Date();
    planned.setHours(h, m, 0, 0);
    const delay = Math.max(0, Math.round((now - planned) / 60000));

    const { error } = await databaseClient
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
    if (!databaseClient) return [];
    
    const { data: notes, error } = await databaseClient
      .from('caregiver_notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error || !notes || notes.length === 0) return [];
    
    const caregiverIds = notes.map(n => n.caregiver_id).filter(Boolean);
    if (caregiverIds.length === 0) return notes;
    
    const { data: profiles } = await databaseClient
      .from('profiles')
      .select('id, nome')
      .in('id', caregiverIds);
      
    const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    
    return notes.map(n => ({
      ...n,
      caregiver: n.caregiver_id ? (profilesMap[n.caregiver_id] || { nome: 'Cuidador' }) : null
    }));
  },

  async add({ relationshipId, patientId, caregiverId, title, description, metadata = {} }) {
    if (!databaseClient) return null;
    const { data, error } = await databaseClient
      .from('caregiver_notes')
      .insert({ relationship_id: relationshipId, patient_id: patientId, caregiver_id: caregiverId, title, description, metadata })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id, caregiverId) {
    if (!databaseClient) return;
    await databaseClient
      .from('caregiver_notes')
      .delete()
      .eq('id', id)
      .eq('caregiver_id', caregiverId);
  },
};

export const caregiverService = {
  CaregiverDB,
  CaregiverDashDB,
  CaregiverNotesDB,
  PERMISSION_LEVELS,
  STATUS_LABELS,
};
