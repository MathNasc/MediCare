
'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';
import { useBackButton } from '@/hooks/useBackButton';

export function AIScreen({ T, scale }) {
  const { meds, history } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('main');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useBackButton(activeView !== 'main', () => setActiveView('main'));

  const getLocalDateISO = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  };
  const today = getLocalDateISO(new Date());

  const todayHist = history.filter(h => getLocalDateISO(new Date(h.created_at)) === today);
  const pendingDoses = meds.filter(m => m.ativo && m.treatment_type !== 'sos').flatMap(m => (m.horarios||[]).map(hora => ({med:m, hora}))).filter(d => !todayHist.find(h => h.med_id === d.med.id && h.hora === d.hora)).sort((a,b) => a.hora.localeCompare(b.hora));
  const lateDoses = history.filter(h => h.atraso_minutos > 0 && h.status === 'confirmed');
  const missedDosesAll = history.filter(h => h.status === 'missed').length;
  const lowStock = meds.filter(m => m.quantidade !== null && m.quantidade <= 10);
  
  const histConf = history.filter((h) => h.status === 'confirmed').length;
  const adhesion = history.length > 0 ? Math.round((histConf / history.length) * 100) : 0;

  let resumoTexto = 'Tudo ótimo por aqui!';
  if (pendingDoses.length > 0) resumoTexto = `Você tem ${pendingDoses.length} medicamento(s) pendente(s) hoje.`;
  else if (lateDoses.length > 0) resumoTexto = 'Você tomou alguns medicamentos com atraso recentemente.';

  useEffect(() => {
    if (activeView === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeView]);

  const sendChatMessage = async (msg) => {
    if (!msg.trim()) return;
    const newMessages = [...messages, { role: 'user', text: msg }];
    setMessages(newMessages);
    setChatInput('');
    setLoading(true);

    try {
      const prompt = `Você é um assistente de saúde para pacientes. Responda de forma simples, acolhedora e direta. 
Mensagem do paciente: ${msg}

Dados do paciente para contexto:
Adesão geral: ${adhesion}%
Remédios e Estoque: ${meds.map(m=>`${m.nome} (${m.dosagem}, ${m.quantidade !== null ? m.quantidade + ' unidades restando' : 'sem controle de estoque'})`).join('; ') || 'Nenhum'}
Doses pendentes hoje: ${pendingDoses.length > 0 ? pendingDoses.map(d=>`${d.med.nome} às ${d.hora}`).join(', ') : 'Nenhuma'}`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessages([...newMessages, { role: 'assistant', text: 'Desculpe, ocorreu um erro: ' + (data.error || 'Falha ao conectar com a IA.') }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', text: data.text }]);
      }
    } catch(e) {
      setMessages([...newMessages, { role: 'assistant', text: 'Desculpe, tive um problema de conexão ao tentar responder.' }]);
    }
    setLoading(false);
  };

  const askAI = (promptMsg) => {
    setActiveView('chat');
    if (messages.length === 0 || messages[messages.length-1].text !== promptMsg) {
       sendChatMessage(promptMsg);
    }
  };

  const handleShare = () => {
    const text = `Meu Resumo de Saúde:\n\nMedicamentos Ativos:\n${meds.filter(m => m.treatment_type !== 'sos').map(m => `- ${m.nome} (${m.dosagem})`).join('\n')}\n\nAdesão:\nTomadas ${history.filter(h => h.status === 'confirmed').length} de ${history.length} doses registradas.`;
    if (navigator.share) {
        navigator.share({ title: 'Resumo de Saúde', text }).catch(console.error);
    } else {
        alert('Compartilhamento não suportado neste navegador. As informações são:\n\n' + text);
    }
  };

  const BigAction = ({ icon, title, onClick }) => (
    <button onClick={onClick} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s', width: '100%', minHeight: 44 }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <span style={{ color: T.txt, fontWeight: 700, fontSize: 14 * scale, textAlign: 'center', lineHeight: 1.2 }}>{title}</span>
    </button>
  );

  return (
    <div className="anim-fadeUp main-container">
      {activeView === 'main' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingTop: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 4px 18px rgba(59,130,246,.3)' }}>🩺</div>
            <div>
              <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, lineHeight: 1.2 }}>Assistente de Saúde</h2>
              <p style={{ color: T.sub, fontSize: 14 * scale, marginTop: 2 }}>Ajudo você a acompanhar seu tratamento.</p>
            </div>
          </div>

          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 20, marginBottom: 24 }}>
            <p style={{ color: T.sub, fontSize: 12 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 12 }}>Como estou hoje?</p>
            <p style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 800, lineHeight: 1.4, marginBottom: 16 }}>{resumoTexto}</p>
            
            {pendingDoses.length > 0 && (
              <div style={{ background: T.bg2, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>⏰</span>
                <div>
                  <p style={{ color: T.sub, fontSize: 12 * scale }}>Próximo medicamento:</p>
                  <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700 }}>{pendingDoses[0].med.nome} — {pendingDoses[0].hora}</p>
                </div>
              </div>
            )}
          </div>

          <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 800, marginBottom: 14 }}>O que você precisa?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <BigAction icon="💊" title="Explicar meus medicamentos" onClick={() => setActiveView('meds')} />
            <BigAction icon="⚠️" title="O que merece atenção?" onClick={() => setActiveView('attention')} />
            <BigAction icon="📦" title="Meu estoque" onClick={() => setActiveView('stock')} />
            <BigAction icon="🩺" title="Preparar consulta" onClick={() => setActiveView('consult')} />
          </div>

          <button onClick={() => setActiveView('chat')} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontSize: 16 * scale, fontWeight: 800, border: 'none', borderRadius: 16, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24, boxShadow: '0 4px 18px rgba(59,130,246,.3)' }}>
            <span style={{ fontSize: 24 }}>💬</span> Falar com o Assistente
          </button>

          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 20 }}>
            <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 800, marginBottom: 14 }}>Pergunte ao Assistente</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => askAI("Quais remédios tomo hoje e em quais horários?")} style={{ background: T.bg2, border: 'none', padding: '14px 16px', borderRadius: 12, color: T.txt, fontSize: 14 * scale, fontWeight: 600, textAlign: 'left', minHeight: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Quais remédios tomo hoje? <span>›</span>
              </button>
              <button onClick={() => askAI("Como está a minha adesão geral ao tratamento baseado no meu histórico?")} style={{ background: T.bg2, border: 'none', padding: '14px 16px', borderRadius: 12, color: T.txt, fontSize: 14 * scale, fontWeight: 600, textAlign: 'left', minHeight: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Como está minha adesão? <span>›</span>
              </button>
              <button onClick={() => askAI("Tenho algum medicamento acabando?")} style={{ background: T.bg2, border: 'none', padding: '14px 16px', borderRadius: 12, color: T.txt, fontSize: 14 * scale, fontWeight: 600, textAlign: 'left', minHeight: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Tenho algum remédio acabando? <span>›</span>
              </button>
            </div>
          </div>
        </>
      )}

      {activeView === 'attention' && (
        <div className="anim-scaleIn">
          <button type="button" onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>O que merece atenção?</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lateDoses.length > 0 && (
              <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>⏰</span>
                  <p style={{ color: T.txt, fontWeight: 800, fontSize: 15 * scale }}>Doses com Atraso</p>
                </div>
                <p style={{ color: T.sub, fontSize: 14 * scale }}>Você registrou {lateDoses.length} dose(s) com atraso recentemente. Tente ajustar seus alarmes.</p>
              </div>
            )}
            {lowStock.length > 0 && (
              <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>📦</span>
                  <p style={{ color: T.txt, fontWeight: 800, fontSize: 15 * scale }}>Estoque Baixo</p>
                </div>
                <p style={{ color: T.sub, fontSize: 14 * scale }}>{lowStock.length} medicamento(s) estão acabando (10 ou menos unidades).</p>
              </div>
            )}
            {missedDosesAll > 5 && (
              <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>📉</span>
                  <p style={{ color: T.txt, fontWeight: 800, fontSize: 15 * scale }}>Histórico de Esquecimentos</p>
                </div>
                <p style={{ color: T.sub, fontSize: 14 * scale }}>Você tem algumas doses perdidas no histórico. Pode ser útil conversar com seu médico ou familiar para ajudar a lembrar dos horários.</p>
              </div>
            )}
            {lateDoses.length === 0 && lowStock.length === 0 && missedDosesAll <= 5 && (
              <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 40, display: 'block', marginBottom: 10 }}>✅</span>
                <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 800 }}>Tudo certo!</p>
                <p style={{ color: T.sub, fontSize: 14 * scale, marginTop: 6 }}>Não encontrei nada que precise de atenção urgente agora.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'meds' && (
        <div className="anim-scaleIn">
          <button type="button" onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Explicar meus medicamentos</h2>
          <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 20 }}>Toque em um medicamento para perguntar à Inteligência Artificial sobre ele.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meds.map(m => (
              <button key={m.id} onClick={() => askAI(`Explique de forma simples e clara para que serve o medicamento ${m.nome}. Responda como se eu fosse um leigo em medicina. Não dê recomendações médicas, apenas explique o uso geral.`)} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, padding: '16px', borderRadius: 16, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700 }}>{m.nome}</span>
                <span style={{ color: '#3b82f6', fontSize: 20 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeView === 'stock' && (
        <div className="anim-scaleIn">
          <button type="button" onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Meu Estoque</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {meds.filter(m => m.quantidade !== null).length === 0 ? (
               <p style={{ color: T.sub, fontSize: 14 * scale }}>Nenhum medicamento com controle de estoque ativo.</p>
            ) : (
              meds.filter(m => m.quantidade !== null).map(m => {
                const isLow = m.quantidade <= 10;
                return (
                  <div key={m.id} style={{ background: T.bg1, border: `1px solid ${isLow ? 'rgba(245,158,11,.4)' : T.bdr}`, padding: 16, borderRadius: 16 }}>
                    <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700, marginBottom: 4 }}>{m.nome}</p>
                    <p style={{ color: isLow ? '#f59e0b' : T.sub, fontSize: 14 * scale, fontWeight: isLow ? 800 : 500 }}>{m.quantidade} unidades restantes</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeView === 'consult' && (
        <div className="anim-scaleIn">
          <button type="button" onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Preparar Consulta</h2>
          
          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, padding: 20, borderRadius: 20 }}>
            <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 16 }}>Este é um resumo automático dos seus dados para você mostrar ao seu médico.</p>
            
            <div style={{ padding: 16, background: T.bg2, borderRadius: 12, marginBottom: 20 }}>
              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Medicamentos Ativos:</p>
              <ul style={{ paddingLeft: 20, color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>
                {meds.filter(m => m.treatment_type !== 'sos').map(m => <li key={m.id}>{m.nome} — {m.dosagem}</li>)}
              </ul>

              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Adesão Recente:</p>
              <p style={{ color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>Você tomou {history.filter(h => h.status === 'confirmed').length} doses do total de {history.length} registradas.</p>

              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Vale conversar sobre:</p>
              <ul style={{ paddingLeft: 20, color: T.sub, fontSize: 13 * scale }}>
                {lateDoses.length > 0 && <li>Dificuldade com os horários recentemente.</li>}
                {missedDosesAll > 0 && <li>Estratégias para não esquecer doses.</li>}
                {lateDoses.length === 0 && missedDosesAll === 0 && <li>Tudo parece bem com a sua adesão atual!</li>}
              </ul>
            </div>
            
            <button onClick={handleShare} style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', fontSize: 15 * scale, fontWeight: 800, border: 'none', borderRadius: 12, minHeight: 44 }}>
              Compartilhar Resumo
            </button>
          </div>
        </div>
      )}

      {activeView === 'chat' && (
        <div className="anim-scaleIn" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <button type="button" onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', flexShrink: 0 }}>
            ‹ Voltar
          </button>
          
          <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Chat History */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: T.muted, fontSize: 14 * scale, marginTop: 20 }}>
                  Olá! Como posso ajudar você com sua saúde e medicamentos hoje?
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  {m.role === 'assistant' && (
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🩺</div>
                  )}
                  <div style={{ background: m.role === 'user' ? '#3b82f6' : T.bg2, color: m.role === 'user' ? '#fff' : T.txt, padding: '12px 16px', borderRadius: 16, borderTopRightRadius: m.role === 'user' ? 4 : 16, borderTopLeftRadius: m.role === 'assistant' ? 4 : 16, fontSize: 15 * scale, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🩺</div>
                  <div style={{ background: T.bg2, padding: '12px 16px', borderRadius: 16, borderTopLeftRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                     <span className="anim-pulse" style={{ width: 6, height: 6, background: T.sub, borderRadius: '50%' }} />
                     <span className="anim-pulse" style={{ width: 6, height: 6, background: T.sub, borderRadius: '50%', animationDelay: '150ms' }} />
                     <span className="anim-pulse" style={{ width: 6, height: 6, background: T.sub, borderRadius: '50%', animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div style={{ padding: 12, borderTop: `1px solid ${T.bdr}`, background: T.bg2, display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage(chatInput)}
                placeholder="Pergunte ao assistente..."
                style={{ flex: 1, background: T.inp, border: `1px solid ${T.inpB}`, color: T.txt, padding: '12px 16px', borderRadius: 24, fontSize: 15 * scale }}
              />
              <button 
                onClick={() => sendChatMessage(chatInput)}
                disabled={!chatInput.trim() || loading}
                style={{ width: 48, height: 48, borderRadius: '50%', background: chatInput.trim() && !loading ? '#3b82f6' : T.bg3, color: chatInput.trim() && !loading ? '#fff' : T.muted, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transition: 'all 0.2s' }}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
