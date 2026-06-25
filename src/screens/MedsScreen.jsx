'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { C } from '@/lib/theme';



export function MedsScreen({ T, scale, onAdd, onEdit, onView, toast }) {
  const { meds, history, deleteMed } = useApp();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const nome = deleteTarget.nome;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteMed(id);
    if (toast) toast(`🗑 ${nome} excluído`, 'info');
  };

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
            style={{
              padding: '14px 26px', borderRadius: 13,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none',
              boxShadow: '0 4px 20px rgba(59,130,246,.35)',
            }}
          >
            + Adicionar medicamento
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meds.map((m) => {
            const todayDone = history.filter(
              (h) => h.med_id === m.id && new Date(h.created_at).toDateString() === new Date().toDateString() && h.status === 'confirmed'
            ).length;

            return (
              <div
                key={m.id}
                onClick={() => onView(m)}
                role="button" tabIndex={0}
                aria-label={`Ver detalhes de ${m.nome}`}
                onKeyDown={(e) => e.key === 'Enter' && onView(m)}
                style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
              >
                <div style={{ width: 4, borderRadius: 99, background: m.cor, flexShrink: 0, alignSelf: 'stretch', minHeight: 60 }} />
                <div style={{ width: 50, height: 50, borderRadius: 14, flexShrink: 0, background: m.cor + '20', border: `2px solid ${m.cor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💊</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <p style={{ color: T.txt, fontWeight: 800, fontSize: 16 * scale, marginBottom: 1 }}>{m.nome}</p>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12 * scale, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: m.quantidade <= 5 ? 'rgba(239,68,68,.15)' : m.quantidade <= 10 ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)', color: m.quantidade <= 5 ? C.red : m.quantidade <= 10 ? C.amber : C.green }}>
                      📦 {m.quantidade} {m.unidade}s
                    </span>
                    <span style={{ color: T.muted, fontSize: 12 * scale }}>Hoje: {todayDone}/{(m.horarios || []).length || 1}</span>
                  </div>
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
    </div>
  );
}
