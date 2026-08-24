'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { C } from '@/lib/theme';

export function AIScreen({ T, scale }) {
  const { meds, history } = useApp();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading]   = useState(false);

  const histConf = history.filter((h) => h.status === 'confirmed').length;
  const adhesion = history.length > 0 ? Math.round((histConf / history.length) * 100) : 0;

  const getAI = async () => {
    setLoading(true);
    const lateCount = history.filter((h) => h.atraso_minutos > 30).length;
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Você é um assistente de saúde inteligente para um paciente. Analise estes dados de adesão a medicamentos e crie 3 insights úteis, práticos e motivacionais em português brasileiro.
Medicamentos: ${meds.map((m) => m.nome).join(', ') || 'nenhum registrado'}
Taxa de adesão (doses tomadas / total): ${adhesion}%
Doses totais registradas: ${history.length}, confirmadas: ${histConf}
Doses com atraso >30min: ${lateCount}

Diretrizes:
- Use uma linguagem acolhedora, clara e encorajadora.
- Foque em dicas práticas baseadas nos dados (ex: se há muito atraso, sugira dicas para lembrar; se a adesão é alta, elogie e mostre os benefícios).
- Crie um título bem chamativo.
- Responda OBRIGATORIAMENTE em JSON no formato exato:
{"insights":[{"icone":"<emoji que represente>","titulo":"<titulo curto>","texto":"<texto motivacional/prático>"}]}
`
        }),
      });
      const data = await res.json();
      const txt = (data.text || '').trim();
      setInsights(JSON.parse(txt).insights || []);
    } catch (e) {
      console.error(e);
      setInsights([
        { icone: '📊', titulo: 'Sua adesão', texto: `Você mantém ${adhesion}% de adesão ao tratamento. ${adhesion >= 80 ? 'Excelente resultado!' : adhesion >= 60 ? 'Você está progredindo bem!' : 'Cada dose conta, vamos melhorar juntos.'}` },
        { icone: '💊', titulo: 'Medicamentos', texto: `${meds.length} medicamento${meds.length !== 1 ? 's' : ''} no tratamento. ${meds.filter((m) => m.quantidade <= 10).length > 0 ? 'Fique atento ao estoque.' : 'Todos com estoque adequado.'}` },
        { icone: '💡', titulo: 'Dica do dia', texto: 'Associar os medicamentos a rotinas fixas como refeições aumenta muito a regularidade. Continue firme!' },
      ]);
    }
    setLoading(false);
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

          <button onClick={() => alert('Recurso de voz em desenvolvimento e será liberado em breve.')} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontSize: 16 * scale, fontWeight: 800, border: 'none', borderRadius: 16, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24, boxShadow: '0 4px 18px rgba(59,130,246,.3)' }}>
            <span style={{ fontSize: 24 }}>🎙️</span> Falar com o Assistente
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
          <button onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>O que merece atenção?</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {lateDoses.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>⏰</span>
                  <p style={{ color: '#ef4444', fontWeight: 800, fontSize: 15 * scale }}>Doses Atrasadas Hoje</p>
                </div>
                <p style={{ color: T.txt, fontSize: 14 * scale }}>Percebi que você tem {lateDoses.length} dose(s) pendente(s) hoje. Tente tomar assim que possível para manter a eficácia.</p>
              </div>
            )}

            {lowStock.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>📦</span>
                  <p style={{ color: '#f59e0b', fontWeight: 800, fontSize: 15 * scale }}>Estoque Baixo</p>
                </div>
                <p style={{ color: T.txt, fontSize: 14 * scale }}>Os seguintes medicamentos estão acabando: {lowStock.map(m => m.nome).join(', ')}.</p>
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
          <button onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Explicar meus medicamentos</h2>
          <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 20 }}>Toque em um medicamento para perguntar à Inteligência Artificial sobre ele.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meds.map(m => (
              <button key={m.id} onClick={() => askAI(`Explique de forma simples e clara para que serve o medicamento ${m.nome}. Responda como se eu fosse um idoso leigo em medicina. Não dê recomendações médicas, apenas explique o uso geral.`)} style={{ background: T.bg1, border: `1px solid ${T.bdr}`, padding: '16px', borderRadius: 16, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 700 }}>{m.nome}</span>
                <span style={{ color: '#3b82f6', fontSize: 20 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeView === 'stock' && (
        <div className="anim-scaleIn">
          <button onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <button onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            ‹ Voltar
          </button>
          <h2 style={{ color: T.txt, fontSize: 22 * scale, fontWeight: 900, marginBottom: 20 }}>Preparar Consulta</h2>
          
          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, padding: 20, borderRadius: 20 }}>
            <p style={{ color: T.sub, fontSize: 14 * scale, marginBottom: 16 }}>Este é um resumo automático dos seus dados para você mostrar ao seu médico.</p>
            
            <div style={{ padding: 16, background: T.bg2, borderRadius: 12, marginBottom: 20 }}>
              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Medicamentos Ativos:</p>
              <ul style={{ paddingLeft: 20, color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>
                {meds.map(m => <li key={m.id}>{m.nome} — {m.dosagem}</li>)}
              </ul>

              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Adesão Recente:</p>
              <p style={{ color: T.sub, fontSize: 13 * scale, marginBottom: 16 }}>Você tomou {history.filter(h => h.status === 'confirmed').length} doses do total de {history.length} registradas.</p>

              <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 8 }}>Vale conversar sobre:</p>
              <ul style={{ paddingLeft: 20, color: T.sub, fontSize: 13 * scale }}>
                {lateDoses.length > 0 && <li>Dificuldade com os horários de hoje.</li>}
                {missedDosesAll > 0 && <li>Estratégias para não esquecer doses.</li>}
                {lateDoses.length === 0 && missedDosesAll === 0 && <li>Tudo parece bem com a sua adesão atual!</li>}
              </ul>
            </div>
            
            <button style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', fontSize: 15 * scale, fontWeight: 800, border: 'none', borderRadius: 12, minHeight: 44 }}>
              Compartilhar Resumo
            </button>
          </div>
        </div>
      )}

      {activeView === 'chat' && (
        <div className="anim-scaleIn" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <button onClick={() => setActiveView('main')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 16 * scale, fontWeight: 700, padding: '10px 0', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            ‹ Voltar
          </button>
          
          <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <span className="anim-spin" style={{ fontSize: 32 }}>⏳</span>
                <p style={{ color: T.sub, fontSize: 16 * scale, fontWeight: 600 }}>O assistente está pensando...</p>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🩺</div>
                  <div style={{ color: T.txt, fontSize: 15 * scale, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {chatRes}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
