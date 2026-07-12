'use client';
// src/components/ui/TreatmentBadge.jsx
// Badge visual reutilizável para diferenciar tipos de tratamento em
// qualquer lista (MedsScreen, CalendarScreen, HomeScreen, etc.).

import { getTreatmentMeta, getTreatmentProgress } from '@/lib/treatmentTypes';

export function TreatmentBadge({ med, scale = 1, showProgress = false }) {
  const type = med?.treatment_type || 'continuous';
  const meta = getTreatmentMeta(type);
  const progress = showProgress ? getTreatmentProgress(med) : null;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10 * scale, fontWeight: 700, padding: '2px 9px',
      borderRadius: 99, background: meta.bg, color: meta.color,
    }}>
      <span>{meta.icon}</span>
      <span>{meta.shortLabel}</span>
      {progress && !progress.isExpired && (
        <span style={{ opacity: 0.85 }}>· Dia {progress.dayNumber}/{progress.totalDays}</span>
      )}
    </span>
  );
}

/**
 * Barra de progresso para tratamentos temporários. Retorna null se o
 * medicamento não for do tipo 'temporary'.
 */
export function TreatmentProgressBar({ med, T, scale = 1 }) {
  const progress = getTreatmentProgress(med);
  if (!progress) return null;
  const meta = getTreatmentMeta('temporary');

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: meta.color, fontSize: 10 * scale, fontWeight: 700 }}>
          Dia {progress.dayNumber} de {progress.totalDays}
        </span>
        <span style={{ color: T.muted, fontSize: 10 * scale, fontWeight: 700 }}>{progress.percent}%</span>
      </div>
      <div style={{ height: 5, background: T.bg3, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress.percent}%`, background: meta.color, borderRadius: 99, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}
