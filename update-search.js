const fs = require('fs');
const code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

const regex = /const searchResults = search\.length > 1 \? \[.*?\] : \[\];/s;

const replacement = `const searchResults = search.length > 1 ? (() => {
    const term = search.toLowerCase();
    const res = [];
    
    notes.filter(n => n.title?.toLowerCase().includes(term) || n.description?.toLowerCase().includes(term))
         .forEach(n => res.push({ id: \`note-\${n.id}\`, date: n.date, title: n.title, sub: 'Nota' }));
         
    events.filter(e => e.title?.toLowerCase().includes(term) || e.doctor?.toLowerCase().includes(term) || e.description?.toLowerCase().includes(term) || e.location?.toLowerCase().includes(term))
          .forEach(e => res.push({ id: \`ev-\${e.id}\`, date: e.date, title: e.title, sub: EVENT_LABELS[e.type] || 'Evento' }));
          
    obs.filter(o => o.observation?.toLowerCase().includes(term))
       .forEach(o => {
         const med = meds.find(m => m.id === o.med_id);
         res.push({ id: \`obs-\${o.id}\`, date: o.date, title: \`Obs: \${med?.nome || 'Medicamento'}\`, sub: 'Observação da dose' });
       });

    history.forEach(h => {
      const med = meds.find(m => m.id === h.med_id);
      if (med && med.nome.toLowerCase().includes(term)) {
        const dateStr = getLocalDateISO(new Date(h.created_at));
        if (!res.some(r => r.date === dateStr && r.title === med.nome)) {
          res.push({ id: \`hist-\${h.id}\`, date: dateStr, title: med.nome, sub: 'Registro de medicamento' });
        }
      }
    });

    return res.sort((a, b) => b.date.localeCompare(a.date));
  })() : [];`;

if (code.match(regex)) {
  fs.writeFileSync('src/screens/CalendarScreen.jsx', code.replace(regex, replacement));
  console.log("Replaced definition");
} else {
  console.log("Regex missed definition");
}
