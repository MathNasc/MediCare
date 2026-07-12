'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { SOSQuickLogModal } from '@/components/modals/SOSQuickLogModal';
import { TreatmentBadge, TreatmentProgressBar } from '@/components/ui/TreatmentBadge';
import { getTreatmentProgress } from '@/lib/treatmentTypes';
import { C } from '@/lib/theme';

// ─── Modal: repetir tratamento (nova data de início) ──────────────────────────
function RepeatTreatmentModal({ med, onConfirm, onClose, T, scale }) {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(med, startDate);
    setSaving(false);
    onClose();
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(14px)', zIndex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="anim-scaleIn" style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, width: '100%', maxWidth: 420, padding: 22 }}>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 16 * scale, marginBottom: 6 }}>🔁 Repetir tratamento</p>
        <p style={{ color: T.sub, fontSize: 12 * scale, marginBottom: 16, lineHeight: 1.5 }}>
          {med.nome} · {med.dosagem} será duplicado com os mesmos horários. Escolha a nova data de início.
        </p>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={{ width: '100%', background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale, marginBottom: 16, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: T.bg3, color: T.sub, border: `1px solid ${T.bdr}`, cursor: 'pointer', fontWeight: 700, fontSize: 13 * scale }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: 13, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13 * scale, opacity: saving ? .7 : 1 }}>
            {saving ? 'Criando…' : 'Repetir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Seção: Medicamentos SOS ────────────────────────────────────────────────
function SOSSection({ sosMeds, onRegister, T, scale }) {
  if (sosMeds.length === 0) return null;
  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.08))', border: '1px solid rgba(59,130,246,.2)', borderRadius: 20, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🔵</span>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 14 * scale }}>Medicamentos SOS</p>
        <span style={{ color: T.muted, fontSize: 11 * scale }}>· uso quando necessário</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sosMeds.map(m => (
          <div key={m.id} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.cor}22`, border: `2px solid ${m.cor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💊</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: T.txt, fontWeight: 700, fontSize: 13 * scale, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</p>
              <p style={{ color: T.muted, fontSize: 11 * scale }}>{m.dosagem} · {m.quantidade} {m.unidade}s em estoque</p>
            </div>
            <button
              onClick={() => onRegister(m)}
              style={{ padding: '8px 14px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 12 * scale, border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              + Registrar uso
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MedsScreen({ T, scale, onAdd, onEdit, onView, toast }) {
  const { meds, history, deleteMed, registerSOSUse, repeatTreatment } = useApp();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sosTarget, setSosTarget]       = useState(null);
  const [repeatTarget, setRepeatTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const nome = deleteTarget.nome;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteMed(id);
    if (toast) toast(`🗑 ${nome} excluído`, 'info');
  };

  const handleRegisterSOS = async (med, payload) => {
    const result = await registerSOSUse(med, { ...payload, toastFn: toast });
    return result;
  };

  const handleRepeat = async (med, startDate) => {
    const result = await repeatTreatment(med, startDate);
    if (result?.success) toast?.(`🔁 ${med.nome}: novo tratamento criado!`, 'ok');
    else toast?.('Erro ao repetir tratamento', 'err');
  };

  // Separa medicamentos por tipo de tratamento
  const sosMeds        = meds.filter(m => m.treatment_type === 'sos' && m.ativo !== false);
  const regularMeds     = meds.filter(m => (m.treatment_type || 'continuous') !== 'sos');
  const finishedTreatments = meds.filter(m => m.treatment_type === 'temporary' && m.status === 'concluido');

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Meus medicamentos</h2>
        <button
          onClick={onAdd}
          aria-label="Adicionar medicamento"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 700, fontSize: 14 * scale, border: 'none', boxShadow: '0 4px 16px rgba(59,130,246,.35)' }}
        >
          ＋ Novo
        </button>
      </div>

      {/* Medicamentos SOS — lista rápida */}
      <SOSSection sosMeds={sosMeds} onRegister={setSosTarget} T={T} scale={scale} />

      {meds.length === 0 ? (
        <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>💊</p>
          <p style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800, marginBottom: 8 }}>
            Nenhum medicamento cadastrado
          </p>
          <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 22, lineHeight: 1.6 }}>
            Adicione seu primeiro medicamento para começar o acompanhamento.
          </p>
          <button
            onClick={onAdd}
            style={{ padding: '14px 26px', borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)' }}
          >
            + Adicionar medicamento
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {regularMeds.map((m) => {
            const todayDone = history.filter(
              (h) => h.med_id === m.id && new Date(h.created_at).toDateString() === new Date().toDateString() && h.status === 'confirmed'
            ).length;
            const progress = getTreatmentProgress(m);
            const isFinished = m.treatment_type === 'temporary' && m.status === 'concluido';

            return (
              <div
                key={m.id}
                onClick={() => onView(m)}
                role="button" tabIndex={0}
                aria-label={`Ver detalhes de ${m.nome}`}
                onKeyDown={(e) => e.key === 'Enter' && onView(m)}
                style={{ background: T.bg1, border: `1px solid ${isFinished ? T.bdr : T.bdr}`, borderRadius: 20, padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', opacity: isFinished ? 0.75 : 1 }}
              >
                <div style={{ width: 4, borderRadius: 99, background: m.cor, flexShrink: 0, alignSelf: 'stretch', minHeight: 60 }} />
                <div style={{ width: 50, height: 50, borderRadius: 14, flexShrink: 0, background: m.cor + '20', border: `2px solid ${m.cor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💊</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <p style={{ color: T.txt, fontWeight: 800, fontSize: 16 * scale }}>{m.nome}</p>
                        <TreatmentBadge med={m} scale={scale} />
                        {isFinished && (
                          <span style={{ fontSize: 10 * scale, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(110,118,129,.15)', color: T.muted }}>Concluído</span>
                        )}
                      </div>
                      <p style={{ color: T.sub, fontSize: 13 * scale }}>{m.dosagem} · {m.unidade}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(m); }}
                        aria-label={`Editar ${m.nome}`}
                        style={{ width: 34, height: 34, borderRadius: 10, background: T.bg2, border: `1px solid ${T.bdr}`, color: T.sub, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✏️</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                        aria-label={`Excluir ${m.nome}`}
                        style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: C.red, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >🗑</button>
                    </div>
                  </div>

                  {m.observacoes && <p style={{ color: T.muted, fontSize: 12 * scale, marginBottom: 8, lineHeight: 1.4 }}>{m.observacoes}</p>}

                  {/* Barra de progresso — apenas tratamentos temporários ativos */}
                  {progress && !isFinished && <TreatmentProgressBar med={m} T={T} scale={scale} />}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <span style={{ fontSize: 12 * scale, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: m.quantidade <= 5 ? 'rgba(239,68,68,.15)' : m.quantidade <= 10 ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)', color: m.quantidade <= 5 ? C.red : m.quantidade <= 10 ? C.amber : C.green }}>
                      📦 {m.quantidade} {m.unidade}s
                    </span>
                    {!isFinished && (
                      <span style={{ color: T.muted, fontSize: 12 * scale }}>Hoje: {todayDone}/{(m.horarios || []).length || 1}</span>
                    )}
                  </div>

                  {isFinished && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRepeatTarget(m); }}
                      style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(59,130,246,.1)', color: '#3b82f6', fontWeight: 700, fontSize: 12 * scale, border: '1px solid rgba(59,130,246,.3)', cursor: 'pointer' }}
                    >
                      🔁 Repetir tratamento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          medName={deleteTarget.nome}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          T={T}
          scale={scale}
        />
      )}

      {sosTarget && (
        <SOSQuickLogModal
          med={sosTarget}
          onConfirm={handleRegisterSOS}
          onClose={() => setSosTarget(null)}
          T={T}
          scale={scale}
        />
      )}

      {repeatTarget && (
        <RepeatTreatmentModal
          med={repeatTarget}
          onConfirm={handleRepeat}
          onClose={() => setRepeatTarget(null)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}
