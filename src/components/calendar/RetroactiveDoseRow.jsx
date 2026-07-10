'use client';
// src/components/calendar/RetroactiveDoseRow.jsx
//
// Componente plugável para uso dentro do painel de dia do CalendarScreen.jsx.
// Não reescrevi o CalendarScreen.jsx inteiro porque nunca recebi o arquivo
// original — evitar isso é proposital, para não arriscar quebrar uma tela
// que já está em produção. Este componente é a peça que falta: basta
// importar e renderizar dentro do loop de medicamentos do dia.
//
// ─── Como integrar (3 passos) ─────────────────────────────────────────────────
//
// 1. No topo do CalendarScreen.jsx:
//      import { RetroactiveDoseRow } from '@/components/calendar/RetroactiveDoseRow';
//      import { usePermissions } from '@/hooks/usePermissions';
//      import { useApp } from '@/context/AppContext';
//
// 2. Dentro do componente da tela:
//      const { confirmDoseRetroactive } = useApp();
//      const { role, canEditDose } = usePermissions();
//
// 3. Onde hoje você renderiza cada medicamento agendado do dia selecionado
//    (algo como `scheduledDoses.map(dose => ...)`), troque o item por:
//
//      <RetroactiveDoseRow
//        key={`${dose.medId}-${dose.hora}`}
//        dose={dose}                 // { medId, nome, dosagem, cor, hora, confirmed, record }
//        selectedDate={selectedDate} // string 'YYYY-MM-DD' do dia exibido
//        role={role}
//        onConfirm={confirmDoseRetroactive}
//        T={T}
//        scale={scale}
//      />
//
// `dose.record` (se existir) deve conter os campos vindos de historico_doses:
// { status, performed_by, is_retroactive, corrected_at, created_at }.
// Isso já é o formato retornado por HistDB.list / SupaHist.list.

import { useState } from 'react';
import { RetroactiveConfirmModal } from '@/components/modals/RetroactiveConfirmModal';
import { CaregiverBadge } from '@/components/ui/CaregiverBadge';
import { canEditDoseAsSelf } from '@/lib/permissions';
import { C } from '@/lib/theme';

export function RetroactiveDoseRow({ dose, selectedDate, role, userId, onConfirm, T, scale = 1 }) {
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState('');

  const isPastDay = new Date(selectedDate) < new Date(new Date().toDateString());
  const isToday   = selectedDate === new Date().toISOString().slice(0, 10);
  const isEditable = isPastDay
    ? canEditDoseAsSelf(role, `${selectedDate}T${dose.hora}:00`, dose.record?.performed_by, userId)
    : false; // hoje usa o fluxo normal de confirmação (QuickConfirm), não o retroativo

  const handleConfirm = async (reason) => {
    const result = await onConfirm({
      medId:    dose.medId,
      hora:     dose.hora,
      doseDate: selectedDate,
      newStatus: 'confirmed',
      reason, // opcional quando o próprio usuário corrige (validado no banco)
    });
    if (result?.success) {
      setShowModal(false);
      setToast('✓ Confirmado!');
      setTimeout(() => setToast(''), 2000);
    }
    return result;
  };

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${dose.cor || '#3b82f6'}22`, border: `2px solid ${dose.cor || '#3b82f6'}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>💊</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: T.txt, fontWeight: 700, fontSize: 13 * scale }}>
            {dose.nome} · {dose.hora}
          </p>
          <p style={{
            color: dose.confirmed ? '#22c55e' : (isPastDay ? C.red : C.amber),
            fontSize: 11 * scale, fontWeight: 600,
          }}>
            {dose.confirmed ? '✓ Confirmada' : isPastDay ? 'Não confirmada' : 'Pendente'}
          </p>
        </div>

        {!dose.confirmed && isPastDay && isEditable && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 11 * scale, fontWeight: 700,
              background: 'rgba(59,130,246,.12)', color: '#3b82f6',
              border: '1px solid rgba(59,130,246,.3)', cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            🕐 Confirmar retroativamente
          </button>
        )}

        {!dose.confirmed && isPastDay && !isEditable && (
          <span style={{ color: T.muted, fontSize: 10 * scale, flexShrink: 0, textAlign: 'right', maxWidth: 110 }}>
            {role === 'paciente' ? 'Prazo de 24h expirado' : 'Feito por um cuidador'}
          </span>
        )}
      </div>

      {/* Badge de transparência quando a dose foi corrigida por um cuidador ou retroativamente */}
      {dose.record?.performed_by && (
        <CaregiverBadge
          correctedByOther={dose.record.performed_by !== userId}
          isRetroactive={dose.record.is_retroactive}
          correctedAt={dose.record.corrected_at}
          scale={scale}
        />
      )}

      {toast && (
        <p style={{ color: '#22c55e', fontSize: 11 * scale, fontWeight: 700, marginTop: 6 }}>{toast}</p>
      )}

      {showModal && (
        <RetroactiveConfirmModal
          dose={{ nome: dose.nome, dosagem: dose.dosagem, hora: dose.hora, date: selectedDate }}
          requireReason={false} // o próprio usuário corrigindo — motivo opcional
          onConfirm={handleConfirm}
          onClose={() => setShowModal(false)}
          T={T}
          scale={scale}
        />
      )}
    </div>
  );
}
