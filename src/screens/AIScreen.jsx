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
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 700,
          messages: [{
            role: 'user',
            content: `Analise estes dados de adesão a medicamentos e crie 3 insights motivacionais em português brasileiro.
Medicamentos: ${meds.map((m) => m.nome).join(', ') || 'não informado'}
Taxa de adesão: ${adhesion}%
Doses totais: ${history.length}, confirmadas: ${histConf}
Doses com atraso >30min: ${lateCount}
Use linguagem acolhedora, simples e encorajadora. Máx 2 frases por insight.
Responda SOMENTE JSON válido sem markdown:
{"insights":[{"icone":"emoji","titulo":"titulo curto","texto":"texto motivacional"},{"icone":"emoji","titulo":"titulo curto","texto":"texto motivacional"},{"icone":"emoji","titulo":"titulo curto","texto":"texto motivacional"}]}`,
          }],
        }),
      });
      const data = await res.json();
      const txt  = (data.content?.[0]?.text || '').trim().replace(/```json|```/g, '');
      setInsights(JSON.parse(txt).insights || []);
    } catch {
      setInsights([
        { icone: '📊', titulo: 'Sua adesão', texto: `Você mantém ${adhesion}% de adesão ao tratamento. ${adhesion >= 80 ? 'Excelente resultado!' : adhesion >= 60 ? 'Você está progredindo bem!' : 'Cada dose conta, vamos melhorar juntos.'}` },
        { icone: '💊', titulo: 'Medicamentos', texto: `${meds.length} medicamento${meds.length !== 1 ? 's' : ''} no tratamento. ${meds.filter((m) => m.quantidade <= 10).length > 0 ? 'Fique atento ao estoque.' : 'Todos com estoque adequado.'}` },
        { icone: '💡', titulo: 'Dica do dia', texto: 'Associar os medicamentos a rotinas fixas como refeições aumenta muito a regularidade. Continue firme!' },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="anim-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 50, height: 50, borderRadius: 15, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 18px rgba(139,92,246,.4)' }}>✨</div>
        <div>
          <h2 style={{ color: T.txt, fontSize: 20 * scale, fontWeight: 900 }}>Assistente de Saúde</h2>
          <p style={{ color: T.sub, fontSize: 13 * scale }}>Análise personalizada com IA</p>
        </div>
      </div>

      <button
        onClick={getAI}
        disabled={loading}
        style={{ width: '100%', padding: '17px', borderRadius: 14, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontSize: 16 * scale, fontWeight: 800, border: 'none', boxShadow: '0 4px 24px rgba(139,92,246,.35)', marginBottom: 20, opacity: loading ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        {loading
          ? <><span className="anim-blink">🤖</span><span>Analisando seus dados…</span></>
          : <><span>✨</span><span>Analisar minha adesão</span></>}
      </button>

      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {insights.map((ins, i) => (
            <div key={i} className="anim-scaleIn" style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 18, padding: 18, display: 'flex', gap: 14, animationDelay: `${i * .08}s` }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg,rgba(139,92,246,.15),rgba(99,102,241,.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {ins.icone || '💡'}
              </div>
              <div>
                <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 800, marginBottom: 4 }}>{ins.titulo}</p>
                <p style={{ color: T.sub, fontSize: 13 * scale, lineHeight: 1.6 }}>{ins.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16 }}>
        <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12 }}>Dados analisados</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { l: 'Adesão geral',     v: `${adhesion}%`,   c: adhesion >= 80 ? C.green : C.amber },
            { l: 'Doses registradas',v: history.length,    c: C.blue   },
            { l: 'Medicamentos',     v: meds.length,       c: C.purple },
            { l: 'Com atraso',       v: history.filter((h) => h.atraso_minutos > 30).length, c: C.amber },
          ].map((s) => (
            <div key={s.l} style={{ background: T.bg2, borderRadius: 13, padding: '12px 14px' }}>
              <p style={{ color: T.muted, fontSize: 11 * scale, marginBottom: 2 }}>{s.l}</p>
              <p style={{ color: s.c, fontSize: 24 * scale, fontWeight: 900 }}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
