'use client';
import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { NextDoseHero, DayProgress, Timeline } from '@/components/Dashboard';
import { C } from '@/lib/theme';
import { greet } from '@/lib/doseUtils';

export function HomeScreen({ T, scale, onQuickConfirm, toggle, dark }) {
  const { user, doses, meds } = useApp();

  const nextDose = useMemo(() => {
    const active = doses.filter((d) => !['confirmed', 'missed'].includes(d.status));
    if (active.length === 0) return doses.find((d) => d.status === 'confirmed') || null;
    return active.find((d) => ['late', 'pending', 'upcoming'].includes(d.status)) || active[0];
  }, [doses]);

  const criticalMeds = meds.filter((m) => m.quantidade <= 5);

  return (
    <div className="anim-fadeUp">
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ color: T.sub, fontSize: 12 * scale, fontWeight: 500 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 style={{ color: T.txt, fontSize: 23 * scale, fontWeight: 900, marginTop: 2, letterSpacing: '-.5px' }}>
            {greet(user?.nome)} 👋
          </h1>
        </div>
        <button
          onClick={toggle}
          aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          style={{ width: 44, height: 44, borderRadius: 13, background: T.bg1, border: `1px solid ${T.bdr}`, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Critical stock alert */}
      {criticalMeds.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
          <div>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 13 * scale }}>Estoque crítico</p>
            <p style={{ color: '#fca5a5', fontSize: 12 * scale, marginTop: 1 }}>
              {criticalMeds.map((m) => `${m.nome} (${m.quantidade})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Next dose hero */}
      {nextDose && <NextDoseHero dose={nextDose} onConfirm={onQuickConfirm} T={T} scale={scale} />}

      {/* Progress */}
      <DayProgress doses={doses} T={T} scale={scale} />

      {/* Timeline */}
      <div style={{ background: T.bg1, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 16 }}>
        <p style={{ color: T.txt, fontSize: 15 * scale, fontWeight: 700, marginBottom: 16 }}>📅 Linha do dia</p>
        {doses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>💊</p>
            <p style={{ color: T.sub, fontSize: 14 * scale }}>Adicione medicamentos na aba Meds</p>
          </div>
        ) : (
          <Timeline doses={doses} onAction={onQuickConfirm} T={T} scale={scale} />
        )}
      </div>
    </div>
  );
}
