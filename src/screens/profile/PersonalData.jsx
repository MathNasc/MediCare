import { useState } from 'react';
import { BrDateInput } from "@/components/ui/BrDateInput";
import { ProfileDB } from '@/lib/profileDb';
import { C } from '@/lib/theme';

export function PersonalData({ user, profile, onUpdate, onBack, T, scale }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: profile?.nome || '',
    social_name: profile?.social_name || '',
    dob: profile?.dob || '',
    sex: profile?.sex || '',
    cpf: profile?.cpf || '',
    phone: profile?.phone || '',
    email: profile?.email || user.email || '',
    address: profile?.address || '',
    weight: profile?.weight || '',
    height: profile?.height || '',
    blood_type: profile?.blood_type || ''
  });

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    let payload = { ...form };
    // Process height/weight to numeric if provided
    payload.weight = payload.weight ? parseFloat(payload.weight) : null;
    payload.height = payload.height ? parseFloat(payload.height) : null;
    
    // Update weight timestamp if weight changed
    if (payload.weight !== profile?.weight) {
      payload.weight_updated_at = new Date().toISOString();
    }
    
    const ok = await ProfileDB.updateProfile(user.id, payload);
    if (ok) {
      onUpdate({ ...profile, ...payload });
      onBack();
    } else {
      alert('Erro ao salvar.');
    }
    setSaving(false);
  };

  const inp = { background: T.inp, border: `1px solid ${T.inpB}`, borderRadius: 12, padding: '12px', color: T.txt, fontSize: 15 * scale, width: '100%', marginBottom: 14 };
  const lbl = { color: T.sub, fontSize: 12 * scale, fontWeight: 700, marginBottom: 6, display: 'block' };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>Dados pessoais</p>
      </div>

      <div style={{ background: T.bg1, padding: 16, borderRadius: 20, border: `1px solid ${T.bdr}` }}>
        <label style={lbl}>Nome completo</label>
        <input style={inp} value={form.nome} onChange={e => handleChange('nome', e.target.value)} />
        
        <label style={lbl}>Nome social / Apelido</label>
        <input style={inp} value={form.social_name} onChange={e => handleChange('social_name', e.target.value)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Data de nascimento</label>
            <BrDateInput style={inp} value={form.dob} onChange={e => handleChange('dob', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Sexo</label>
            <select style={inp} value={form.sex} onChange={e => handleChange('sex', e.target.value)}>
              <option value="">Selecionar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>
        </div>

        <label style={lbl}>CPF (opcional)</label>
        <input style={inp} value={form.cpf} onChange={e => handleChange('cpf', e.target.value)} />

        <label style={lbl}>Telefone</label>
        <input type="tel" style={inp} value={form.phone} onChange={e => handleChange('phone', e.target.value)} />

        <label style={lbl}>Endereço</label>
        <input style={inp} value={form.address} onChange={e => handleChange('address', e.target.value)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Peso (kg)</label>
            <input type="number" step="0.1" style={inp} value={form.weight} onChange={e => handleChange('weight', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Altura (m)</label>
            <input type="number" step="0.01" style={inp} value={form.height} onChange={e => handleChange('height', e.target.value)} />
          </div>
        </div>
        
        <label style={lbl}>Tipo sanguíneo</label>
        <select style={inp} value={form.blood_type} onChange={e => handleChange('blood_type', e.target.value)}>
          <option value="">Selecionar</option>
          <option value="A+">A+</option><option value="A-">A-</option>
          <option value="B+">B+</option><option value="B-">B-</option>
          <option value="AB+">AB+</option><option value="AB-">AB-</option>
          <option value="O+">O+</option><option value="O-">O-</option>
        </select>

        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 12, background: C.blue, color: '#fff', fontSize: 16 * scale, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 }}
        >
          {saving ? 'Salvando...' : 'Salvar dados'}
        </button>
      </div>
    </div>
  );
}
