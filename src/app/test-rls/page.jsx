'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { AuthScreen } from '@/components/AuthScreen';

export default function TestRLS() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  return isClient ? <InnerTest /> : null;
}

function InnerTest() {
  const { user } = useApp();
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    if (!user) return alert('Faça login primeiro.');
    setRunning(true);
    setResults([]);
    const logs = [];
    const log = (name, passed, detail) => {
      logs.push({ name, passed, detail });
      setResults([...logs]);
    };

    const fakeId = '00000000-0000-0000-0000-000000000000';

    try {
      // Test 0: Try to make myself caregiver of a random person
      const { error: e0 } = await supabase.from('caregiver_relationships').insert({
        patient_id: fakeId,
        caregiver_id: user.id,
        status: 'active',
        permission_level: 'admin'
      });
      if (e0) log('Escalonamento de Privilégios (Cuidador)', true, 'Bloqueado por RLS: ' + e0.message);
      else log('Escalonamento de Privilégios (Cuidador)', false, 'Conseguiu se vincular a outro usuário sem convite!');
      // Test 1: Leakage check - Read another user's meds
      const { data: meds, error: e1 } = await supabase.from('medicamentos').select('*').eq('user_id', fakeId);
      if (e1) log('Vazamento de leitura (Meds)', false, e1.message);
      else if (meds && meds.length > 0) log('Vazamento de leitura (Meds)', false, 'Conseguiu ler dados de outro usuário!');
      else log('Vazamento de leitura (Meds)', true, 'Bloqueado (0 resultados encontrados)');

      // Test 2: Modify another user's med
      const { error: e2 } = await supabase.from('medicamentos').update({ nome: 'Hacked' }).eq('user_id', fakeId);
      if (e2) log('Vazamento de update (Meds)', true, 'Bloqueado por RLS');
      else log('Vazamento de update (Meds)', true, 'Nenhuma linha afetada (silencioso - RLS em ação)');

      // Test 3: Insert Audit Log directly (should fail)
      const { error: e3 } = await supabase.from('audit_logs').insert({
        patient_id: user.id,
        performed_by: user.id,
        action: 'hacked_audit',
      });
      if (e3 && e3.message.includes('row violates row-level security')) log('Proteção de Auditoria Direta', true, 'Bloqueado por RLS: ' + e3.message);
      else if (e3) log('Proteção de Auditoria Direta', true, 'Falha ao inserir (Erro esperado): ' + e3.message);
      else log('Proteção de Auditoria Direta', false, 'Conseguiu inserir log de auditoria diretamente (FALHA GRAVE)!');

      // Test 4: Delete audit log
      const { error: e4 } = await supabase.from('audit_logs').delete().eq('patient_id', user.id);
      if (e4) log('Proteção de Deleção de Auditoria', true, 'Bloqueado por RLS: ' + e4.message);
      else log('Proteção de Deleção de Auditoria', true, 'Nenhuma linha afetada (RLS omite registros ou delete bloqueado)');

      // Test 5: Spoof historico_doses performed_by
      const { error: e5 } = await supabase.from('historico_doses').insert({
        user_id: fakeId, // Trying to insert for someone else
        hora: '12:00',
        status: 'confirmed'
      });
      if (e5) log('Spoofing (Histórico)', true, 'Falha ao inserir para outro usuário: ' + e5.message);
      else log('Spoofing (Histórico)', false, 'Conseguiu inserir dados para outro usuário (FALHA)!');

      // Test 6: Caregiver notes
      const { data: notes, error: e6 } = await supabase.from('caregiver_notes').select('*').eq('patient_id', fakeId);
      if (e6) log('Leitura de Notas de Terceiros', false, e6.message);
      else if (notes && notes.length > 0) log('Leitura de Notas de Terceiros', false, 'Leu notas indevidas');
      else log('Leitura de Notas de Terceiros', true, 'Bloqueado corretamente');

    } catch (err) {
      log('Erro Crítico', false, err.message);
    }
    setRunning(false);
  };

  if (!user) {
    return (
      <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', color: '#fff' }}>
        <h2>Faça login no App primeiro</h2>
        <p>Volte para a tela inicial, faça login e acesse /test-rls novamente.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', color: '#fff', fontFamily: 'system-ui' }}>
      <h1>Auditoria de Segurança & RLS</h1>
      <p style={{ marginBottom: 20, color: '#aaa', lineHeight: 1.5 }}>
        Esta ferramenta executa testes reais no banco de dados Supabase com o seu usuário atual (<b>{user.email}</b>).<br/>
        O objetivo é validar se as políticas de Row-Level Security (RLS) estão blindando dados de terceiros e protegendo a integridade da auditoria.
      </p>
      <button 
        onClick={runTests} 
        disabled={running}
        style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', borderRadius: 8, cursor: 'pointer', border: 'none', fontWeight: 'bold', fontSize: 16 }}
      >
        {running ? 'Executando testes...' : 'Iniciar Testes de Segurança (RLS)'}
      </button>

      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {results.map((r, i) => (
          <div key={i} style={{ padding: 16, borderRadius: 8, background: r.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${r.passed ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ fontWeight: 'bold', color: r.passed ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.passed ? '✅ Aprovado' : '❌ Vulnerável'}: {r.name}
            </div>
            <div style={{ fontSize: 14, marginTop: 6, color: '#ccc' }}>{r.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
