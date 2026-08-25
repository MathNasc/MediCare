const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

// I will extract everything BEFORE function NoteModal
const topPart = code.split('function NoteModal')[0];

// I will extract everything AFTER CalendarScreen principal
const bottomPart = '\n// ─── CalendarScreen principal ' + code.split('// ─── CalendarScreen principal ')[1];

// Now I will reconstruct the Modals cleanly
const rebuilt = `function NoteModal({ date, note, onSave, onClose, T, scale }) {
  const [currentDate, setCurrentDate] = useState(note?.date || date);
  const [title, setTitle] = useState(note?.title || '');
  const [description, setDescription] = useState(note?.description || '');
  const [time, setTime] = useState(note?.time || '');

  const inp = { background: T.inp, border: \`1.5px solid \${T.inpB}\`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale, width: '100%' };

  return (
    <div className="anim-fadeUp" style={{ position: 'fixed', inset: 0, background: T.bg1, zIndex: 300, overflowY: 'auto' }}>
      <div className="main-container" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 16px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>{note ? 'Editar Anotação' : 'Nova Anotação'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 15 * scale, fontWeight: 700 }}>Cancelar</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} style={inp} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
          <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} style={inp} />
          <textarea rows={4} placeholder="Descrição..." value={description} onChange={e => setDescription(e.target.value)} style={inp} />
          <button onClick={() => { if(title) onSave({ ...note, date: currentDate, title, description, time }); onClose(); }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#3b82f6', color: '#fff', fontWeight: 800, border: 'none', fontSize: 15 * scale, marginTop: 10 }}>Salvar Anotação</button>
        </div>
      </div>
    </div>
  );
}

function EventModal({ date, event, onSave, onClose, T, scale }) {
  const [currentDate, setCurrentDate] = useState(event?.date || date);
  const [type, setType] = useState(event?.type || 'consulta');
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [time, setTime] = useState(event?.time || '');
  const [doctor, setDoctor] = useState(event?.doctor || '');
  const [location, setLocation] = useState(event?.location || '');
  
  const inp = { background: T.inp, border: \`1.5px solid \${T.inpB}\`, borderRadius: 12, padding: '12px 14px', color: T.txt, fontSize: 14 * scale, width: '100%' };

  return (
    <div className="anim-fadeUp" style={{ position: 'fixed', inset: 0, background: T.bg1, zIndex: 300, overflowY: 'auto' }}>
      <div className="main-container" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 16px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>{event ? 'Editar Evento' : 'Novo Evento'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 15 * scale, fontWeight: 700 }}>Cancelar</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={inp}>
            <option value="consulta">👨‍⚕️ Consulta</option>
            <option value="exame">🧪 Exame</option>
            <option value="procedimento">💉 Procedimento</option>
            <option value="outro">📌 Outro</option>
          </select>
          <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} style={inp} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
          <input placeholder="Título (ex: Consulta Cardiologista)" value={title} onChange={e => setTitle(e.target.value)} style={inp} />
          <input placeholder="Médico / Especialista" value={doctor} onChange={e => setDoctor(e.target.value)} style={inp} />
          <input placeholder="Local" value={location} onChange={e => setLocation(e.target.value)} style={inp} />
          <textarea rows={3} placeholder="Observações..." value={description} onChange={e => setDescription(e.target.value)} style={inp} />
          <button onClick={() => { if(title) onSave({ ...event, type, date: currentDate, title, description, time, doctor, location }); onClose(); }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#3b82f6', color: '#fff', fontWeight: 800, border: 'none', fontSize: 15 * scale, marginTop: 10 }}>Salvar Evento</button>
        </div>
      </div>
    </div>
  );
}

function DayPanel({
  dateStr, history, meds, notes, events, obs, user, role,
  onAddNote, onEditNote, onDeleteNote, onAddEvent, onEditEvent, onDeleteEvent,
  onConfirmRetroactive, onAddObs, onClose, T, scale,
}) {
  const [filter, setFilter] = useState('todos');
  const [obsText, setObsText] = useState('');
  const [obsTarget, setObsTarget] = useState(null);
  const [retroTarget, setRetroTarget] = useState(null);
  
  useBackButton(obsTarget !== null, () => setObsTarget(null));
  useBackButton(retroTarget !== null, () => setRetroTarget(null));

  const date = new Date(dateStr + 'T12:00:00');
  const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isFuture = dateStr > today();
  const nowTime = getLocalTime();

  const dayHistory = history.filter(h => getLocalDateISO(new Date(h.created_at)) === dateStr);

  const scheduledDoses = meds
    .filter(m => m.ativo && (m.treatment_type || 'continuous') !== 'sos')
    .flatMap(med => {
      return (med.horarios || []).map(hora => {
        const hist = dayHistory.find(h => h.med_id === med.id && h.hora === hora);
        const obsEntry = obs.find(o => o.med_id === med.id && o.hora === hora && o.date === dateStr);
        return { med, hora, hist, obs: obsEntry };
      });
    }).sort((a,b) => a.hora.localeCompare(b.hora));

  const sosUsages = dayHistory
    .filter(h => {
       const m = meds.find(mx => mx.id === h.med_id);
       return m && (m.treatment_type === 'sos');
    })
    .map(hist => {
       const med = meds.find(mx => mx.id === hist.med_id);
       return { med, hist };
    });

  const dayNotes = notes.filter(n => n.date === dateStr);
  const dayEvents = events.filter(e => e.date === dateStr && e.type !== 'estoque');
  const dayStock = events.filter(e => e.date === dateStr && e.type === 'estoque');

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'medicamentos', label: '💊 Medicamentos' },
    { id: 'anotacoes', label: '📝 Notas' },
    { id: 'eventos', label: '📅 Consultas/Eventos' },
    { id: 'estoque', label: '📦 Estoque' },
  ];

  const handleRetroConfirm = async (reason) => {
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

  const isEditableBySelf = (hora, hist) => {
    if (!hist) return true;
    if (hist.performed_by && hist.performed_by !== user.id) return false;
    if (hist.status === 'confirmed') return false;
    return true;
  };

  return (
    <>
      <div className="anim-fadeUp" style={{ position: 'fixed', inset: 0, background: T.bg1, zIndex: 300, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px', borderBottom: \`1px solid \${T.bdr}\`, position: 'sticky', top: 0, background: T.bg1, zIndex: 10 }}>
          <div className="main-container" style={{ padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>{isFuture ? 'Programado' : 'Histórico'}</p>
                <h3 style={{ color: T.txt, fontSize: 17 * scale, fontWeight: 900, textTransform: 'capitalize' }}>{label}</h3>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, color: T.sub, fontSize: 18, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
        </div>

        <div className="main-container" style={{ padding: '16px 16px 96px' }}>
          {/* Medicamentos */}
          {(filter === 'todos' || filter === 'medicamentos') && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Medicamentos</p>
              {scheduledDoses.length === 0 && sosUsages.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhum medicamento ativo</p>
              )}
              {scheduledDoses.map(({ med, hora, hist, obs: obsEntry }) => {
                const confirmed = hist?.status === 'confirmed';
                const isDoseFuture = isFuture || (dateStr === today() && hora > nowTime);
                const isPendingOrNone = !hist || hist.status === 'pending';
                const missed    = isPendingOrNone && !isDoseFuture;
                const color     = confirmed ? C.green : missed ? C.red : T.muted;
                const icon      = confirmed ? '✓' : missed ? '✕' : '○';
                const bgColor   = confirmed ? 'rgba(34,197,94,.08)' : missed ? 'rgba(239,68,68,.08)' : T.bg2;

                const canOfferRetro = !isDoseFuture && !confirmed;
                const editableNow   = canOfferRetro && isEditableBySelf(hora, hist);
                const correctedByOther = Boolean(hist?.performed_by && hist.performed_by !== user.id);

                return (
                  <div key={\`\${med.id}-\${hora}\`} style={{ background: bgColor, border: \`1px solid \${color}22\`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: \`\${color}20\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{icon}</div>
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

                    {hist?.performed_by && (
                      <CaregiverBadge
                        correctedByOther={correctedByOther}
                        isRetroactive={hist.is_retroactive}
                        correctedAt={hist.corrected_at}
                        reason={hist.motivo_correcao}
                        scale={scale}
                      />
                    )}

                    {canOfferRetro && editableNow && (
                      <button
                        onClick={() => setRetroTarget({ med, hora })}
                        style={{ marginTop: 8, width: '100%', padding: '9px 10px', borderRadius: 10, background: 'rgba(59,130,246,.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,.3)', fontWeight: 700, fontSize: 12 * scale, cursor: 'pointer' }}
                      >
                        🕐 Confirmar retroativamente
                      </button>
                    )}
                    {canOfferRetro && !editableNow && (
                      <p style={{ marginTop: 8, color: T.muted, fontSize: 10.5 * scale, textAlign: 'center' }}>
                        {correctedByOther ? 'Este registro foi feito por um cuidador' : 'Prazo de 24 horas para correção expirado'}
                      </p>
                    )}

                    {obsEntry && (
                      <div style={{ marginTop: 8, background: T.bg3, borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ color: T.sub, fontSize: 11 * scale }}>📝 {obsEntry.observation}</p>
                      </div>
                    )}
                    {!isFuture && !obsTarget && (
                      <button
                        onClick={() => setObsTarget({ med_id: med.id, hora, date: dateStr, hist_id: hist?.id })}
                        style={{ marginTop: 8, background: 'none', color: T.muted, border: \`1px dashed \${T.bdr}\`, borderRadius: 8, padding: '6px 10px', fontSize: 11 * scale, width: '100%' }}
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
                          style={{ width: '100%', background: T.inp, border: \`1px solid \${T.inpB}\`, borderRadius: 10, padding: 10, color: T.txt, fontSize: 12 * scale, resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            onClick={async () => {
                              if (!obsText.trim()) return;
                              try {
                                const newObs = await ObsDB.add({ user_id: user.id, med_id: med.id, hora, date: dateStr, hist_id: hist?.id || null, observation: obsText });
                                if (onAddObs) onAddObs(newObs);
                                setObsText(''); setObsTarget(null);
                              } catch (err) {
                                alert(err.message || 'Erro ao salvar observação');
                              }
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

              {sosUsages.map(({ med, hist }) => (
                <div key={\`sos-\${hist.id}\`} style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 14, padding: 14, marginBottom: 8 }}>
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
                <button onClick={() => onAddNote(dateStr)} style={{ color: C.blue, background: 'none', border: \`1px solid rgba(59,130,246,.3)\`, borderRadius: 99, padding: '4px 10px', fontSize: 11 * scale, fontWeight: 700 }}>+ Nova</button>
              </div>
              {dayNotes.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhuma anotação para este dia</p>
              )}
              {dayNotes.map(note => (
                <div key={note.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, marginBottom: 8, border: \`1px solid \${T.bdr}\` }}>
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

          {/* Eventos de Saúde */}
          {(filter === 'todos' || filter === 'eventos') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Eventos de Saúde</p>
                <button onClick={() => onAddEvent(dateStr)} style={{ color: C.blue, background: 'none', border: \`1px solid rgba(59,130,246,.3)\`, borderRadius: 99, padding: '4px 10px', fontSize: 11 * scale, fontWeight: 700 }}>+ Novo</button>
              </div>
              {dayEvents.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhum evento para este dia</p>
              )}
              {dayEvents.map(ev => (
                <div key={ev.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, marginBottom: 8, border: \`1px solid rgba(59,130,246,.2)\` }}>
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
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                      <button onClick={() => onEditEvent(ev)} style={{ width: 28, height: 28, borderRadius: 8, background: T.bg3, color: T.sub, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                      <button onClick={() => onDeleteEvent(ev.id)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,.1)', color: C.red, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estoque */}
          {(filter === 'todos' || filter === 'estoque') && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>📦 Estoque</p>
              {dayStock.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13 * scale }}>Nenhuma reposição de estoque neste dia</p>
              )}
              {dayStock.map(ev => (
                <div key={ev.id} style={{ background: 'rgba(34,197,94,.06)', borderRadius: 14, padding: 14, marginBottom: 8, border: '1px solid rgba(34,197,94,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📦</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale }}>{ev.title}</p>
                      {ev.time && <p style={{ color: T.muted, fontSize: 11 * scale }}>🕐 {ev.time}</p>}
                      {ev.description && <p style={{ color: T.sub, fontSize: 12 * scale, marginTop: 4, lineHeight: 1.5 }}>{ev.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {retroTarget && (
        <RetroactiveConfirmModal
          dose={{ nome: retroTarget.med.nome, dosagem: retroTarget.med.dosagem, hora: retroTarget.hora, date: dateStr }}
          requireReason={false}
          onConfirm={handleRetroConfirm}
          onClose={() => setRetroTarget(null)}
          T={T}
          scale={scale}
        />
      )}
    </>
  );
}
`;

fs.writeFileSync('src/screens/CalendarScreen.jsx', topPart + rebuilt + bottomPart);
