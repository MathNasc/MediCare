'use client';
// src/screens/CaregiversScreen.jsx
// Tela do PACIENTE para gerenciar seus cuidadores.
// Lista ativos, pendentes; cria convites; revoga acesso; edita permissões.

import { useState } from 'react';
import { useMyCaregivers, PERMISSION_LEVELS } from '@/hooks/useCaregiver';
import { InviteModal } from '@/components/modals/InviteModal';
import { C } from '@/lib/theme';

// ─── Badge de status ───────────────────────────────────────────────────────────
function StatusBadge({ status, scale = 1 }) {
  const cfg = {
    pending:  { label: 'Aguardando', color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
    active:   { label: 'Ativo',      color: '#22c55e', bg: 'rgba(34,197,94,.15)'  },
    declined: { label: 'Recusado',   color: '#ef4444', bg: 'rgba(239,68,68,.15)'  },
    revoked:  { label: 'Revogado',   color: '#6e7681', bg: 'rgba(110,118,129,.12)'},
  }[status] || { label: status, color: '#6e7681', bg: 'transparent' };
  return (
    <span style={{ fontSize: 10 * scale, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ─── Card de um cuidador ──────────────────────────────────────────────────────
function CaregiverCard({ rel, onRevoke, onChangePermission, onShareAgain, T, scale }) {
  const [expanded, setExpanded]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const perm = PERMISSION_LEVELS[rel.permission_level] || PERMISSION_LEVELS.viewer;
  const name = rel.caregiver?.nome || rel.invite_email || 'Convite pendente';
  const isActive  = rel.status === 'active';
  const isPending = rel.status === 'pending';

  return (
    <div style={{
      background: T.bg1,
      border: `1px solid ${isActive ? `${perm.color}30` : T.bdr}`,
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Linha principal */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 16px', display: 'flex', alignItems: 'center',
          gap: 12, cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: `${perm.color}18`,
          border: `2px solid ${perm.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {perm.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
              {name}
            </p>
            <StatusBadge status={rel.status} scale={scale} />
          </div>
          <p style={{ color: T.muted, fontSize: 11 * scale }}>
            {rel.relationship_label ? `${rel.relationship_label} · ` : ''}{perm.label}
          </p>
          {isPending && rel.invite_expires_at && (
            <p style={{ color: C.amber, fontSize: 10 * scale, marginTop: 2 }}>
              ⏱ Expira: {new Date(rel.invite_expires_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        <span style={{ color: T.muted, fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
      </button>

      {/* Expansão */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.bdr}` }}>
          {/* Permissão atual */}
          <p style={{ color: T.sub, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 8px' }}>
            Nível de acesso
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.entries(PERMISSION_LEVELS).map(([key, cfg]) => (
              <button
                key={key}
                disabled={!isActive}
                onClick={() => onChangePermission(rel.id, key)}
                style={{
                  padding: '6px 12px', borderRadius: 99, fontSize: 11 * scale, fontWeight: 600,
                  border: `1.5px solid ${rel.permission_level === key ? cfg.color : T.bdr}`,
                  background: rel.permission_level === key ? `${cfg.color}15` : T.bg3,
                  color: rel.permission_level === key ? cfg.color : T.sub,
                  cursor: isActive ? 'pointer' : 'not-allowed', opacity: isActive ? 1 : .5,
                }}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isPending && (
              <button
                onClick={() => onShareAgain(rel)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 12 * scale, fontWeight: 700,
                  background: 'rgba(59,130,246,.1)', color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,.3)', cursor: 'pointer',
                }}
              >
                🔗 Reenviar convite
              </button>
            )}
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 12 * scale, fontWeight: 700,
                  background: 'rgba(239,68,68,.08)', color: C.red,
                  border: '1px solid rgba(239,68,68,.2)', cursor: 'pointer',
                }}
              >
                {isActive ? '✕ Revogar acesso' : '🗑 Remover'}
              </button>
            ) : (
              <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setConfirming(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12 * scale, fontWeight: 700, background: T.bg3, color: T.sub, border: `1px solid ${T.bdr}`, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { onRevoke(rel.id); setConfirming(false); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12 * scale, fontWeight: 800, background: C.red, color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Confirmar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estado vazio ─────────────────────────────────────────────────────────────
function EmptyState({ onInvite, T, scale }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>🤝</p>
      <p style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800, marginBottom: 8 }}>
        Nenhum cuidador vinculado
      </p>
      <p style={{ color: T.sub, fontSize: 14 * scale, lineHeight: 1.6, marginBottom: 24 }}>
        Convide um familiar ou responsável para acompanhar seu tratamento em tempo real.
      </p>
      <button
        onClick={onInvite}
        style={{
          padding: '14px 28px', borderRadius: 14,
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          color: '#fff', fontWeight: 800, fontSize: 15 * scale,
          border: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)', cursor: 'pointer',
        }}
      >
        + Convidar cuidador
      </button>
    </div>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export function CaregiversScreen({ user, T, scale = 1 }) {
  const {
    caregivers, loading, error,
    createInvite, revoke, updatePermission,
    activeCount, pendingCount,
  } = useMyCaregivers(user?.id);

  const [showInvite, setShowInvite]       = useState(false);
  const [shareTarget, setShareTarget]     = useState(null);
  const [toast, setToast]                 = useState(null);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateInvite = async (opts) => {
    const result = await createInvite(opts);
    if (result?.error) { showToast(result.error, 'err'); return null; }
    showToast('Convite criado com sucesso!');
    return result;
  };

  const handleRevoke = async (id) => {
    const ok = await revoke(id);
    if (ok) showToast('Acesso revogado.');
    else showToast('Erro ao revogar acesso.', 'err');
  };

  const handlePermission = async (id, level) => {
    const ok = await updatePermission(id, level);
    if (ok) showToast('Permissão atualizada!');
    else showToast('Erro ao atualizar permissão.', 'err');
  };

  const active  = caregivers.filter(c => c.status === 'active');
  const pending = caregivers.filter(c => c.status === 'pending');
  const others  = caregivers.filter(c => !['active','pending'].includes(c.status));

  return (
    <div className="anim-fadeUp">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: '#1c2333',
          border: `1px solid ${toast.type === 'err' ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.4)'}`,
          borderRadius: 14, padding: '11px 18px',
          color: toast.type === 'err' ? C.red : '#22c55e',
          fontWeight: 600, fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          maxWidth: 340, textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Cuidadores</h2>
          <p style={{ color: T.sub, fontSize: 13 * scale, marginTop: 3 }}>
            {activeCount > 0
              ? `${activeCount} cuidador${activeCount > 1 ? 'es' : ''} ativo${activeCount > 1 ? 's' : ''}${pendingCount > 0 ? ` · ${pendingCount} aguardando` : ''}`
              : 'Compartilhe seu tratamento com confiança'}
          </p>
        </div>
        {caregivers.length > 0 && (
          <button
            onClick={() => setShowInvite(true)}
            style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: '#fff', fontWeight: 700, fontSize: 13 * scale,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59,130,246,.35)',
            }}
          >
            + Convidar
          </button>
        )}
      </div>

      {/* Info de privacidade */}
      <div style={{
        background: 'rgba(59,130,246,.06)',
        border: '1px solid rgba(59,130,246,.2)',
        borderRadius: 14, padding: '12px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
        <p style={{ color: T.sub, fontSize: 12 * scale, lineHeight: 1.5 }}>
          Apenas você pode adicionar ou remover cuidadores. O acesso só é concedido após o convite ser aceito.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <span className="anim-blink" style={{ fontSize: 36 }}>🤝</span>
        </div>
      )}

      {/* Erro */}
      {error && !loading && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <p style={{ color: C.red, fontSize: 13 * scale }}>Erro ao carregar cuidadores: {error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && caregivers.length === 0 && (
        <EmptyState onInvite={() => setShowInvite(true)} T={T} scale={scale} />
      )}

      {/* Ativos */}
      {active.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
            Ativos ({active.length})
          </p>
          {active.map(rel => (
            <CaregiverCard
              key={rel.id}
              rel={rel}
              onRevoke={handleRevoke}
              onChangePermission={handlePermission}
              onShareAgain={() => {}}
              T={T}
              scale={scale}
            />
          ))}
        </section>
      )}

      {/* Pendentes */}
      {pending.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
            Aguardando resposta ({pending.length})
          </p>
          {pending.map(rel => (
            <CaregiverCard
              key={rel.id}
              rel={rel}
              onRevoke={handleRevoke}
              onChangePermission={handlePermission}
              onShareAgain={(r) => setShareTarget(r.invite_token)}
              T={T}
              scale={scale}
            />
          ))}
        </section>
      )}

      {/* Histórico (revogados/recusados) */}
      {others.length > 0 && (
        <section>
          <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
            Histórico
          </p>
          {others.map(rel => (
            <CaregiverCard
              key={rel.id}
              rel={rel}
              onRevoke={handleRevoke}
              onChangePermission={handlePermission}
              onShareAgain={() => {}}
              T={T}
              scale={scale}
            />
          ))}
        </section>
      )}

      {/* Modais */}
      {showInvite && (
        <InviteModal
          onGenerate={handleCreateInvite}
          onClose={() => setShowInvite(false)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}
