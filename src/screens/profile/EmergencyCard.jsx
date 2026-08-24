import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ProfileDB } from '@/lib/profileDb';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';

export function EmergencyCard({ user, profile, onBack, T, scale }) {
  const { meds } = useApp();
  const [allergies, setAllergies] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [contacts, setContacts] = useState([]);
  
  const s = profile?.emergency_settings || { show_name: true, show_age: true, show_photo: true, show_blood_type: true, show_allergies: true, show_conditions: true, show_meds: true, show_contacts: true };
  const importantMeds = meds.filter(m => m.important_for_emergency);

  useEffect(() => {
    ProfileDB.listAllergies(user.id).then(setAllergies);
    ProfileDB.listConditions(user.id).then(setConditions);
    ProfileDB.listEmergencyContacts(user.id).then(setContacts);
  }, [user.id]);

  const calcAge = (dob) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  };
  const age = calcAge(profile?.dob);

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 56, paddingBottom: 20 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: T.bg2, border: 'none', color: T.txt, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 18 * scale }}>🚨 Cartão de Emergência</p>
      </div>

      <div style={{ background: '#ef4444', color: '#fff', padding: 24, borderRadius: 24, marginBottom: 40, boxShadow: '0 10px 25px rgba(239,68,68,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {s.show_photo && (
            <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {profile?.foto_url ? <Image src={profile.foto_url} alt="Foto" fill style={{ objectFit: 'cover' }} sizes="64px" /> : <span style={{ fontSize: 30 }}>{profile?.nome?.[0]?.toUpperCase()}</span>}
            </div>
          )}
          <div>
            {s.show_name && <p style={{ fontSize: 22 * scale, fontWeight: 800 }}>{profile?.social_name || profile?.nome || 'Usuário'}</p>}
            {s.show_age && age && <p style={{ fontSize: 16 * scale, opacity: 0.9 }}>{age} anos</p>}
            {s.show_blood_type && profile?.blood_type && <p style={{ fontSize: 16 * scale, fontWeight: 700, marginTop: 4 }}>🩸 {profile.blood_type}</p>}
          </div>
        </div>

        {s.show_allergies && allergies.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.15)', padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 14 * scale, marginBottom: 6 }}>⚠️ Alergias</p>
            <p style={{ fontSize: 15 * scale, lineHeight: 1.4 }}>{allergies.map(a => a.name).join(', ')}</p>
          </div>
        )}

        {s.show_conditions && conditions.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.15)', padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 14 * scale, marginBottom: 6 }}>❤️ Condições Importantes</p>
            {conditions.map(c => (
              <p key={c.id} style={{ fontSize: 15 * scale, lineHeight: 1.4 }}>• {c.name}</p>
            ))}
          </div>
        )}

        {s.show_meds && importantMeds.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.15)', padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 14 * scale, marginBottom: 6 }}>💊 Medicamentos Importantes</p>
            {importantMeds.map(m => (
              <p key={m.id} style={{ fontSize: 15 * scale, lineHeight: 1.4 }}>• {m.nome} {m.dosagem}</p>
            ))}
          </div>
        )}

        {s.show_contacts && contacts.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.15)', padding: 14, borderRadius: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 14 * scale, marginBottom: 6 }}>👤 Contato de Emergência</p>
            <p style={{ fontSize: 15 * scale, fontWeight: 800 }}>{contacts[0].name}</p>
            <p style={{ fontSize: 14 * scale, opacity: 0.9 }}>{contacts[0].relationship}</p>
            <a href={`tel:${contacts[0].phone}`} style={{ display: 'inline-block', background: '#fff', color: '#ef4444', padding: '8px 16px', borderRadius: 20, marginTop: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 * scale }}>📞 Ligar</a>
          </div>
        )}
      </div>
    </div>
  );
}
