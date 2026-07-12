'use client';
// src/screens/StockHistoryScreen.jsx
// Tela "Histórico de Estoque" — acessível pelo Perfil.
// Permite escolher um medicamento e visualizar todas as movimentações
// (compras, ajustes, correções) além de estatísticas de reposição.

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { StockDB, getMovementMeta } from '@/lib/supabaseStock';
import { C } from '@/lib/theme';

// ─── Card de estatística individual ────────────────────────────────────────────
function StatBox({ icon, label, value, sub, color, T, scale }) {
  return (
    <div style={{ background: T.bg2, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <p style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</p>
      </div>
      <p style={{ color: color || T.txt, fontSize: 18 * scale, fontWeight: 900, lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ color: T.muted, fontSize: 10 * scale, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ─── Linha de movimentação ──────────────────────────────────────────────────────
function MovementRow({ mv, T, scale }) {
  const meta = getMovementMeta(mv.movement_type);
  const isIncrease = mv.quantity_changed > 0;

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '13px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}18`, border: `1.5px solid ${meta.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <p style={{ color: meta.color, fontWeight: 700, fontSize: 13 * scale }}>{meta.label}</p>
            <p style={{ color: isIncrease ? C.green : C.red, fontWeight: 800, fontSize: 13 * scale }}>
              {isIncrease ? '+' : ''}{mv.quantity_changed}
            </p>
          </div>
          <p style={{ color: T.muted, fontSize: 11 * scale }}>
            {new Date(mv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            {' · '}{mv.quantity_before} → {mv.quantity_after}
          </p>
          {(mv.purchase_location || mv.purchase_price) && (
            <p style={{ color: T.sub, fontSize: 11 * scale, marginTop: 3 }}>
              {mv.purchase_location && `🏪 ${mv.purchase_location}`}
              {mv.purchase_location && mv.purchase_price ? ' · ' : ''}
              {mv.purchase_price && `R$ ${Number(mv.purchase_price).toFixed(2)}`}
            </p>
          )}
          {mv.batch && <p style={{ color: T.muted, fontSize: 10 * scale }}>Lote: {mv.batch}</p>}
          {mv.expiration_date && <p style={{ color: T.muted, fontSize: 10 * scale }}>Validade: {new Date(mv.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
          {mv.notes && <p style={{ color: T.sub, fontSize: 11 * scale, fontStyle: 'italic', marginTop: 3 }}>{mv.notes}</p>}
        </div>
      </div>
    </div>
  );
}

export function StockHistoryScreen({ T, scale = 1 }) {
  const { meds } = useApp();
  const nonSOSMeds = meds.filter(m => (m.treatment_type || 'continuous') !== 'sos');

  const [selectedId, setSelectedId] = useState(nonSOSMeds[0]?.id || null);
  const [movements, setMovements]   = useState([]);
  const [forecast, setForecast]     = useState(null);
  const [loading, setLoading]       = useState(true);

  const selectedMed = meds.find(m => m.id === selectedId);

  const load = useCallback(async (medId) => {
    if (!medId) { setLoading(false); return; }
    setLoading(true);
    const [mvs, fc] = await Promise.all([
      StockDB.list(medId, 50),
      StockDB.getForecast(medId),
    ]);
    setMovements(mvs);
    setForecast(fc);
    setLoading(false);
  }, []);

  useEffect(() => { load(selectedId); }, [selectedId, load]);

  if (nonSOSMeds.length === 0) {
    return (
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 22, padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 44, marginBottom: 12 }}>📦</p>
        <p style={{ color: T.txt, fontSize: 16 * scale, fontWeight: 800, marginBottom: 6 }}>Nenhum medicamento cadastrado</p>
        <p style={{ color: T.sub, fontSize: 13 * scale }}>Cadastre um medicamento para acompanhar o histórico de estoque.</p>
      </div>
    );
  }

  return (
    <div className="anim-fadeUp">
      {/* Seletor de medicamento */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}>
        {nonSOSMeds.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              padding: '8px 16px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'pointer',
              fontSize: 12 * scale, fontWeight: 700,
              background: selectedId === m.id ? m.cor : T.bg3,
              color: selectedId === m.id ? '#fff' : T.sub,
              border: `1px solid ${selectedId === m.id ? m.cor : T.bdr}`,
            }}
          >
            {m.nome}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <span className="anim-blink" style={{ fontSize: 36 }}>📦</span>
        </div>
      ) : selectedMed && (
        <>
          {/* Estatísticas de reposição */}
          <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16, marginBottom: 16 }}>
            <p style={{ color: T.txt, fontSize: 14 * scale, fontWeight: 700, marginBottom: 12 }}>
              📊 {selectedMed.nome} — Estatísticas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatBox
                icon="🛒" label="Última compra" T={T} scale={scale}
                value={forecast?.last_purchase_date ? new Date(forecast.last_purchase_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
              />
              <StatBox
                icon="📦" label="Comprado este mês" T={T} scale={scale}
                value={forecast?.month_quantity_purchased ? `${forecast.month_quantity_purchased} ${selectedMed.unidade}s` : '—'}
              />
              <StatBox
                icon="⏳" label="Duração média" T={T} scale={scale}
                value={forecast?.avg_purchase_duration_days ? `${forecast.avg_purchase_duration_days} dias` : '—'}
              />
              <StatBox
                icon="🔮" label="Previsão de término" T={T} scale={scale}
                color={forecast?.days_remaining <= 7 ? C.red : forecast?.days_remaining <= 14 ? C.amber : C.green}
                value={forecast?.forecast_depletion_date ? new Date(forecast.forecast_depletion_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
                sub={forecast?.days_remaining != null ? `~${forecast.days_remaining} dias restantes` : 'Sem dados suficientes'}
              />
            </div>
          </div>

          {/* Lista de movimentações */}
          <p style={{ color: T.sub, fontSize: 11 * scale, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
            Movimentações
          </p>
          {movements.length === 0 ? (
            <p style={{ color: T.muted, fontSize: 13 * scale, textAlign: 'center', padding: '20px 0' }}>
              Nenhuma movimentação registrada ainda. Edite a quantidade deste medicamento para começar.
            </p>
          ) : (
            movements.map(mv => <MovementRow key={mv.id} mv={mv} T={T} scale={scale} />)
          )}
        </>
      )}
    </div>
  );
}
