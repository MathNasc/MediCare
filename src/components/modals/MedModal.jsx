'use client';
import { useState } from 'react';
import { PILL_COLORS, UNITS, WEEK_S, C } from '@/lib/theme';

export function MedModal({ med, onSave, onClose, T, scale = 1 }) {
  const [form, setForm] = useState(med || {
    nome: '', dosagem: '', quantidade: 30,
    unidade: 'comprimido', cor: PILL_COLORS[0],
    observacoes: '', ativo: true,
  });

  // When editing, restore saved horarios; when adding, start with a single blank slot
  const [horarios, setHorarios] = useState(
    med?.horarios && med.horarios.length > 0 ? med.horarios : ['08:00']
  );

  // Restore saved dias_semana when editing
  const [dias, setDias] = useState(
    med?.dias_semana && med.dias_semana.length > 0 ? med.dias_semana : [1, 2, 3, 4, 5, 6, 7]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDia = (d) =>
    setDias((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]);

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`,
    borderRadius: 12, padding: '13px 15px',
    color: T.txt, fontSize: 15 * scale, width: '100%',
  };

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={med ? 'Editar medicamento' : 'Novo medicamento'}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(16px)', zIndex: 300,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="anim-fadeUp"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg1, borderRadius: '28px 28px 0 0',
          width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflowY: 'auto', paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: `1px solid ${T.bdr}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800 }}>
            {med ? 'Editar medicamento' : 'Novo medicamento'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: T.bg3, color: T.sub, fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Color picker */}
          <p style={{
            color: T.sub, fontSize: 11 * scale, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8,
          }}>Cor</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {PILL_COLORS.map((cor) => (
              <button
                key={cor}
                onClick={() => set('cor', cor)}
                aria-label={`Cor ${cor}`}
                aria-pressed={form.cor === cor}
                style={{
                  width: 36, height: 36, borderRadius: 10, background: cor,
                  border: form.cor === cor ? '3px solid #fff' : '3px solid transparent',
                  outline: form.cor === cor ? `2px solid ${cor}` : 'none',
                  transform: form.cor === cor ? 'scale(1.18)' : 'scale(1)',
                  transition: 'all .15s',
                  boxShadow: form.cor === cor ? `0 0 12px ${cor}90` : 'none',
                }}
              />
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>
                Nome *
              </label>
              <input style={inp} placeholder="Nome do medicamento"
                value={form.nome} onChange={(e) => set('nome', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Dosagem</label>
                <input style={inp} placeholder="500mg"
                  value={form.dosagem} onChange={(e) => set('dosagem', e.target.value)} />
              </div>
              <div>
                <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Qtd.</label>
                <input type="number" min="0" style={inp}
                  value={form.quantidade} onChange={(e) => set('quantidade', +e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Unidade</label>
              <select style={inp} value={form.unidade} onChange={(e) => set('unidade', e.target.value)}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Observações</label>
              <textarea rows={2} style={{ ...inp, resize: 'none' }}
                placeholder="Tomar com água, em jejum…"
                value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
            </div>
          </div>

          {/* Horários */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Horários</p>
              <button
                onClick={() => setHorarios((h) => [...h, '12:00'])}
                style={{ color: C.blue, border: `1px solid rgba(59,130,246,.35)`, borderRadius: 99, padding: '4px 12px', fontSize: 12 * scale, fontWeight: 700 }}
              >+ Adicionar</button>
            </div>
            {horarios.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="time" style={{ ...inp, flex: 1 }}
                  value={h} onChange={(e) => setHorarios((hs) => hs.map((x, idx) => idx === i ? e.target.value : x))} />
                {horarios.length > 1 && (
                  <button
                    onClick={() => setHorarios((hs) => hs.filter((_, idx) => idx !== i))}
                    style={{ width: 44, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: C.red, fontSize: 18 }}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* Dias */}
          <div style={{ marginTop: 16, marginBottom: 22 }}>
            <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Dias da semana</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {WEEK_S.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDia(i + 1)}
                  aria-pressed={dias.includes(i + 1)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 10,
                    fontSize: 12 * scale, fontWeight: 700, border: 'none',
                    background: dias.includes(i + 1) ? C.blue : T.bg3,
                    color: dias.includes(i + 1) ? '#fff' : T.sub,
                    transition: 'all .15s',
                  }}
                >{d}</button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onSave(form, horarios, dias)}
            style={{
              width: '100%', padding: '17px', borderRadius: 14,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: '#fff', fontWeight: 800, fontSize: 16 * scale, border: 'none',
              boxShadow: '0 4px 20px rgba(59,130,246,.35)', letterSpacing: '.3px',
            }}
          >
            {med ? 'Salvar alterações' : 'Adicionar medicamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
