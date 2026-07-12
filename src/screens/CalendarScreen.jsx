'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { C } from '@/lib/theme';
import { NotesDB, EventsDB, ObsDB } from '@/lib/supabaseCalendar';
import { RetroactiveConfirmModal } from '@/components/modals/RetroactiveConfirmModal';
import { CaregiverBadge } from '@/components/ui/CaregiverBadge';
import { TreatmentBadge } from '@/components/ui/TreatmentBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const toISO = (d) => d.toISOString().slice(0, 10);
const today = () => toISO(new Date());

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

const EVENT_ICONS = { consulta: '👨‍⚕️', exame: '🧪', procedimento: '💉', outro: '📌' };
const EVENT_LABELS = { consulta: 'Consulta', exame: 'Exame', procedimento: 'Procedimento', outro: 'Evento' };

// ─── Modal de nova nota ───────────────────────────────────────────────────────
function NoteModal({ date, note, onSave, onClose, T, scale }) {
  const [title, setTitle] = useState(note?.title || '');
  const [description, setDescription] = useState(note?.description || '');
  const [time, setTime] = useState(note?.time || '');

  const inp = { background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale, width: '100%' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 800 }}>{note ? 'Editar anotação' : 'Nova anotação'}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inp} placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea rows={4} style={{ ...inp, resize: 'none' }} placeholder="Descreva como foi o dia, sintomas, observações…" value={description} onChange={e => setDescription(e.target.value)} />
          <input type="time" style={inp} value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <button
          onClick={() => { if (title.trim()) onSave({ title, description, time, date }); }}
          style={{ marginTop: 16, width: '100%', padding: 16, borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none' }}
        >
          {note ? 'Salvar alterações' : 'Adicionar anotação'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal de novo evento ─────────────────────────────────────────────────────
function EventModal({ date, event, onSave, onClose, T, scale }) {
  const [type, setType]         = useState(event?.type || 'consulta');
  const [title, setTitle]       = useState(event?.title || '');
  const [description, setDesc]  = useState(event?.description || '');
  const [time, setTime]         = useState(event?.time || '');
  const [doctor, setDoctor]     = useState(event?.doctor || '');
  const [location, setLocation] = useState(event?.location || '');

  const inp = { background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale, width: '100%' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(12px)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: T.bg1, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 36, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 800 }}>{event ? 'Editar evento' : 'Novo evento'}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {Object.entries(EVENT_ICONS).map(([k, icon]) => (
            <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', background: type === k ? '#3b82f6' : T.bg3, color: type === k ? '#fff' : T.sub, fontSize: 11, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span>{EVENT_LABELS[k]}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inp} placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)} />
          <input style={inp} placeholder="Médico / Especialidade" value={doctor} onChange={e => setDoctor(e.target.value)} />
          <input style={inp} placeholder="Local / Clínica" value={location} onChange={e => setLocation(e.target.value)} />
          <input type="time" style={inp} value={time} onChange={e => setTime(e.target.value)} />
          <textarea rows={3} style={{ ...inp, resize: 'none' }} placeholder="Observações opcionais…" value={description} onChange={e => setDesc(e.target.value)} />
        </div>
        <button
          onClick={() => { if (title.trim()) onSave({ type, title, description, time, doctor, location, date }); }}
          style={{ marginTop: 16, width: '100%', padding: 16, borderRadius: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none' }}
        >
          {event ? 'Salvar alterações' : 'Adicionar evento'}
        </button>
      </div>
    </div>
  );
}

// ─── Painel de detalhes do dia ────────────────────────────────────────────────
function DayPanel({
  dateStr, history, meds, notes, events, obs, user, role,
  onAddNote, onEditNote, onDeleteNote, onAddEvent, onDeleteEvent,
  onConfirmRetroactive, onClose, T, scale,
}) {
  const [filter, setFilter] = useState('todos');
  const [obsText, setObsText] = useState('');
  const [obsTarget, setObsTarget] = useState(null);
  // Dose selecionada para correção retroativa: { med, hora }
  const [retroTarget, setRetroTarget] = useState(null);

  const date = new Date(dateStr + 'T12:00:00');
  const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isFuture = dateStr > today();

  const dayHistory = history.filter(h => new Date(h.created_at).toISOString().slice(0, 10) === dateStr);

  // Doses programadas para o dia — apenas medicamentos contínuos e temporários
  // (SOS nunca tem agenda fixa; é tratado separadamente logo abaixo)
  const scheduledDoses = meds
    .filter(m => m.ativo && (m.treatment_type || 'continuous') !== 'sos')
    .flatMap(m =>
      (m.horarios || ['08:00']).map(hora => {
        const hist = dayHistory.find(h => h.med_id === m.id && h.hora === hora);
        const obsEntry = obs.find(o => o.med_id === m.id && o.hora === hora);
        return { med: m, hora, hist, obs: obsEntry };
      })
    ).sort((a, b) => a.hora.localeCompare(b.hora));

  // Usos SOS registrados neste dia (não têm horário agendado — só aparecem
  // se o usuário efetivamente registrou o uso no histórico)
  const sosUsages = dayHistory
    .map(h => {
      const med = meds.find(m => m.id === h.med_id && m.treatment_type === 'sos');
      return med ? { med, hist: h } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.hist.hora.localeCompare(b.hist.hora));

  const dayNotes  = notes.filter(n => n.date === dateStr);
  const dayEvents = events.filter(e => e.date === dateStr);

  const filters = [
    { id: 'todos',        label: 'Todos' },
    { id: 'medicamentos', label: '💊 Meds' },
    { id: 'anotacoes',    label: '📝 Notas' },
    { id: 'eventos',      label: '📅 Eventos' },
  ];

  // Verifica se o próprio usuário ainda pode corrigir esta dose:
  // - independente: sempre
  // - paciente: apenas nas primeiras 24h e se não foi registrada por um cuidador
  // A validação definitiva é sempre feita no servidor (RPC confirm_dose_retroactive).
  const isEditableBySelf = (hora, hist) => {
    if (hist?.performed_by && hist.performed_by !== user.id) return false;
    if (role === 'independente') return true;
    if (role === 'paciente') {
      const doseDateTime = new Date(`${dateStr}T${hora}:00`);
      const hoursElapsed = (Date.now() - doseDateTime.getTime()) / 36e5;
      return hoursElapsed <= 24;
    }
    return false;
  };

  const handleRetroConfirm = async (reason) => {
    if (!retroTarget) return { success: false };
    const result = await onConfirmRetroactive({
      medId: retroTarget.med.id,
      hora: retroTarget.hora,
      doseDate: dateStr,
      newStatus: 'confirmed',
      reason,
    });
    if (result?.success) setRetroTarget(null);
    return result;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(14px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${T.bdr}`, position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>{isFuture ? 'Programado' : 'Histórico'}</p>
              <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 900, textTransform: 'capitalize' }}>{label}</h3>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {filters.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: 'none', background: filter === f.id ? '#3b82f6' : T.bg3, color: filter === f.id ? '#fff' : T.sub, fontWeight: 700, fontSize: 11 * scale }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Medicamentos */}
          {(filter === 'todos' || filter === 'medicamentos') && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Medicamentos</p>
              {scheduledDoses.length === 0 && sosUsages.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhum medicamento ativo</p>
              )}
              {scheduledDoses.map(({ med, hora, hist, obs: obsEntry }) => {
                const confirmed = hist?.status === 'confirmed';
                const missed    = !hist && !isFuture;
                const color     = confirmed ? C.green : missed ? C.red : T.muted;
                const icon      = confirmed ? '✓' : missed ? '✕' : '○';
                const bgColor   = confirmed ? 'rgba(34,197,94,.08)' : missed ? 'rgba(239,68,68,.08)' : T.bg2;

                // Correção retroativa: só faz sentido para dias não-futuros e doses não confirmadas
                const canOfferRetro = !isFuture && !confirmed;
                const editableNow   = canOfferRetro && isEditableBySelf(hora, hist);
                const correctedByOther = Boolean(hist?.performed_by && hist.performed_by !== user.id);

                return (
                  <div key={`${med.id}-${hora}`} style={{ background: bgColor, border: `1px solid ${color}22`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale }}>{med.nome}</p>
                            <TreatmentBadge med={med} scale={scale} showProgress />
                          </div>
                          <p style={{ color, fontWeight: 800, fontSize: 13 * scale }}>{hora}</p>
                        </div>
                        <p style={{ color: T.muted, fontSize: 12 * scale }}>{med.dosagem} · {med.unidade}</p>
                        {confirmed && hist.atraso_minutos > 0 && (
                          <p style={{ color: C.amber, fontSize: 11 * scale, marginTop: 2 }}>⏱ Atraso: {hist.atraso_minutos} min</p>
                        )}
                        {confirmed && !hist.atraso_minutos && (
                          <p style={{ color: C.green, fontSize: 11 * scale, marginTop: 2 }}>✓ Confirmado no horário</p>
                        )}
                      </div>
                    </div>

                    {/* Indicador de transparência: dose confirmada/corrigida por um cuidador */}
                    {hist?.performed_by && (
                      <CaregiverBadge
                        correctedByOther={correctedByOther}
                        isRetroactive={hist.is_retroactive}
                        correctedAt={hist.corrected_at}
                        scale={scale}
                      />
                    )}

                    {/* Correção retroativa: dose não confirmada em dia passado (ou hoje já vencido) */}
                    {canOfferRetro && editableNow && (
                      <button
                        onClick={() => setRetroTarget({ med, hora })}
                        style={{
                          marginTop: 8, width: '100%', padding: '9px 10px', borderRadius: 10,
                          background: 'rgba(59,130,246,.1)', color: '#3b82f6',
                          border: '1px solid rgba(59,130,246,.3)', fontWeight: 700, fontSize: 12 * scale,
                          cursor: 'pointer',
                        }}
                      >
                        🕐 Confirmar retroativamente
                      </button>
                    )}
                    {canOfferRetro && !editableNow && (
                      <p style={{ marginTop: 8, color: T.muted, fontSize: 10.5 * scale, textAlign: 'center' }}>
                        {correctedByOther
                          ? 'Este registro foi feito por um cuidador'
                          : 'Prazo de 24 horas para correção expirado'}
                      </p>
                    )}

                    {/* Observação da dose */}
                    {obsEntry && (
                      <div style={{ marginTop: 8, background: T.bg3, borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ color: T.sub, fontSize: 11 * scale }}>📝 {obsEntry.observation}</p>
                      </div>
                    )}
                    {!isFuture && !obsTarget && (
                      <button
                        onClick={() => setObsTarget({ med_id: med.id, hora, date: dateStr, hist_id: hist?.id })}
                        style={{ marginTop: 8, background: 'none', color: T.muted, border: `1px dashed ${T.bdr}`, borderRadius: 8, padding: '6px 10px', fontSize: 11 * scale, width: '100%' }}
                      >
                        + Adicionar observação
                      </button>
                    )}
                    {obsTarget?.med_id === med.id && obsTarget?.hora === hora && (
                      <div style={{ marginTop: 8 }}>
                        <textarea
                          rows={2}
                          autoFocus
                          value={obsText}
                          onChange={e => setObsText(e.target.value)}
                          placeholder="Como você se sentiu? Ex: leve tontura após tomar"
                          style={{ width: '100%', background: T.inp, border: `1px solid ${T.inpB}`, borderRadius: 10, padding: 10, color: T.txt, fontSize: 12 * scale, resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            onClick={async () => {
                              if (!obsText.trim()) return;
                              await ObsDB.add({ user_id: user.id, med_id: med.id, hora, date: dateStr, hist_id: hist?.id, observation: obsText });
                              setObsText(''); setObsTarget(null);
                              window.location.reload();
                            }}
                            style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 12 * scale, border: 'none' }}
                          >Salvar</button>
                          <button onClick={() => { setObsTarget(null); setObsText(''); }} style={{ padding: '8px 12px', borderRadius: 8, background: T.bg3, color: T.sub, fontSize: 12 * scale, border: 'none' }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Uso sob demanda (SOS) registrado neste dia */}
              {sosUsages.map(({ med, hist }) => (
                <div key={`sos-${hist.id}`} style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 14, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>✓</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale }}>{med.nome}</p>
                          <TreatmentBadge med={med} scale={scale} />
                        </div>
                        <p style={{ color: '#3b82f6', fontWeight: 800, fontSize: 13 * scale }}>{hist.hora}</p>
                      </div>
                      <p style={{ color: T.muted, fontSize: 12 * scale }}>{med.dosagem} · {med.unidade}</p>
                      {hist.motivo && <p style={{ color: T.sub, fontSize: 11 * scale, marginTop: 2 }}>📝 {hist.motivo}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Anotações */}
          {(filter === 'todos' || filter === 'anotacoes') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Anotações</p>
                <button onClick={() => onAddNote(dateStr)} style={{ color: C.blue, background: 'none', border: `1px solid rgba(59,130,246,.3)`, borderRadius: 99, padding: '4px 10px', fontSize: 11 * scale, fontWeight: 700 }}>+ Nova</button>
              </div>
              {dayNotes.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhuma anotação para este dia</p>
              )}
              {dayNotes.map(note => (
                <div key={note.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${T.bdr}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale }}>{note.title}</p>
                      {note.time && <p style={{ color: T.muted, fontSize: 11 * scale }}>🕐 {note.time}</p>}
                      {note.description && <p style={{ color: T.sub, fontSize: 13 * scale, marginTop: 4, lineHeight: 1.5 }}>{note.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                      <button onClick={() => onEditNote(note)} style={{ width: 28, height: 28, borderRadius: 8, background: T.bg3, color: T.sub, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                      <button onClick={() => onDeleteNote(note.id)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,.1)', color: C.red, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Eventos */}
          {(filter === 'todos' || filter === 'eventos') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Eventos de Saúde</p>
                <button onClick={() => onAddEvent(dateStr)} style={{ color: C.blue, background: 'none', border: `1px solid rgba(59,130,246,.3)`, borderRadius: 99, padding: '4px 10px', fontSize: 11 * scale, fontWeight: 700 }}>+ Novo</button>
              </div>
              {dayEvents.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhum evento para este dia</p>
              )}
              {dayEvents.map(ev => (
                <div key={ev.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid rgba(59,130,246,.2)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{EVENT_ICONS[ev.type]}</span>
                        <span style={{ color: C.blue, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>{EVENT_LABELS[ev.type]}</span>
                      </div>
                      <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale }}>{ev.title}</p>
                      {ev.time     && <p style={{ color: T.muted, fontSize: 11 * scale }}>🕐 {ev.time}</p>}
                      {ev.doctor   && <p style={{ color: T.sub,  fontSize: 12 * scale }}>👤 {ev.doctor}</p>}
                      {ev.location && <p style={{ color: T.sub,  fontSize: 12 * scale }}>📍 {ev.location}</p>}
                      {ev.description && <p style={{ color: T.muted, fontSize: 12 * scale, marginTop: 4 }}>{ev.description}</p>}
                    </div>
                    <button onClick={() => onDeleteEvent(ev.id)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,.1)', color: C.red, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de correção retroativa — motivo opcional (o próprio usuário está corrigindo) */}
      {retroTarget && (
        <RetroactiveConfirmModal
          dose={{
            nome: retroTarget.med.nome,
            dosagem: retroTarget.med.dosagem,
            hora: retroTarget.hora,
            date: dateStr,
          }}
          requireReason={false}
          onConfirm={handleRetroConfirm}
          onClose={() => setRetroTarget(null)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}

// ─── CalendarScreen principal ─────────────────────────────────────────────────
export function CalendarScreen({ T, scale }) {
  const { user, history, meds, confirmDoseRetroactive } = useApp();
  const { role } = usePermissions();

  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selected,  setSelected]  = useState(null);
  const [notes,     setNotes]     = useState([]);
  const [events,    setEvents]    = useState([]);
  const [obs,       setObs]       = useState([]);
  const [search,    setSearch]    = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Modais
  const [noteModal,  setNoteModal]  = useState(null);  // { date, note? }
  const [eventModal, setEventModal] = useState(null);  // { date, event? }

  // ── Carrega dados do mês ────────────────────────────────────────────────────
  const loadMonth = useCallback(async (year, month) => {
    if (!user) return;
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = getDaysInMonth(year, month);
    const to   = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
    const [n, e, o] = await Promise.all([
      NotesDB.list(user.id, from, to),
      EventsDB.list(user.id, from, to),
      ObsDB.list(user.id, from, to),
    ]);
    setNotes(n);
    setEvents(e);
    setObs(o);
  }, [user]);

  useEffect(() => { loadMonth(viewYear, viewMonth); }, [viewYear, viewMonth, loadMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Indicadores por dia ─────────────────────────────────────────────────────
  const getDayIndicator = (dateStr) => {
    const dayHist   = history.filter(h => new Date(h.created_at).toISOString().slice(0, 10) === dateStr);
    const dayNotes  = notes.filter(n => n.date === dateStr);
    const dayEvents = events.filter(e => e.date === dateStr);
    const isPast    = dateStr < today();
    const isToday   = dateStr === today();

    if (dayEvents.length > 0) return 'event';
    if (dayNotes.length  > 0) return 'note';
    if (isPast || isToday) {
      // Apenas medicamentos com agenda (contínuo/temporário) contam para o indicador de adesão do dia
      const activeMeds  = meds.filter(m => m.ativo && (m.treatment_type || 'continuous') !== 'sos');
      if (activeMeds.length === 0) return null;
      const confirmed = dayHist.filter(h => h.status === 'confirmed').length;
      const total     = activeMeds.reduce((acc, m) => acc + (m.horarios?.length || 1), 0);
      if (confirmed === 0 && isPast && !isToday) return 'missed';
      if (confirmed === total) return 'done';
      if (confirmed > 0)       return 'partial';
      return isToday ? null : 'missed';
    }
    return null;
  };

  const indicatorColor = { done: C.green, partial: C.amber, missed: C.red, note: C.blue, event: '#8b5cf6' };
  const indicatorDot   = { done: '●', partial: '◐', missed: '●', note: '●', event: '●' };

  // ── Resumo mensal ───────────────────────────────────────────────────────────
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthHist   = history.filter(h => new Date(h.created_at).toISOString().startsWith(monthPrefix));
  const monthConf   = monthHist.filter(h => h.status === 'confirmed').length;
  const monthLate   = monthHist.filter(h => h.atraso_minutos > 0).length;
  const monthMissed = monthHist.filter(h => h.status === 'missed').length;
  const monthTotal  = monthConf + monthMissed;
  const monthAdh    = monthTotal > 0 ? Math.round((monthConf / monthTotal) * 100) : 0;
  const monthNotes  = notes.length;
  const monthEvents = events.filter(e => e.type === 'consulta').length;
  const monthSOS    = monthHist.filter(h => {
    const med = meds.find(m => m.id === h.med_id);
    return med?.treatment_type === 'sos';
  }).length;

  // ── Próximos eventos ────────────────────────────────────────────────────────
  const upcomingEvents = events.filter(e => e.date >= today()).slice(0, 3);

  // ── Handlers CRUD ───────────────────────────────────────────────────────────
  const handleSaveNote = async (data) => {
    if (noteModal.note) {
      await NotesDB.update(noteModal.note.id, { ...data, updated_at: new Date().toISOString() });
    } else {
      await NotesDB.add({ ...data, user_id: user.id });
    }
    setNoteModal(null);
    await loadMonth(viewYear, viewMonth);
  };

  const handleDeleteNote = async (id) => {
    await NotesDB.delete(id);
    await loadMonth(viewYear, viewMonth);
  };

  const handleSaveEvent = async (data) => {
    if (eventModal.event) {
      await EventsDB.update(eventModal.event.id, data);
    } else {
      await EventsDB.add({ ...data, user_id: user.id });
    }
    setEventModal(null);
    await loadMonth(viewYear, viewMonth);
  };

  const handleDeleteEvent = async (id) => {
    await EventsDB.delete(id);
    await loadMonth(viewYear, viewMonth);
  };

  // ── Pesquisa ────────────────────────────────────────────────────────────────
  const searchResults = search.length > 1 ? [
    ...notes.filter(n  => n.title?.toLowerCase().includes(search.toLowerCase()) || n.description?.toLowerCase().includes(search.toLowerCase())),
    ...events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()) || e.doctor?.toLowerCase().includes(search.toLowerCase())),
  ] : [];

  // ── Renderização do calendário ──────────────────────────────────────────────
  const firstWeekday = getFirstWeekday(viewYear, viewMonth);
  const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
  const cells        = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="anim-fadeUp">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900 }}>Calendário</h2>
        <button onClick={() => setShowSearch(s => !s)} style={{ width: 40, height: 40, borderRadius: 12, background: T.bg1, border: `1px solid ${T.bdr}`, color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔍</button>
      </div>

      {/* Pesquisa */}
      {showSearch && (
        <div style={{ marginBottom: 14 }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar notas, eventos, medicamentos…"
            style={{ width: '100%', background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale }}
          />
          {searchResults.length > 0 && (
            <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 14, marginTop: 8, overflow: 'hidden' }}>
              {searchResults.map((r, i) => (
                <div key={r.id} onClick={() => { setSelected(r.date); setShowSearch(false); setSearch(''); }} style={{ padding: '12px 14px', borderBottom: i < searchResults.length - 1 ? `1px solid ${T.bdr}` : 'none', cursor: 'pointer' }}>
                  <p style={{ color: T.txt, fontWeight: 600, fontSize: 13 * scale }}>{r.title}</p>
                  <p style={{ color: T.muted, fontSize: 11 * scale }}>{r.date} {r.type ? `· ${EVENT_LABELS[r.type]}` : '· Nota'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mini-calendário */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 16, marginBottom: 14 }}>
        {/* Nav mês */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 800 }}>{MONTHS[viewMonth]}</p>
            <p style={{ color: T.muted, fontSize: 12 * scale }}>{viewYear}</p>
          </div>
          <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>

        {/* Dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {WEEK_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', color: T.muted, fontSize: 10 * scale, fontWeight: 700, padding: '2px 0' }}>{d}</div>
          ))}
        </div>

        {/* Células */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />;
            const dateStr   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday   = dateStr === today();
            const isSel     = dateStr === selected;
            const indicator = getDayIndicator(dateStr);

            return (
              <button
                key={dateStr}
                onClick={() => setSelected(isSel ? null : dateStr)}
                style={{
                  padding: '6px 2px 4px',
                  borderRadius: 10,
                  border: 'none',
                  background: isSel ? '#3b82f6' : isToday ? 'rgba(59,130,246,.15)' : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  cursor: 'pointer',
                  outline: isToday && !isSel ? `2px solid rgba(59,130,246,.4)` : 'none',
                }}
              >
                <span style={{ color: isSel ? '#fff' : isToday ? C.blue : T.txt, fontSize: 13 * scale, fontWeight: isToday || isSel ? 900 : 500, lineHeight: 1 }}>{day}</span>
                {indicator && (
                  <span style={{ fontSize: 5, color: isSel ? '#fff' : indicatorColor[indicator], lineHeight: 1 }}>{indicatorDot[indicator]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { color: C.green,   label: 'Tomado' },
            { color: C.amber,   label: 'Parcial' },
            { color: C.red,     label: 'Perdido' },
            { color: C.blue,    label: 'Nota' },
            { color: '#8b5cf6', label: 'Evento' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
              <span style={{ color: T.muted, fontSize: 10 * scale }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Próximos eventos */}
      {upcomingEvents.length > 0 && (
        <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
          <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 700, marginBottom: 10 }}>📅 Próximos eventos</p>
          {upcomingEvents.map(ev => (
            <div key={ev.id} onClick={() => setSelected(ev.date)} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.bdr}`, cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>{EVENT_ICONS[ev.type]}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: T.txt, fontSize: 13 * scale, fontWeight: 600 }}>{ev.title}</p>
                <p style={{ color: T.muted, fontSize: 11 * scale }}>{new Date(ev.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{ev.time ? ` · ${ev.time}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botões de ação rápida */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setNoteModal({ date: today() })}
          style={{ padding: '14px', borderRadius: 14, background: T.bg1, border: `1px solid ${T.bdr}`, color: T.txt, fontWeight: 700, fontSize: 13 * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          📝 Nova anotação
        </button>
        <button
          onClick={() => setEventModal({ date: today() })}
          style={{ padding: '14px', borderRadius: 14, background: T.bg1, border: `1px solid ${T.bdr}`, color: T.txt, fontWeight: 700, fontSize: 13 * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          📅 Novo evento
        </button>
      </div>

      {/* Resumo mensal */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
        <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 700, marginBottom: 14 }}>📊 Resumo — {MONTHS[viewMonth]} {viewYear}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Adesão',    value: `${monthAdh}%`, color: monthAdh >= 80 ? C.green : C.amber },
            { label: 'Tomadas',   value: monthConf,      color: C.green  },
            { label: 'Atrasos',   value: monthLate,      color: C.amber  },
            { label: 'Perdidas',  value: monthMissed,    color: C.red    },
            { label: 'Anotações', value: monthNotes,     color: C.blue   },
            { label: 'Consultas', value: monthEvents,    color: '#8b5cf6'},
            { label: 'Uso SOS',   value: monthSOS,        color: '#3b82f6'},
          ].map(s => (
            <div key={s.label} style={{ background: T.bg2, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ color: s.color, fontSize: 22 * scale, fontWeight: 900, lineHeight: 1 }}>{s.value}</p>
              <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 3 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      {selected && (
        <DayPanel
          dateStr={selected}
          history={history}
          meds={meds}
          notes={notes}
          events={events}
          obs={obs}
          user={user}
          role={role}
          onAddNote={(date) => setNoteModal({ date })}
          onEditNote={(note) => setNoteModal({ date: note.date, note })}
          onDeleteNote={handleDeleteNote}
          onAddEvent={(date) => setEventModal({ date })}
          onDeleteEvent={handleDeleteEvent}
          onConfirmRetroactive={confirmDoseRetroactive}
          onClose={() => setSelected(null)}
          T={T}
          scale={scale}
        />
      )}

      {/* Modais */}
      {noteModal && (
        <NoteModal
          date={noteModal.date}
          note={noteModal.note}
          onSave={handleSaveNote}
          onClose={() => setNoteModal(null)}
          T={T}
          scale={scale}
        />
      )}
      {eventModal && (
        <EventModal
          date={eventModal.date}
          event={eventModal.event}
          onSave={handleSaveEvent}
          onClose={() => setEventModal(null)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}
