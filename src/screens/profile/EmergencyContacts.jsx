import { useState, useEffect } from 'react';
import { ProfileDB } from '@/lib/profileDb';
import { C } from '@/lib/theme';

export function EmergencyContacts({ user, onBack, T, scale }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', relationship: '', phone: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setContacts(await ProfileDB.listEmergencyContacts(user.id));
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name || !form.phone) return;
    await ProfileDB.addEmergencyContact(user.id, { ...form, priority: contacts.length + 1 });
    setForm({ name: '', relationship: '', phone: '' });
    loadData();
  };

  const handleRemove = async (id) => {
    await ProfileDB.deleteEmergencyContact(id);
    loadData();
  };

  const inp = { background: T.inp, border: `1px solid ${T.inpB}`, borderRadius: 10, padding: '10px', color: T.txt, fontSize: 14 * scale, width: '100%', marginBottom: 10 };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Contatos de Emergência</p>
      </div>

      {contacts.map(c => (
        <div key={c.id} style={{ background: T.bg1, padding: 16, borderRadius: 16, border: `1px solid ${T.bdr}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700 }}>{c.name}</p>
              <p style={{ color: T.sub, fontSize: 13 * scale }}>{c.relationship}</p>
            </div>
            <button onClick={() => handleRemove(c.id)} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>Remover</button>
          </div>
          <a href={`tel:${c.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(34,197,94,.1)', color: C.green, padding: 12, borderRadius: 12, marginTop: 12, textDecoration: 'none', fontWeight: 600, fontSize: 15 * scale }}>
            <span>📞</span> Ligar para {c.phone}
          </a>
        </div>
      ))}

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}`, marginTop: 24, marginBottom: 40 }}>
        <h3 style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 16 }}>Adicionar Contato</h3>
        <input placeholder="Nome" style={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input placeholder="Parentesco (ex: Filho, Cônjuge)" style={inp} value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})} />
        <input type="tel" placeholder="Telefone" style={inp} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        <button onClick={handleAdd} style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>Salvar Contato</button>
      </div>
    </div>
  );
}
