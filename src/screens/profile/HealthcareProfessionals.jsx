import { useState, useEffect } from 'react';
import { ProfileDB } from '@/lib/profileDb';
import { C } from '@/lib/theme';

export function HealthcareProfessionals({ user, onBack, T, scale }) {
  const [profs, setProfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', specialty: '', phone: '', email: '', clinic: '', notes: '' });

  useEffect(() => { loadData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setProfs(await ProfileDB.listProfessionals(user.id));
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name || !form.specialty) return;
    await ProfileDB.addProfessional(user.id, form);
    setForm({ name: '', specialty: '', phone: '', email: '', clinic: '', notes: '' });
    loadData();
  };

  const handleRemove = async (id) => {
    await ProfileDB.deleteProfessional(id);
    loadData();
  };

  const inp = { background: T.inp, border: `1px solid ${T.inpB}`, borderRadius: 10, padding: '10px', color: T.txt, fontSize: 14 * scale, width: '100%', marginBottom: 10 };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Meus Profissionais</p>
      </div>

      {profs.map(p => (
        <div key={p.id} style={{ background: T.bg1, padding: 16, borderRadius: 16, border: `1px solid ${T.bdr}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700 }}>{p.name}</p>
              <p style={{ color: T.sub, fontSize: 14 * scale }}>{p.specialty}</p>
              {p.clinic && <p style={{ color: T.muted, fontSize: 13 * scale, marginTop: 4 }}>🏥 {p.clinic}</p>}
            </div>
            <button onClick={() => handleRemove(p.id)} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>Remover</button>
          </div>
          {p.phone && (
            <a href={`tel:${p.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(59,130,246,.1)', color: C.blue, padding: 12, borderRadius: 12, marginTop: 12, textDecoration: 'none', fontWeight: 600, fontSize: 15 * scale }}>
              <span>📞</span> Ligar para {p.phone}
            </a>
          )}
        </div>
      ))}

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}`, marginTop: 24, marginBottom: 40 }}>
        <h3 style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 16 }}>Adicionar Profissional</h3>
        <input placeholder="Nome (ex: Dr. João Silva)" style={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input placeholder="Especialidade (ex: Cardiologista)" style={inp} value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} />
        <input placeholder="Clínica / Hospital" style={inp} value={form.clinic} onChange={e => setForm({...form, clinic: e.target.value})} />
        <input type="tel" placeholder="Telefone" style={inp} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        <input type="email" placeholder="E-mail" style={inp} value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        <input placeholder="Observações (opcional)" style={inp} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        <button onClick={handleAdd} style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>Salvar Profissional</button>
      </div>
    </div>
  );
}
