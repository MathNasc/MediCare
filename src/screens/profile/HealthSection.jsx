import React, { useState, useEffect } from 'react';

import { ProfileDB } from '@/lib/profileDb';
import { C } from '@/lib/theme';

export function HealthSection({ user, onBack, T, scale }) {
  const [allergies, setAllergies] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState({ name: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const loadData = React.useCallback(async () => {
    const a = await ProfileDB.listAllergies(user.id);
    const c = await ProfileDB.listConditions(user.id);
    setAllergies(a);
    setConditions(c);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const _old = async () => {
    const a = await ProfileDB.listAllergies(user.id);
    const c = await ProfileDB.listConditions(user.id);
    setAllergies(a);
    setConditions(c);
    setLoading(false);
  };

  const handleAddAllergy = async () => {
    if (!newAllergy.trim()) return;
    await ProfileDB.addAllergy(user.id, newAllergy.trim());
    setNewAllergy('');
    loadData();
  };
  
  const handleRemoveAllergy = async (id) => {
    await ProfileDB.deleteAllergy(id);
    loadData();
  };

  const handleAddCondition = async () => {
    if (!newCondition.name.trim()) return;
    await ProfileDB.addCondition(user.id, { name: newCondition.name.trim(), notes: newCondition.notes.trim() });
    setNewCondition({ name: '', notes: '' });
    loadData();
  };

  const handleRemoveCondition = async (id) => {
    await ProfileDB.deleteCondition(id);
    loadData();
  };

  const inp = { background: T.inp, border: `1px solid ${T.inpB}`, borderRadius: 10, padding: '10px', color: T.txt, fontSize: 14 * scale, width: '100%', marginBottom: 10 };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>❤️ Saúde</p>
      </div>

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}`, marginBottom: 20 }}>
        <h3 style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 16 }}>Alergias</h3>
        {allergies.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bg2, padding: '10px 14px', borderRadius: 10, marginBottom: 8 }}>
            <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 500 }}>{a.name}</p>
            <button onClick={() => handleRemoveAllergy(a.id)} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        ))}
        {allergies.length === 0 && <p style={{ color: T.muted, fontSize: 13 * scale, marginBottom: 10 }}>Nenhuma alergia cadastrada.</p>}
        
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input placeholder="Nova alergia..." style={{...inp, marginBottom: 0}} value={newAllergy} onChange={e => setNewAllergy(e.target.value)} />
          <button onClick={handleAddAllergy} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}`, marginBottom: 40 }}>
        <h3 style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 16 }}>Condições de Saúde</h3>
        {conditions.map(c => (
          <div key={c.id} style={{ background: T.bg2, padding: '12px 14px', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 600 }}>{c.name}</p>
              <button onClick={() => handleRemoveCondition(c.id)} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            {c.notes && <p style={{ color: T.sub, fontSize: 13 * scale, marginTop: 4 }}>{c.notes}</p>}
          </div>
        ))}
        {conditions.length === 0 && <p style={{ color: T.muted, fontSize: 13 * scale, marginBottom: 10 }}>Nenhuma condição cadastrada.</p>}
        
        <div style={{ marginTop: 12, padding: 12, border: `1px solid ${T.bdr}`, borderRadius: 12, background: T.bg2 }}>
          <p style={{ color: T.txt, fontSize: 13 * scale, fontWeight: 600, marginBottom: 8 }}>Nova Condição</p>
          <input placeholder="Nome da condição (ex: Diabetes)" style={inp} value={newCondition.name} onChange={e => setNewCondition({...newCondition, name: e.target.value})} />
          <input placeholder="Observações (opcional)" style={inp} value={newCondition.notes} onChange={e => setNewCondition({...newCondition, notes: e.target.value})} />
          <button onClick={handleAddCondition} style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: 10, fontWeight: 600, cursor: 'pointer' }}>Adicionar Condição</button>
        </div>
      </div>
    </div>
  );
}
