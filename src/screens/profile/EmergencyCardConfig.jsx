import { useState, useEffect } from 'react';
import { ProfileDB } from '@/lib/profileDb';
import { C } from '@/lib/theme';
import { useApp } from '@/context/AppContext';

export function EmergencyCardConfig({ user, profile, onUpdate, onBack, T, scale }) {
  const { meds, loadAll } = useApp();
  const [saving, setSaving] = useState(false);
  
  const defaultSettings = { show_name: true, show_age: true, show_photo: true, show_blood_type: true, show_allergies: true, show_conditions: true, show_meds: true, show_contacts: true };
  const [settings, setSettings] = useState(profile?.emergency_settings || defaultSettings);
  
  const toggle = (key) => setSettings(p => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await ProfileDB.updateProfile(user.id, { emergency_settings: settings });
    if (ok) {
      onUpdate({ ...profile, emergency_settings: settings });
      onBack();
    } else {
      alert('Erro ao salvar');
    }
    setSaving(false);
  };

  const Option = ({ label, prop }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.bdr}` }}>
      <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 500 }}>{label}</p>
      <input type="checkbox" checked={settings[prop] ?? true} onChange={() => toggle(prop)} style={{ width: 22, height: 22, accentColor: C.blue }} />
    </div>
  );

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Configurar Cartão</p>
      </div>

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}` }}>
        <p style={{ color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>Selecione quais informações devem aparecer no seu Cartão de Emergência.</p>
        
        <Option label="Nome" prop="show_name" />
        <Option label="Idade" prop="show_age" />
        <Option label="Foto" prop="show_photo" />
        <Option label="Tipo Sanguíneo" prop="show_blood_type" />
        <Option label="Alergias" prop="show_allergies" />
        <Option label="Condições Importantes" prop="show_conditions" />
        <Option label="Medicamentos Importantes" prop="show_meds" />
        <Option label="Contatos de Emergência" prop="show_contacts" />
        
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 12, background: C.blue, color: '#fff', fontSize: 16 * scale, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 24 }}
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
