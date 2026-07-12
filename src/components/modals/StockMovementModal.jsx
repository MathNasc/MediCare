'use client';
// src/components/modals/StockMovementModal.jsx
// Modal exibido automaticamente quando o usuário altera manualmente a
// quantidade de um medicamento (dentro de MedModal, ao editar).
//
// Aumento de quantidade  → tipo padrão "Compra" (com campos opcionais de
//                          farmácia/valor/lote/validade) ou "Correção".
// Redução de quantidade  → tipo "Ajuste Manual" ou "Correção", com motivo.
//
// Todos os campos além da quantidade em si são opcionais — o usuário pode
// simplesmente confirmar sem preencher nada.

import { useState } from 'react';
import { C } from '@/lib/theme';

const ADJUSTMENT_REASONS = ['Perda', 'Erro de contagem', 'Vencimento', 'Danificado'];

export function StockMovementModal({ med, quantityBefore, quantityAfter, onConfirm, onClose, T, scale = 1 }) {
  const diff        = quantityAfter - quantityBefore;
  const isIncrease  = diff > 0;

  const [subType, setSubType] = useState(isIncrease ? 'purchase' : 'adjustment');
  const [purchaseLocation, setPurchaseLocation] = useState('');
  const [purchasePrice, setPurchasePrice]       = useState('');
  const [batch, setBatch]                       = useState('');
  const [expirationDate, setExpirationDate]     = useState('');
  const [notes, setNotes]                       = useState('');
  const [saving, setSaving]                     = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm({
      movementType: subType,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      purchaseLocation: purchaseLocation.trim() || null,
      batch: batch.trim() || null,
      expirationDate: expirationDate || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  };

  const inp = {
    background: T.inp, border: `1.5px solid ${T.inpB}`, borderRadius: 12,
    padding: '11px 13px', color: T.txt, fontSize: 13 * scale, width: '100%', outline: 'none',
  };
  const label = {
    color: T.sub, fontSize: 10.5 * scale, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.5px', display: 'block', marginBottom: 6,
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isIncrease ? 'Reposição de estoque' : 'Ajuste de estoque'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', zIndex: 340, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        className="anim-fadeUp"
        onClick={e => e.stopPropagation()}
        style={{ background: T.bg1, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', paddingBottom: 32 }}
      >
        {/* Header */}
        <div style={{ padding: '22px 20px 16px', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 12px',
            background: isIncrease ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
            border: `2px solid ${isIncrease ? 'rgba(34,197,94,.4)' : 'rgba(245,158,11,.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {isIncrease ? '📦' : '📉'}
          </div>
          <h3 style={{ color: T.txt, fontSize: 18 * scale, fontWeight: 900, marginBottom: 6 }}>
            {isIncrease ? 'Reposição de estoque' : 'Ajuste de estoque'}
          </h3>
          <p style={{ color: T.sub, fontSize: 13 * scale, lineHeight: 1.5 }}>
            Você {isIncrease ? 'adicionou' : 'removeu'}{' '}
            <strong style={{ color: isIncrease ? C.green : C.amber }}>{Math.abs(diff)} {med.unidade}{Math.abs(diff) !== 1 ? 's' : ''}</strong>
            {' '}ao medicamento <strong style={{ color: T.txt }}>{med.nome}</strong>.
          </p>
          <p style={{ color: T.muted, fontSize: 11 * scale, marginTop: 4 }}>
            Estoque: {quantityBefore} → {quantityAfter} {med.unidade}s
          </p>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* Seletor de subtipo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {isIncrease ? (
              <>
                <button onClick={() => setSubType('purchase')} style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 12 * scale, fontWeight: 700, border: `1.5px solid ${subType === 'purchase' ? '#22c55e' : T.bdr}`, background: subType === 'purchase' ? 'rgba(34,197,94,.1)' : T.bg2, color: subType === 'purchase' ? '#22c55e' : T.sub, cursor: 'pointer' }}>🛒 Compra</button>
                <button onClick={() => setSubType('correction')} style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 12 * scale, fontWeight: 700, border: `1.5px solid ${subType === 'correction' ? '#3b82f6' : T.bdr}`, background: subType === 'correction' ? 'rgba(59,130,246,.1)' : T.bg2, color: subType === 'correction' ? '#3b82f6' : T.sub, cursor: 'pointer' }}>✏️ Correção</button>
              </>
            ) : (
              <>
                <button onClick={() => setSubType('adjustment')} style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 12 * scale, fontWeight: 700, border: `1.5px solid ${subType === 'adjustment' ? '#f59e0b' : T.bdr}`, background: subType === 'adjustment' ? 'rgba(245,158,11,.1)' : T.bg2, color: subType === 'adjustment' ? '#f59e0b' : T.sub, cursor: 'pointer' }}>📉 Ajuste Manual</button>
                <button onClick={() => setSubType('correction')} style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 12 * scale, fontWeight: 700, border: `1.5px solid ${subType === 'correction' ? '#3b82f6' : T.bdr}`, background: subType === 'correction' ? 'rgba(59,130,246,.1)' : T.bg2, color: subType === 'correction' ? '#3b82f6' : T.sub, cursor: 'pointer' }}>✏️ Correção</button>
              </>
            )}
          </div>

          {/* Campos opcionais — apenas para compra */}
          {isIncrease && subType === 'purchase' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={label}>Farmácia / Local da compra</label>
                <input style={inp} placeholder="Ex: Drogasil, Farmácia São Paulo…" value={purchaseLocation} onChange={e => setPurchaseLocation(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={label}>Valor pago (R$)</label>
                  <input type="number" min="0" step="0.01" style={inp} placeholder="0,00" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
                </div>
                <div>
                  <label style={label}>Lote</label>
                  <input style={inp} placeholder="Opcional" value={batch} onChange={e => setBatch(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={label}>Data de validade</label>
                <input type="date" style={inp} value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
              </div>
            </div>
          )}

          {/* Motivo — para ajuste manual ou correção */}
          {(subType === 'adjustment' || subType === 'correction') && !isIncrease && (
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Motivo</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {ADJUSTMENT_REASONS.map(r => (
                  <button key={r} onClick={() => setNotes(r)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 11 * scale, fontWeight: 600, border: `1.5px solid ${notes === r ? '#3b82f6' : T.bdr}`, background: notes === r ? 'rgba(59,130,246,.12)' : T.bg3, color: notes === r ? '#3b82f6' : T.sub, cursor: 'pointer' }}>{r}</button>
                ))}
              </div>
            </div>
          )}

          {/* Observações — sempre disponível */}
          <div style={{ marginBottom: 8 }}>
            <label style={label}>Observações {isIncrease ? '(opcional)' : ''}</label>
            <textarea rows={2} style={{ ...inp, resize: 'none' }} placeholder="Detalhes adicionais…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <p style={{ color: T.muted, fontSize: 10.5 * scale, textAlign: 'center', marginBottom: 16 }}>
            Todos os campos acima são opcionais.
          </p>

          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              width: '100%', padding: '15px', borderRadius: 13,
              background: isIncrease ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
              color: '#fff', fontWeight: 800, fontSize: 15 * scale, border: 'none',
              boxShadow: `0 4px 20px ${isIncrease ? 'rgba(34,197,94,.35)' : 'rgba(245,158,11,.35)'}`,
              cursor: 'pointer', marginBottom: 8, opacity: saving ? .7 : 1,
            }}
          >
            {saving ? 'Salvando…' : isIncrease ? '✓ Salvar reposição' : '✓ Salvar ajuste'}
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'none', color: T.muted, fontSize: 13, border: 'none', cursor: 'pointer' }}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
