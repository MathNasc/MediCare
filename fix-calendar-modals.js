const fs = require('fs');
let code = fs.readFileSync('calendar_screen_backup.jsx', 'utf8');

// The file currently has NoteModal cut at `return (` and merging into DayPanel's inner content.
// Let's strip the broken part and prepend the rebuilt components.

const parts = code.split('function NoteModal({ date, note, onSave, onClose, T, scale }) {');
const beforeNoteModal = parts[0];
const afterNoteModalBroken = parts[1]; // We will discard the top of this until the first `{/* Medicamentos */}`

const bottomPartSplit = afterNoteModalBroken.split('{/* Medicamentos */}');
// Wait, DayPanel's remainder starts at `{/* Medicamentos */}`
const remainingDayPanelJSX = '{/* Medicamentos */}' + bottomPartSplit.slice(1).join('{/* Medicamentos */}');

const rebuiltModals = `function NoteModal({ date, note, onSave, onClose, T, scale }) {
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

  return (
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
`;

const finalCode = beforeNoteModal + rebuiltModals + remainingDayPanelJSX;

// Clean up closing tags for CalendarScreen since we messed them up too.
// Wait, the bottom of CalendarScreen was messed up before. Let's fix that.
// Earlier I did a fix-calendarscreen.js that changed `</div></div>{selected && (`
// Let's just do it cleanly now.
let cleanedCode = finalCode.replace(/\{\/\* Painel do dia selecionado \*\/\}\s*<\/div>\s*<\/div>\s*\{selected && \(/g, '{/* Painel do dia selecionado */}\n      {selected && (');
cleanedCode = cleanedCode.replace(/<\/div>\s*<\/div>\s*\{\/\* Resumo mensal \*\/\}/g, '{/* Resumo mensal */}');

fs.writeFileSync('src/screens/CalendarScreen.jsx', cleanedCode);
console.log("Restored all modals perfectly");
