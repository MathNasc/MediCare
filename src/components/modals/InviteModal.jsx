'use client';
// src/components/modals/InviteModal.jsx
// Modal de criação e compartilhamento de convite para cuidadores.
// Exibe link copiável, QR code, botões de WhatsApp e e-mail.
// Mantém estilo inline do projeto existente.

import { useState, useEffect } from 'react';
import { PERMISSION_LEVELS } from '@/hooks/useCaregiver';
import { C } from '@/lib/theme';

const LABELS = ['Mãe', 'Pai', 'Filho(a)', 'Cônjuge', 'Irmão(ã)', 'Cuidador(a)', 'Amigo(a)', 'Outro'];

// ─── QR Code via API pública ──────────────────────────────────────────────────
function QRCode({ url, size = 180 }) {
  const encoded = encodeURIComponent(url);
  const src     = `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&bgcolor=ffffff&color=0d1117&margin=4`;
  return (
    <img
      src={src}
      alt="QR Code do convite"
      width={size}
      height={size}
      style={{ borderRadius: 12, display: 'block' }}
    />
  );
}

// ─── Seletor de permissão ─────────────────────────────────────────────────────
function PermissionPicker({ value, onChange, T, scale }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {Object.entries(PERMISSION_LEVELS).map(([key, cfg]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: `2px solid ${value === key ? cfg.color : T.bdr}`,
            background: value === key ? `${cfg.color}12` : T.bg2,
            display: 'flex', alignItems: 'center', gap: 12,
            textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: value === key ? cfg.color : T.txt, fontWeight: 700, fontSize: 14 * scale }}>
              {cfg.label}
            </p>
            <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 2 }}>
              {cfg.description}
            </p>
          </div>
          {value === key && (
            <span style={{ color: cfg.color, fontSize: 18, flexShrink: 0 }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tela: configurar convite ─────────────────────────────────────────────────
function StepConfig({ onGenerate, T, scale }) {
  const [permission, setPermission] = useState('viewer');
  const [label, setLabel]           = useState('');
  const [customLabel, setCustomLabel] = useState('');

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`,
    borderRadius: 12, padding: '12px 14px',
    color: T.txt, fontSize: 14 * scale, width: '100%', outline: 'none',
  };

  return (
    <>
      <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
        Quem vai acompanhar?
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {LABELS.map(l => (
          <button
            key={l}
            onClick={() => { setLabel(l); setCustomLabel(''); }}
            style={{
              padding: '7px 14px', borderRadius: 99, fontSize: 12 * scale, fontWeight: 600,
              border: `1.5px solid ${label === l ? '#3b82f6' : T.bdr}`,
              background: label === l ? 'rgba(59,130,246,.12)' : T.bg3,
              color: label === l ? '#3b82f6' : T.sub, cursor: 'pointer',
            }}
          >{l}</button>
        ))}
      </div>
      {label === 'Outro' && (
        <input
          style={{ ...inp, marginBottom: 16 }}
          placeholder="Ex: Médico, Enfermeiro…"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
        />
      )}

      <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
        Nível de acesso
      </p>
      <PermissionPicker value={permission} onChange={setPermission} T={T} scale={scale} />

      <button
        onClick={() => onGenerate(permission, label === 'Outro' ? customLabel : label)}
        style={{
          width: '100%', padding: '16px', borderRadius: 13,
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          color: '#fff', fontWeight: 800, fontSize: 15 * scale,
          border: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)', cursor: 'pointer',
        }}
      >
        Gerar convite →
      </button>
    </>
  );
}

// ─── Tela: compartilhar convite ───────────────────────────────────────────────
function StepShare({ inviteUrl, onClose, T, scale }) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab]       = useState('qr'); // 'qr' | 'link'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para dispositivos sem clipboard API
      const el = document.createElement('textarea');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareWhatsApp = () => {
    const msg = `Olá! Estou usando o MediCare para gerenciar meus medicamentos e gostaria de compartilhar meu tratamento com você.\n\nAcesse o link para aceitar o convite:\n${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const shareEmail = () => {
    const subject = 'Convite MediCare – Acompanhe meu tratamento';
    const body    = `Olá!\n\nGostaria de compartilhar meu tratamento médico com você através do MediCare.\n\nClique no link abaixo para aceitar o convite:\n${inviteUrl}\n\nO convite expira em 7 dias.\n\nObrigado!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Convite MediCare', text: 'Acompanhe meu tratamento no MediCare', url: inviteUrl });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <>
      {/* Sucesso */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,.15)', border: '2px solid rgba(34,197,94,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 10px' }}>✓</div>
        <p style={{ color: T.txt, fontWeight: 800, fontSize: 16 * scale }}>Convite criado!</p>
        <p style={{ color: T.sub, fontSize: 12 * scale, marginTop: 4 }}>Válido por 7 dias · Compartilhe como preferir</p>
      </div>

      {/* Tabs QR / Link */}
      <div style={{ display: 'flex', background: T.bg3, borderRadius: 10, padding: 4, marginBottom: 16, gap: 4 }}>
        {[{ id: 'qr', label: '📷 QR Code' }, { id: 'link', label: '🔗 Link' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12 * scale, fontWeight: 700,
            background: tab === t.id ? T.bg1 : 'none',
            color: tab === t.id ? T.txt : T.sub,
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* QR Code */}
      {tab === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 16px' }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 12, boxShadow: '0 4px 24px rgba(0,0,0,.25)' }}>
            <QRCode url={inviteUrl} size={180} />
          </div>
          <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 10 }}>Mostre este código para o cuidador escanear</p>
        </div>
      )}

      {/* Link copiável */}
      {tab === 'link' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            background: T.bg2, borderRadius: 12, padding: '12px 14px',
            border: `1px solid ${T.bdr}`, wordBreak: 'break-all',
            fontSize: 11 * scale, color: T.sub, lineHeight: 1.6, marginBottom: 8,
          }}>
            {inviteUrl}
          </div>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '13px', borderRadius: 11,
              background: copied ? 'rgba(34,197,94,.15)' : T.bg3,
              color: copied ? '#22c55e' : T.txt,
              fontWeight: 700, fontSize: 14 * scale,
              border: `1px solid ${copied ? 'rgba(34,197,94,.3)' : T.bdr}`,
              cursor: 'pointer', transition: 'all .2s',
            }}
          >
            {copied ? '✓ Link copiado!' : '📋 Copiar link'}
          </button>
        </div>
      )}

      {/* Botões de compartilhamento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button
          onClick={shareWhatsApp}
          style={{
            padding: '14px', borderRadius: 12,
            background: 'rgba(37,211,102,.12)', color: '#25d366',
            fontWeight: 700, fontSize: 13 * scale,
            border: '1px solid rgba(37,211,102,.3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span> WhatsApp
        </button>
        <button
          onClick={shareEmail}
          style={{
            padding: '14px', borderRadius: 12,
            background: T.bg3, color: T.txt,
            fontWeight: 700, fontSize: 13 * scale,
            border: `1px solid ${T.bdr}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 18 }}>✉️</span> E-mail
        </button>
      </div>
      {'share' in navigator && (
        <button
          onClick={shareNative}
          style={{
            width: '100%', padding: '13px', borderRadius: 11,
            background: 'rgba(59,130,246,.1)', color: '#3b82f6',
            fontWeight: 700, fontSize: 13 * scale,
            border: '1px solid rgba(59,130,246,.3)', cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          📤 Compartilhar
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '12px', borderRadius: 11,
          background: 'none', color: T.muted, fontSize: 13 * scale, border: 'none', cursor: 'pointer',
        }}
      >
        Fechar
      </button>
    </>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export function InviteModal({ onGenerate, onClose, T, scale = 1 }) {
  const [step, setStep]         = useState('config'); // 'config' | 'share'
  const [inviteUrl, setInviteUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (permission, label) => {
    setGenerating(true);
    const result = await onGenerate({ permissionLevel: permission, relationshipLabel: label });
    setGenerating(false);
    if (result?.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      setStep('share');
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Convidar cuidador"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(16px)',
        zIndex: 300,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="anim-fadeUp"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg1,
          borderRadius: '28px 28px 0 0',
          width: '100%', maxWidth: 480,
          maxHeight: '92vh', overflowY: 'auto',
          paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${T.bdr}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: T.bg1, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'share' && (
              <button
                onClick={() => setStep('config')}
                style={{ width: 34, height: 34, borderRadius: '50%', background: T.bg3, border: 'none', color: T.sub, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >‹</button>
            )}
            <div>
              <h2 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 900 }}>
                {step === 'config' ? 'Convidar cuidador' : 'Compartilhar convite'}
              </h2>
              <p style={{ color: T.sub, fontSize: 11 * scale }}>
                {step === 'config' ? 'Configure quem e como vai acompanhar' : 'Escolha como enviar o convite'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 36, height: 36, borderRadius: '50%', background: T.bg3, border: 'none', color: T.sub, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >×</button>
        </div>

        <div style={{ padding: 20 }}>
          {generating ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span className="anim-blink" style={{ fontSize: 40 }}>🔗</span>
              <p style={{ color: T.sub, marginTop: 12, fontSize: 14 * scale }}>Gerando convite seguro…</p>
            </div>
          ) : step === 'config' ? (
            <StepConfig onGenerate={handleGenerate} T={T} scale={scale} />
          ) : (
            <StepShare inviteUrl={inviteUrl} onClose={onClose} T={T} scale={scale} />
          )}
        </div>
      </div>
    </div>
  );
}
