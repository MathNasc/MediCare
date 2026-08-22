'use client';
import { useState } from 'react';
import { C } from '@/lib/theme';
import { ProfileDB } from '@/lib/profileDb';
import { useApp } from '@/context/AppContext';
import { MedModal } from '@/components/modals/MedModal';

export function OnboardingWizard({ profile, onComplete, T, scale }) {
  const { user, toast, saveMed } = useApp();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Data
  const [personal, setPersonal] = useState({
    social_name: profile?.social_name || profile?.nome || '',
    dob: profile?.dob || '',
    blood_type: profile?.blood_type || '',
  });

  // Step 2: Emergency Contact
  const [contact, setContact] = useState({ name: '', relationship: '', phone: '' });

  // Step 3: Healthcare Pro
  const [pro, setPro] = useState({ name: '', specialty: '', phone: '' });

  // Step 4: Med Modal
  const [showMedModal, setShowMedModal] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    const s = profile?.emergency_settings || {};
    s.onboarding_completed = true;
    await ProfileDB.updateProfile(user.id, { emergency_settings: s });
    setLoading(false);
    onComplete();
  };

  const handleSavePersonal = async () => {
    setLoading(true);
    await ProfileDB.updateProfile(user.id, { 
      social_name: personal.social_name, 
      dob: personal.dob || null, 
      blood_type: personal.blood_type 
    });
    setLoading(false);
    setStep(2);
  };

  const handleSaveContact = async () => {
    if (contact.name && contact.phone) {
      setLoading(true);
      await ProfileDB.addEmergencyContact(user.id, contact);
      setLoading(false);
    }
    setStep(3);
  };

  const handleSavePro = async () => {
    if (pro.name && pro.specialty) {
      setLoading(true);
      await ProfileDB.addProfessional(user.id, pro);
      setLoading(false);
    }
    setStep(4);
  };

  const inp = { width: '100%', padding: '14px', borderRadius: 12, border: `1.5px solid ${T.bdr}`, background: T.bg1, color: T.txt, fontSize: 15 * scale, outline: 'none' };
  const lbl = { display: 'block', color: T.sub, fontSize: 12 * scale, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, marginTop: 16 };

  const StepWrapper = ({ title, subtitle, children }) => (
    <div className="anim-fadeUp" style={{ padding: '40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <p style={{ color: C.blue, fontWeight: 800, fontSize: 14 * scale, marginBottom: 8 }}>PASSO {step} DE 4</p>
        <h1 style={{ color: T.txt, fontWeight: 900, fontSize: 26 * scale, marginBottom: 12, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 30, lineHeight: 1.5 }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg0, minHeight: '100vh', position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        
        {step === 1 && (
          <StepWrapper title="Seus Dados Básicos" subtitle="Configure seu perfil para o Cartão de Emergência. Pule o que não quiser preencher agora.">
            <label style={lbl}>Nome Completo</label>
            <input style={inp} value={personal.social_name} onChange={e => setPersonal(p => ({ ...p, social_name: e.target.value }))} placeholder="Como gostaria de ser chamado?" />
            
            <label style={lbl}>Data de Nascimento</label>
            <input type="date" style={inp} value={personal.dob} onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))} />
            
            <label style={lbl}>Tipo Sanguíneo</label>
            <select style={inp} value={personal.blood_type} onChange={e => setPersonal(p => ({ ...p, blood_type: e.target.value }))}>
              <option value="">Não sei / Não informar</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, marginTop: 40 }}>
              <button onClick={() => setStep(2)} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'transparent', color: T.sub, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Pular</button>
              <button onClick={handleSavePersonal} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.blue, color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{loading ? 'Salvando...' : 'Continuar'}</button>
            </div>
          </StepWrapper>
        )}

        {step === 2 && (
          <StepWrapper title="Contato de Emergência" subtitle="Quem deve ser avisado em caso de emergência?">
            <label style={lbl}>Nome do Contato</label>
            <input style={inp} value={contact.name} onChange={e => setContact(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Maria da Silva" />
            
            <label style={lbl}>Parentesco</label>
            <input style={inp} value={contact.relationship} onChange={e => setContact(p => ({ ...p, relationship: e.target.value }))} placeholder="Ex: Filha, Cônjuge" />
            
            <label style={lbl}>Telefone</label>
            <input type="tel" style={inp} value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />

            <div style={{ display: 'flex', gap: 10, marginTop: 40 }}>
              <button onClick={() => setStep(3)} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'transparent', color: T.sub, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Pular</button>
              <button onClick={handleSaveContact} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.blue, color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{loading ? 'Salvando...' : 'Continuar'}</button>
            </div>
          </StepWrapper>
        )}

        {step === 3 && (
          <StepWrapper title="Profissionais de Saúde" subtitle="Algum médico principal que acompanha você?">
            <label style={lbl}>Nome do Médico</label>
            <input style={inp} value={pro.name} onChange={e => setPro(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Dr. Carlos" />
            
            <label style={lbl}>Especialidade</label>
            <input style={inp} value={pro.specialty} onChange={e => setPro(p => ({ ...p, specialty: e.target.value }))} placeholder="Ex: Cardiologista" />
            
            <label style={lbl}>Telefone do Consultório</label>
            <input type="tel" style={inp} value={pro.phone} onChange={e => setPro(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 0000-0000" />

            <div style={{ display: 'flex', gap: 10, marginTop: 40 }}>
              <button onClick={() => setStep(4)} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'transparent', color: T.sub, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Pular</button>
              <button onClick={handleSavePro} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 12, background: C.blue, color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{loading ? 'Salvando...' : 'Continuar'}</button>
            </div>
          </StepWrapper>
        )}

        {step === 4 && (
          <StepWrapper title="Seus Medicamentos" subtitle="Para finalizar, você pode adicionar seu primeiro medicamento agora.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
              <button onClick={() => setShowMedModal(true)} style={{ width: '100%', padding: 20, borderRadius: 16, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 16 * scale, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(59,130,246,.4)' }}>
                <span style={{ fontSize: 24 }}>💊</span> Adicionar Medicamento
              </button>

              <button onClick={handleFinish} disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 16, background: T.bg1, color: T.txt, fontWeight: 700, border: `1.5px solid ${T.bdr}`, cursor: 'pointer' }}>
                {loading ? 'Finalizando...' : 'Ir para o aplicativo (Pular)'}
              </button>
            </div>
          </StepWrapper>
        )}

      </div>

      {showMedModal && (
        <MedModal 
          onSave={async (payload, horarios, dias) => {
            try {
              await saveMed(payload, horarios, dias);
              toast('✓ Medicamento adicionado!');
              setShowMedModal(false);
              handleFinish();
            } catch (err) { 
              toast(err.message || 'Erro ao adicionar medicamento.', 'err');
            }
          }} 
          onClose={() => setShowMedModal(false)} 
          T={T} 
          scale={scale} 
          userId={user?.id} 
          toast={toast} 
        />
      )}
    </div>
  );
}
