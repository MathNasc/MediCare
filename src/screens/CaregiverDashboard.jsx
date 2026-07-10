'use client';
// src/screens/CaregiverDashboard.jsx
// Dashboard do CUIDADOR — acompanha um paciente em tempo real.
// Abas: Resumo, Remédios, Histórico, Calendário (correção retroativa), Notas.

import { useState } from 'react';
import { usePatientDashboard, useMyPatients, PERMISSION_LEVELS } from '@/hooks/useCaregiver';
import { useApp } from '@/context/AppContext';
import { RetroactiveConfirmModal } from '@/components/modals/RetroactiveConfirmModal';
import { CaregiverBadge } from '@/components/ui/CaregiverBadge';
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
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(59,130,246,.2)', border: '2px solid rgba(59,130,246,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
        <div>
          <p style={{ color: T.txt, fontWeight: 900, fontSize: 17 * scale }}>{summary?.profile?.nome || '—'}</p>
          <p style={{ color: T.sub, fontSize: 12 * scale }}>{summary?.profile?.email || ''}</p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 600 }}>Doses de hoje</p>
          <p style={{ color: T.txt, fontSize: 11 * scale, fontWeight: 800 }}>{confirmedToday}/{totalToday}</p>
        </div>
        <ProgressBar value={progressToday} color={progressToday >= 80 ? '#22c55e' : progressToday >= 50 ? '#f59e0b' : '#ef4444'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricCard icon="📋" label="Adesão 30d" value={`${adhesion}%`} color={adhesion >= 80 ? '#22c55e' : C.amber} T={T} scale={scale} />
        <MetricCard icon="💊" label="Medicamentos" value={summary?.meds_count ?? '—'} sub="ativos" T={T} scale={scale} />
        <MetricCard icon="⏱" label="Última dose" value={lastDose ? lastDose.hora : '—'} sub={lastDose ? new Date(lastDose.at).toLocaleDateString('pt-BR') : 'Sem registro'} color={T.txt} T={T} scale={scale} />
        <MetricCard icon="✅" label="Hoje" value={`${progressToday}%`} color={progressToday >= 80 ? '#22c55e' : C.amber} T={T} scale={scale} />
      </div>
    </div>
  );
}

function MedsList({ meds, T, scale }) {
  if (!meds.length) return <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '12px 0' }}>Nenhum medicamento ativo.</p>;
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

function HistoryList({ history, T, scale }) {
  const recent = history.slice(0, 20);
  if (!recent.length) return <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '12px 0' }}>Sem registros recentes.</p>;
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
            <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${T.bdr}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{h.status === 'confirmed' ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: T.txt, fontSize: 12 * scale, fontWeight: 600 }}>{h.hora} · {h.med_nome || 'Medicamento'}</p>
                  {h.atraso_minutos > 0 && <p style={{ color: C.amber, fontSize: 10 * scale }}>{h.atraso_minutos}min de atraso</p>}
                </div>
                <span style={{ color: h.status === 'confirmed' ? '#22c55e' : C.red, fontSize: 11 * scale, fontWeight: 700 }}>
                  {h.status === 'confirmed' ? 'Tomou' : 'Não tomou'}
                </span>
              </div>
              {h.performed_by && h.performed_by !== h.user_id && (
                <CaregiverBadge correctedByOther correctorName="você" isRetroactive={h.is_retroactive} correctedAt={h.corrected_at} scale={scale} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Aba Calendário: correção retroativa (justificativa obrigatória) ──────────
function CalendarCorrectionTab({ meds, history, patientId, T, scale }) {
  const { confirmDoseRetroactive } = useApp();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalDose, setModalDose]       = useState(null);
  const [toast, setToast]               = useState('');

  const isPast = (dateStr) => new Date(dateStr) < new Date(new Date().toDateString());

  // Monta a lista de doses esperadas para a data selecionada, cruzando com o histórico
  const dosesForDate = meds.flatMap(med =>
    (med.horarios || []).map(hora => {
      const record = history.find(h =>
        h.med_id === med.id && h.hora === hora && new Date(h.created_at).toISOString().slice(0, 10) === selectedDate
      );
      return {
        medId: med.id,
        nome: med.nome,
        dosagem: med.dosagem,
        cor: med.cor,
        hora,
        confirmed: record?.status === 'confirmed',
        record,
      };
    })
  ).sort((a, b) => a.hora.localeCompare(b.hora));

  const handleConfirm = async (reason) => {
    const result = await confirmDoseRetroactive({
      patientId,
      medId: modalDose.medId,
      hora: modalDose.hora,
      doseDate: selectedDate,
      newStatus: 'confirmed',
      reason,
    });
    if (result?.success) {
      setModalDose(null);
      setToast('✓ Dose confirmada retroativamente!');
      setTimeout(() => setToast(''), 2500);
    }
    return result;
  };

  return (
    <>
      {toast && (
        <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ color: '#22c55e', fontSize: 12 * scale, fontWeight: 700 }}>{toast}</p>
        </div>
      )}

      <input
        type="date"
        value={selectedDate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={e => setSelectedDate(e.target.value)}
        style={{
          width: '100%', background: T.inp, border: `1.5px solid ${T.inpB}`,
          borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale,
          marginBottom: 14, outline: 'none',
        }}
      />

      {dosesForDate.length === 0 && (
        <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '20px 0' }}>
          Nenhum medicamento programado para esta data.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dosesForDate.map((d, i) => (
          <div key={i} style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${d.cor || '#3b82f6'}22`, border: `2px solid ${d.cor || '#3b82f6'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💊</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: T.txt, fontWeight: 700, fontSize: 13 * scale }}>{d.nome} · {d.hora}</p>
                <p style={{ color: d.confirmed ? '#22c55e' : C.amber, fontSize: 11 * scale, fontWeight: 600 }}>
                  {d.confirmed ? '✓ Confirmada' : 'Não confirmada'}
                </p>
              </div>
              {!d.confirmed && isPast(selectedDate) && (
                <button
                  onClick={() => setModalDose(d)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, fontSize: 11 * scale, fontWeight: 700,
                    background: 'rgba(245,158,11,.12)', color: C.amber,
                    border: '1px solid rgba(245,158,11,.3)', cursor: 'pointer', flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  🕐 Confirmar retroativamente
                </button>
              )}
            </div>
            {d.record?.performed_by && d.record.performed_by !== patientId && (
              <CaregiverBadge correctedByOther correctorName="você" isRetroactive={d.record.is_retroactive} correctedAt={d.record.corrected_at} scale={scale} />
            )}
          </div>
        ))}
      </div>

      {modalDose && (
        <RetroactiveConfirmModal
          dose={{ nome: modalDose.nome, dosagem: modalDose.dosagem, hora: modalDose.hora, date: selectedDate }}
          requireReason={true} // cuidador SEMPRE justifica
          onConfirm={handleConfirm}
          onClose={() => setModalDose(null)}
          T={T}
          scale={scale}
        />
      )}
    </>
  );
}

