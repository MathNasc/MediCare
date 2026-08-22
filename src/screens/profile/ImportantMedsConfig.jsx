import { useState } from 'react';
import { MedDB } from '@/lib/db';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';

export function ImportantMedsConfig({ onBack, T, scale }) {
  const { meds, loadAll, user } = useApp();
  const [savingId, setSavingId] = useState(null);

  const handleToggle = async (med) => {
    setSavingId(med.id);
    await MedDB.update(med.id, { important_for_emergency: !med.important_for_emergency });
    await loadAll(user.id);
    setSavingId(null);
  };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Medicamentos Importantes</p>
      </div>

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}`, marginBottom: 40 }}>
        <p style={{ color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>Selecione quais medicamentos devem constar no seu Cartão de Emergência.</p>
        
        {meds.map(med => (
          <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.bdr}` }}>
            <div>
              <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 600 }}>{med.nome}</p>
              <p style={{ color: T.muted, fontSize: 13 * scale }}>{med.dosagem}</p>
            </div>
            <button 
              onClick={() => handleToggle(med)}
              disabled={savingId === med.id}
              style={{ background: med.important_for_emergency ? C.blue : T.bg2, color: med.important_for_emergency ? '#fff' : T.txt, padding: '8px 16px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 13 * scale, cursor: 'pointer' }}
            >
              {med.important_for_emergency ? '✓ Marcado' : '+ Adicionar'}
            </button>
          </div>
        ))}
        {meds.length === 0 && <p style={{ color: T.muted, fontSize: 14 * scale }}>Nenhum medicamento cadastrado.</p>}
      </div>
    </div>
  );
}
