import { EventEmitter } from 'events';

const BUS_KEY = '__medicareChatRealtimeBus';
const CHANNEL_NAME = 'medicare_chat_events';

function getChatBus() {
  if (!globalThis[BUS_KEY]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalThis[BUS_KEY] = emitter;
  }
  return globalThis[BUS_KEY];
}

export function getChatThreadKey(patientId, caregiverId) {
  return `${String(patientId || '').toLowerCase()}:${String(caregiverId || '').toLowerCase()}`;
}

export function publishLocalChatEvent(eventPayload) {
  try {
    const bus = getChatBus();
    bus.emit('chat_event', eventPayload);
  } catch {
    // ignore local emit errors
  }
}

export function subscribeChatEvents(listener) {
  const bus = getChatBus();
  bus.on('chat_event', listener);
  return () => {
    bus.off('chat_event', listener);
  };
}

export async function emitChatRealtimeNotification(client, payload) {
  publishLocalChatEvent(payload);
  if (client && typeof client.query === 'function') {
    try {
      await client.query(`SELECT pg_notify($1, $2)`, [CHANNEL_NAME, JSON.stringify(payload)]);
    } catch {
      // pg_notify é opcional; o barramento em memória e polling garantem a entrega
    }
  }
}

export function sanitizeChatMessageText(raw) {
  const cleaned = String(raw || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!cleaned) return '';
  return cleaned.slice(0, 2000);
}

/**
 * Valida se o usuário autenticado tem vínculo ativo para conversar neste par (paciente <-> cuidador).
 * Regra crítica de domínio:
 * - Deve existir vínculo ativo (`caregiver_relationships.status = 'active'`) entre patient_id e caregiver_id.
 * - Contas de perfil `independente` NÃO utilizam o chat com cuidador.
 */
export async function resolveAuthorizedChatContext(client, requesterId, { patientId = '', caregiverId = '' } = {}) {
  const reqId = String(requesterId || '').trim();
  if (!reqId) return { ok: false, status: 401, error: 'Não autenticado.' };

  const profRes = await client.query(
    `SELECT id, nome, role FROM profiles WHERE id::text = $1::text LIMIT 1`,
    [reqId]
  );
  const myProfile = profRes.rows?.[0] || null;
  const myRole = String(myProfile?.role || 'independente').trim().toLowerCase();

  // Caso 1: Cuidador conversando com um paciente específico
  if (patientId && patientId.toLowerCase() !== reqId.toLowerCase()) {
    const linkRes = await client.query(
      `SELECT cr.id AS relationship_id,
              cr.patient_id,
              cr.caregiver_id,
              cr.relationship_label,
              p.nome AS patient_name,
              p.role AS patient_role
       FROM caregiver_relationships cr
       JOIN profiles p ON p.id = cr.patient_id
       WHERE cr.patient_id::text = $1::text
         AND cr.caregiver_id::text = $2::text
         AND cr.status = 'active'
       LIMIT 1`,
      [patientId, reqId]
    );
    if (linkRes.rowCount === 0) {
      return {
        ok: false,
        status: 403,
        error: 'Sem vínculo ativo autorizado com este paciente.',
      };
    }
    const row = linkRes.rows[0];
    if (String(row.patient_role || '').trim().toLowerCase() === 'independente') {
      return {
        ok: false,
        status: 403,
        error: 'Este usuário está no perfil Independente e utiliza apenas o Assistente de Saúde.',
      };
    }
    return {
      ok: true,
      senderRole: 'cuidador',
      relationshipId: row.relationship_id,
      patientId: String(row.patient_id),
      caregiverId: String(row.caregiver_id),
      patientName: row.patient_name || 'Paciente',
      caregiverName: myProfile?.nome || 'Cuidador',
      relationshipLabel: row.relationship_label || 'Cuidador',
    };
  }

  // Caso 2: Paciente conversando com seu cuidador ativo
  if (myRole === 'independente') {
    return {
      ok: false,
      status: 403,
      error: 'Perfis independentes não possuem chat com cuidador. Utilize o Assistente de Saúde com IA.',
    };
  }

  let linkQuery = `
    SELECT cr.id AS relationship_id,
           cr.patient_id,
           cr.caregiver_id,
           cr.relationship_label,
           cp.nome AS caregiver_name
    FROM caregiver_relationships cr
    LEFT JOIN profiles cp ON cp.id = cr.caregiver_id
    WHERE cr.patient_id::text = $1::text
      AND cr.caregiver_id IS NOT NULL
      AND cr.status = 'active'
  `;
  const params = [reqId];
  if (caregiverId) {
    params.push(caregiverId);
    linkQuery += ` AND cr.caregiver_id::text = $2::text`;
  }
  linkQuery += ` ORDER BY cr.created_at ASC LIMIT 1`;

  const linkRes = await client.query(linkQuery, params);
  if (linkRes.rowCount === 0) {
    return {
      ok: false,
      status: 403,
      error: 'Você não possui cuidador ativo vinculado no momento.',
    };
  }

  const row = linkRes.rows[0];
  return {
    ok: true,
    senderRole: 'paciente',
    relationshipId: row.relationship_id,
    patientId: String(row.patient_id),
    caregiverId: String(row.caregiver_id),
    patientName: myProfile?.nome || 'Paciente',
    caregiverName: row.caregiver_name || 'Cuidador',
    relationshipLabel: row.relationship_label || 'Familiar / Cuidador',
  };
}