function NotesSection({ notes, onAdd, onDelete, caregiverId, relationshipId, T, scale }) {
  const [showForm, setShowForm]       = useState(false);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);

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
        <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Minhas observações ({notes.length})</p>
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
  const [tab, setTab] = useState('summary'); // 'summary'|'meds'|'history'|'calendar'|'notes'

  const patientId = selectedPatientId || patients[0]?.patient_id || null;
  const relationship = patients.find(p => p.patient_id === patientId);

  const {
    summary, meds, history, notes, loading,
    confirmedToday, totalToday, progressToday, adhesion,
    addNote, deleteNote,
  } = usePatientDashboard(patientId);

  const perm = PERMISSION_LEVELS[relationship?.permission_level] || PERMISSION_LEVELS.viewer;
  const canCorrect = ['caregiver', 'admin'].includes(relationship?.permission_level);

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
    { id: 'summary',  label: 'Resumo',    icon: '📊' },
    { id: 'meds',     label: 'Remédios',  icon: '💊' },
    { id: 'history',  label: 'Histórico', icon: '📋' },
    ...(canCorrect ? [{ id: 'calendar', label: 'Corrigir', icon: '🕐' }] : []),
    { id: 'notes',    label: 'Notas',     icon: '📝' },
  ];

  return (
    <div className="anim-fadeUp">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Painel do Cuidador</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 14 }}>{perm.icon}</span>
          <p style={{ color: T.sub, fontSize: 12 * scale }}>{perm.label}</p>
        </div>
      </div>

      {patients.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {patients.map(p => (
            <button
              key={p.patient_id}
              onClick={() => setSelectedPatientId(p.patient_id)}
              style={{ padding: '8px 16px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 12 * scale, fontWeight: 700, background: patientId === p.patient_id ? '#3b82f6' : T.bg3, color: patientId === p.patient_id ? '#fff' : T.sub, border: `1px solid ${patientId === p.patient_id ? '#3b82f6' : T.bdr}` }}
            >
              {p.patient?.nome || 'Paciente'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', background: T.bg2, borderRadius: 12, padding: 4, gap: 3, marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flex: 1, minWidth: 58, padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 10 * scale, fontWeight: 700, background: tab === t.id ? T.bg1 : 'none', color: tab === t.id ? T.txt : T.muted, boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.2)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          >
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <span className="anim-blink" style={{ fontSize: 32 }}>⟳</span>
        </div>
      ) : (
        <>
          {tab === 'summary'  && <PatientSummary summary={summary} confirmedToday={confirmedToday} totalToday={totalToday} progressToday={progressToday} adhesion={adhesion} T={T} scale={scale} />}
          {tab === 'meds'     && <MedsList     meds={meds}    T={T} scale={scale} />}
          {tab === 'history'  && <HistoryList  history={history} T={T} scale={scale} />}
          {tab === 'calendar' && canCorrect && (
            <CalendarCorrectionTab meds={meds} history={history} patientId={patientId} T={T} scale={scale} />
          )}
          {tab === 'notes'    && (
            <NotesSection notes={notes} onAdd={addNote} onDelete={deleteNote} caregiverId={user?.id} relationshipId={relationship?.id} T={T} scale={scale} />
          )}
        </>
      )}
    </div>
  );
}
