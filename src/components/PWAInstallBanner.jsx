'use client';
import { useState, useEffect } from 'react';

export function PWAInstallBanner({ canInstall, onInstall, T, scale = 1 }) {
  const [dismissed, setDismissed] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem('mc_pwa_dismissed');
      if (d === '1') setDismissed(true);
    } catch {}
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('mc_pwa_dismissed', '1'); } catch {}
    setDismissed(true);
  };

  // Não mostrar se já instalado (standalone) ou dispensado
  if (dismissed) return null;

  // Detecta se já está rodando como PWA instalado
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true);
  if (isStandalone) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: 'linear-gradient(135deg, #1e3a5f, #0d1f3c)',
      borderBottom: '1px solid rgba(59,130,246,.4)',
      padding: '12px 16px',
    }}>
      {!showManual ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>📲</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontSize: 13 * scale, fontWeight: 700, marginBottom: 1 }}>
              Instale o MediCare
            </p>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 * scale }}>
              Sem barra do navegador, acesso rápido
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {canInstall ? (
              <button
                onClick={onInstall}
                style={{
                  background: '#3b82f6', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '7px 14px',
                  fontSize: 12 * scale, fontWeight: 800,
                }}
              >
                Instalar
              </button>
            ) : (
              <button
                onClick={() => setShowManual(true)}
                style={{
                  background: '#3b82f6', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '7px 14px',
                  fontSize: 12 * scale, fontWeight: 800,
                }}
              >
                Como instalar
              </button>
            )}
            <button
              onClick={dismiss}
              aria-label="Fechar"
              style={{
                background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 10px',
                fontSize: 14, fontWeight: 700,
              }}
            >×</button>
          </div>
        </div>
      ) : (
        // Instruções manuais para Edge/Chrome Android
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ color: '#fff', fontSize: 14 * scale, fontWeight: 800 }}>
              📲 Como instalar o MediCare
            </p>
            <button
              onClick={dismiss}
              aria-label="Fechar"
              style={{ background: 'none', color: 'rgba(255,255,255,.6)', border: 'none', fontSize: 20 }}
            >×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: '1', t: 'Toque no menu', d: 'Ícone ⋮ (três pontos) no canto superior direito do Edge ou Chrome' },
              { n: '2', t: 'Selecione a opção', d: '"Adicionar à tela inicial" ou "Instalar aplicativo"' },
              { n: '3', t: 'Confirme', d: 'Toque em "Adicionar" na caixa de diálogo' },
              { n: '4', t: 'Abra pelo ícone', d: 'Use o ícone MediCare na tela inicial — sem barra do navegador!' },
            ].map((step) => (
              <div key={step.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#3b82f6', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 1,
                }}>{step.n}</div>
                <div>
                  <p style={{ color: '#fff', fontSize: 12 * scale, fontWeight: 700 }}>{step.t}</p>
                  <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 11 * scale }}>{step.d}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowManual(false)}
            style={{
              marginTop: 10, background: 'none', color: 'rgba(255,255,255,.5)',
              border: 'none', fontSize: 12, textDecoration: 'underline',
            }}
          >← Voltar</button>
        </div>
      )}
    </div>
  );
}
