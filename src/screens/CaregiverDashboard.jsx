'use client';
// src/screens/CaregiverDashboard.jsx
// Dashboard do CUIDADOR — acompanha um paciente em tempo real.
// Exibe: resumo, medicamentos ativos, histórico recente e notas do cuidador.
// Split em sub-componentes para manter cada bloco < 100 linhas.

import { useState } from 'react';
import { usePatientDashboard, useMyPatients, PERMISSION_LEVELS } from '@/hooks/useCaregiver';
import { C } from '@/lib/theme';

// ─── Cards de métricas ─────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color = '#3b82f6', T, scale }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</p>
      </div>
      <p style={{ color, fontSize: 26 * scale, fontWeight: 900, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ─── Barra de progresso ────────────────────────────────────────────────────────
function ProgressBar({ value, color = '#3b82f6' }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 99, transition: 'width .5s ease' }} />
    </div>
  );
}

// ─── Resumo do paciente ────────────────────────────────────────────────────────
function PatientSummary({ summary, confirmedToday, totalToday, progressToday, adhesion, T, scale }) {
  const lastDose = summary?.last_dose;
  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.12),rgba(99,102,241,.12))', border: '1px solid rgba(59,130,246,.2)', borderRadius: 20, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(59,130,246,.2)', border: '2px solid rgba(59,130,246,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          👤
        </div>
        <div>
          <p style={{ color: T.txt, fontWeight: 900, fontSize: 17 * scale }}>{summary?.profile?.nome || '—'}</p>
          <p style={{ color: T.sub, fontSize: 12 * scale }}>{summary?.profile?.email || ''}</p>
        </div>
      </div>

      {/* Progresso de hoje */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 600 }}>Doses de hoje</p>
          <p style={{ color: T.txt, fontSize: 11 * scale, fontWeight: 800 }}>{confirmedToday}/{totalToday}</p>
        </div>
        <ProgressBar value={progressToday} color={progressToday >= 80 ? '#22c55e' : progressToday >= 50 ? '#f59e0b' : '#ef4444'} />
      </div>

      {/* Métricas grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricCard icon="📋" label="Adesão 30d" value={`${adhesion}%`} color={adhesion >= 80 ? '#22c55e' : C.amber} T={T} scale={scale} />
        <MetricCard icon="💊" label="Medicamentos" value={summary?.meds_count ?? '—'} sub="ativos" T={T} scale={scale} />
        <MetricCard
          icon="⏱" label="Última dose"
          value={lastDose ? lastDose.hora : '—'}
          sub={lastDose ? new Date(lastDose.at).toLocaleDateString('pt-BR') : 'Sem registro'}
          color={T.txt} T={T} scale={scale}
        />
        <MetricCard icon="✅" label="Hoje" value={`${progressToday}%`} color={progressToday >= 80 ? '#22c55e' : C.amber} T={T} scale={scale} />
      </div>
    </div>
  );
}

// ─── Lista de medicamentos ativos ──────────────────────────────────────────────
function MedsList({ meds, T, scale }) {
  if (!meds.length) return (
    <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '12px 0' }}>Nenhum medicamento ativo.</p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {meds.map(med => (
        <div key={med.id} style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${med.cor || '#3b82f6'}22`, border: `2px solid ${med.cor || '#3b82f6'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💊</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: T.txt, fontWeight: 700, fontSize: 13 * scale, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.nome}</p>
            <p style={{ color: T.muted, fontSize: 11 * scale }}>{med.dosagem} · {(med.horarios || []).join(', ')}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ color: T.sub, fontSize: 10 * scale }}>{med.quantidade ?? '—'}</p>
            <p style={{ color: T.muted, fontSize: 9 * scale }}>{med.unidade}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Histórico recente ─────────────────────────────────────────────────────────
function HistoryList({ history, T, scale }) {
  const recent = history.slice(0, 20);
  if (!recent.length) return (
    <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '12px 0' }}>Sem registros recentes.</p>
  );
  const grouped = recent.reduce((acc, h) => {
    const d = new Date(h.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(h);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{date}</p>
          {items.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.bdr}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{h.status === 'confirmed' ? '✅' : '❌'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: T.txt, fontSize: 12 * scale, fontWeight: 600 }}>{h.hora} · {h.med_nome || 'Medicamento'}</p>
                {h.atraso_minutos > 0 && <p style={{ color: C.amber, fontSize: 10 * scale }}>{h.atraso_minutos}min de atraso</p>}
              </div>
              <span style={{ color: h.status === 'confirmed' ? '#22c55e' : C.red, fontSize: 11 * scale, fontWeight: 700 }}>
                {h.status === 'confirmed' ? 'Tomou' : 'Não tomou'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Notas do cuidador ─────────────────────────────────────────────────────────
function NotesSection({ notes, onAdd, onDelete, caregiverId, relationshipId, patientId, T, scale }) {
  const [showForm, setShowForm]   = useState(false);
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]       = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({ relationshipId, caregiverId, title, description });
    setTitle(''); setDescription(''); setShowForm(false); setSaving(false);
  };

  const inp = { background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 13 * scale, width: '100%', outline: 'none' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>
          Minhas observações ({notes.length})
        </p>
        <button onClick={() => setShowForm(f => !f)} style={{ color: '#3b82f6', fontSize: 12 * scale, fontWeight: 700, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 99, padding: '4px 12px', cursor: 'pointer' }}>
          + Adicionar
        </button>
      </div>

      {showForm && (
        <div style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <input style={{ ...inp, marginBottom: 8 }} placeholder="Título (ex: Pressão medida)" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea rows={3} style={{ ...inp, resize: 'none', marginBottom: 10 }} placeholder="Observação detalhada…" value={description} onChange={e => setDescription(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.bg3, color: T.sub, border: `1px solid ${T.bdr}`, cursor: 'pointer', fontWeight: 600, fontSize: 12 * scale }}>Cancelar</button>
            <button onClick={handleAdd} disabled={saving || !title.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, background: !title.trim() ? T.bg3 : '#3b82f6', color: !title.trim() ? T.muted : '#fff', border: 'none', cursor: title.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 12 * scale }}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !showForm && <p style={{ color: T.muted, fontSize: 12 * scale, textAlign: 'center', padding: '8px 0' }}>Nenhuma observação ainda.</p>}

      {notes.map(note => (
        <div key={note.id} style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ color: T.txt, fontWeight: 700, fontSize: 13 * scale }}>{note.title}</p>
            {note.caregiver_id === caregiverId && (
              <button onClick={() => onDelete(note.id, caregiverId)} style={{ color: C.red, background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
            )}
          </div>
          {note.description && <p style={{ color: T.sub, fontSize: 12 * scale, lineHeight: 1.5 }}>{note.description}</p>}
          <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 6 }}>{new Date(note.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>
      ))}
    </>
  );
}

// ─── Tela principal ────────────────────────────────────────────────────────────
export function CaregiverDashboard({ user, T, scale = 1 }) {
  const { patients, loading: loadingPatients } = useMyPatients(user?.id);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [tab, setTab] = useState('summary'); // 'summary' | 'meds' | 'history' | 'notes'

  const patientId = selectedPatientId || patients[0]?.patient_id || null;
  const relationship = patients.find(p => p.patient_id === patientId);

  const {
    summary, meds, history, notes, loading,
    confirmedToday, totalToday, progressToday, adhesion,
    addNote, deleteNote,
  } = usePatientDashboard(patientId);

  const perm = PERMISSION_LEVELS[relationship?.permission_level] || PERMISSION_LEVELS.viewer;

  if (loadingPatients) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <span className="anim-blink" style={{ fontSize: 40 }}>👤</span>
      <p style={{ color: T.sub, marginTop: 12, fontSize: 14 * scale }}>Carregando…</p>
    </div>
  );

  if (!patients.length) return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>🤝</p>
      <p style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800, marginBottom: 8 }}>Nenhum paciente vinculado</p>
      <p style={{ color: T.sub, fontSize: 13 * scale, lineHeight: 1.6 }}>Você ainda não foi adicionado como cuidador. Peça ao paciente para te enviar um convite.</p>
    </div>
  );

  const tabs = [
    { id: 'summary', label: 'Resumo',      icon: '📊' },
    { id: 'meds',    label: 'Remédios',    icon: '💊' },
    { id: 'history', label: 'Histórico',   icon: '📋' },
    { id: 'notes',   label: 'Minhas Notas', icon: '📝' },
  ];

  return (
    <div className="anim-fadeUp">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Painel do Cuidador</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 14 }}>{perm.icon}</span>
          <p style={{ color: T.sub, fontSize: 12 * scale }}>{perm.label}</p>
        </div>
      </div>

      {/* Seletor de paciente (quando tem múltiplos) */}
      {patients.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {patients.map(p => (
            <button
              key={p.patient_id}
              onClick={() => setSelectedPatientId(p.patient_id)}
              style={{
                padding: '8px 16px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'pointer',
                fontSize: 12 * scale, fontWeight: 700,
                background: patientId === p.patient_id ? '#3b82f6' : T.bg3,
                color: patientId === p.patient_id ? '#fff' : T.sub,
                border: `1px solid ${patientId === p.patient_id ? '#3b82f6' : T.bdr}`,
              }}
            >
              {p.patient?.nome || 'Paciente'}
            </button>
          ))}
        </div>
      )}

      {/* Tabs de navegação */}
      <div style={{ display: 'flex', background: T.bg2, borderRadius: 12, padding: 4, gap: 3, marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 10 * scale, fontWeight: 700,
              background: tab === t.id ? T.bg1 : 'none',
              color: tab === t.id ? T.txt : T.muted,
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.2)' : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <span className="anim-blink" style={{ fontSize: 32 }}>⟳</span>
        </div>
      ) : (
        <>
          {tab === 'summary' && (
            <PatientSummary
              summary={summary}
              confirmedToday={confirmedToday}
              totalToday={totalToday}
              progressToday={progressToday}
              adhesion={adhesion}
              T={T} scale={scale}
            />
          )}
          {tab === 'meds'    && <MedsList     meds={meds}       T={T} scale={scale} />}
          {tab === 'history' && <HistoryList  history={history}  T={T} scale={scale} />}
          {tab === 'notes'   && (
            <NotesSection
              notes={notes}
              onAdd={addNote}
              onDelete={deleteNote}
              caregiverId={user?.id}
              relationshipId={relationship?.id}
              patientId={patientId}
              T={T} scale={scale}
            />
          )}
        </>
      )}
    </div>
  );
}
