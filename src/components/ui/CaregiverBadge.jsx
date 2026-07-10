'use client';
// src/components/ui/CaregiverBadge.jsx
// Indicador visual de transparência: mostra quando um registro de dose
// foi confirmado ou corrigido por um cuidador (ou retroativamente).

import { C } from '@/lib/theme';

/**
 * @param {object} props
 * @param {boolean} props.correctedByOther - true se performed_by !== user_id
 * @param {string}  props.correctorName    - nome de quem corrigiu
 * @param {boolean} props.isRetroactive    - true se a dose foi confirmada fora do horário original
 * @param {string}  props.correctedAt      - timestamp ISO da correção
 */
export function CaregiverBadge({ correctedByOther, correctorName, isRetroactive, correctedAt, scale = 1 }) {
  if (!correctedByOther && !isRetroactive) return null;

  const label = correctedByOther
    ? `Confirmado pelo cuidador${correctorName ? ` · ${correctorName}` : ''}`
    : 'Registro corrigido retroativamente';

  const dateLabel = correctedAt
    ? new Date(correctedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: correctedByOther ? 'rgba(139,92,246,.12)' : 'rgba(245,158,11,.12)',
      border: `1px solid ${correctedByOther ? 'rgba(139,92,246,.3)' : 'rgba(245,158,11,.3)'}`,
      borderRadius: 99,
      padding: '3px 10px',
      marginTop: 4,
    }}>
      <span style={{ fontSize: 10 * scale }}>{correctedByOther ? '🤝' : '🕐'}</span>
      <span style={{
        fontSize: 10 * scale,
        fontWeight: 700,
        color: correctedByOther ? '#8b5cf6' : C.amber,
      }}>
        {label}{dateLabel ? ` · ${dateLabel}` : ''}
      </span>
    </div>
  );
}
