import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { connectPgOrFallback } from '@/lib/oracleProxy';
import { extractAuthenticatedUser, verifyActiveSessionInDb, checkRateLimit } from '@/lib/oracleAuth';
import { sendWebPushToUsers } from '@/lib/caregiverNotifications';
import {
  emitChatRealtimeNotification,
  getChatThreadKey,
  resolveAuthorizedChatContext,
  sanitizeChatMessageText,
} from '@/lib/chatRealtime';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req) {
  const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/chat');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const summaryOnly = searchParams.get('summary') === '1';
  const patientIdParam = String(searchParams.get('patientId') || '').trim();
  const caregiverIdParam = String(searchParams.get('caregiverId') || '').trim();
  const afterParam = String(searchParams.get('after') || '').trim();
  const limit = Math.max(10, Math.min(200, Number(searchParams.get('limit') || 80) || 80));

  if ((patientIdParam && !UUID_REGEX.test(patientIdParam)) || (caregiverIdParam && !UUID_REGEX.test(caregiverIdParam))) {
    client.release();
    return NextResponse.json({ error: 'Identificador de vínculo inválido.' }, { status: 400, headers: corsHeaders });
  }

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const requesterId = String(claims.sub);

    // Modo resumo de não lidas por paciente para o painel do cuidador
    if (summaryOnly) {
      const unreadRes = await client.query(
        `SELECT m.patient_id::text AS patient_id,
                COUNT(*)::int AS unread_count,
                MAX(m.created_at) AS last_message_at
         FROM caregiver_chat_messages m
         JOIN caregiver_relationships cr
           ON cr.patient_id = m.patient_id
          AND cr.caregiver_id = m.caregiver_id
          AND cr.status = 'active'
         WHERE m.caregiver_id::text = $1::text
           AND m.sender_role = 'paciente'
           AND m.read_at IS NULL
         GROUP BY m.patient_id`,
        [requesterId]
      );
      const unreadByPatient = {};
      let totalUnread = 0;
      for (const row of unreadRes.rows || []) {
        unreadByPatient[row.patient_id] = Number(row.unread_count || 0);
        totalUnread += Number(row.unread_count || 0);
      }
      return NextResponse.json(
        { ok: true, totalUnread, unreadByPatient },
        { status: 200, headers: corsHeaders }
      );
    }

    const ctx = await resolveAuthorizedChatContext(client, requesterId, {
      patientId: patientIdParam,
      caregiverId: caregiverIdParam,
    });
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers: corsHeaders });
    }

    let sql = `
      SELECT m.id::text AS id,
             m.relationship_id::text AS relationship_id,
             m.patient_id::text AS patient_id,
             m.caregiver_id::text AS caregiver_id,
             m.sender_id::text AS sender_id,
             m.sender_role,
             m.message,
             m.read_at,
             m.created_at,
             COALESCE(p.nome, CASE WHEN m.sender_role = 'cuidador' THEN 'Cuidador' ELSE 'Paciente' END) AS sender_name
      FROM caregiver_chat_messages m
      LEFT JOIN profiles p ON p.id = m.sender_id
      WHERE m.patient_id::text = $1::text
        AND m.caregiver_id::text = $2::text
    `;
    const params = [ctx.patientId, ctx.caregiverId];

    if (afterParam) {
      params.push(afterParam);
      sql += ` AND m.created_at > $3::timestamptz ORDER BY m.created_at ASC LIMIT ${limit}`;
    } else {
      sql += ` ORDER BY m.created_at DESC LIMIT ${limit}`;
    }

    const msgRes = await client.query(sql, params);
    const messages = afterParam ? msgRes.rows || [] : (msgRes.rows || []).reverse();

    const unreadCountRes = await client.query(
      `SELECT COUNT(*)::int AS unread
       FROM caregiver_chat_messages
       WHERE patient_id::text = $1::text
         AND caregiver_id::text = $2::text
         AND sender_role <> $3
         AND read_at IS NULL`,
      [ctx.patientId, ctx.caregiverId, ctx.senderRole]
    );

    return NextResponse.json(
      {
        ok: true,
        threadKey: getChatThreadKey(ctx.patientId, ctx.caregiverId),
        patientId: ctx.patientId,
        caregiverId: ctx.caregiverId,
        patientName: ctx.patientName,
        caregiverName: ctx.caregiverName,
        relationshipLabel: ctx.relationshipLabel,
        viewerRole: ctx.senderRole,
        unreadCount: Number(unreadCountRes.rows?.[0]?.unread || 0),
        messages,
      },
      { status: 200, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function POST(req) {
  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/chat');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const requesterId = String(claims.sub);
  if (!checkRateLimit(`chat_send:${requesterId}`, 40, 60_000)) {
    client.release();
    return NextResponse.json(
      { error: 'Muitas mensagens enviadas em sequência. Aguarde alguns segundos.' },
      { status: 429, headers: corsHeaders }
    );
  }

  const body = await req.json().catch(() => ({}));
  const patientIdParam = String(body?.patientId || '').trim();
  const caregiverIdParam = String(body?.caregiverId || '').trim();
  const clientMsgId = String(body?.id || '').trim();
  const cleanMessage = sanitizeChatMessageText(body?.message);

  if (!cleanMessage) {
    client.release();
    return NextResponse.json({ error: 'Digite uma mensagem antes de enviar.' }, { status: 400, headers: corsHeaders });
  }
  if (clientMsgId && !UUID_REGEX.test(clientMsgId)) {
    client.release();
    return NextResponse.json({ error: 'ID da mensagem inválido.' }, { status: 400, headers: corsHeaders });
  }
  if ((patientIdParam && !UUID_REGEX.test(patientIdParam)) || (caregiverIdParam && !UUID_REGEX.test(caregiverIdParam))) {
    client.release();
    return NextResponse.json({ error: 'Identificador de vínculo inválido.' }, { status: 400, headers: corsHeaders });
  }

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const ctx = await resolveAuthorizedChatContext(client, requesterId, {
      patientId: patientIdParam,
      caregiverId: caregiverIdParam,
    });
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers: corsHeaders });
    }

    const msgId = clientMsgId || crypto.randomUUID();
    const insertRes = await client.query(
      `INSERT INTO caregiver_chat_messages (
         id, relationship_id, patient_id, caregiver_id, sender_id, sender_role, message, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO NOTHING
       RETURNING id::text AS id,
                 relationship_id::text AS relationship_id,
                 patient_id::text AS patient_id,
                 caregiver_id::text AS caregiver_id,
                 sender_id::text AS sender_id,
                 sender_role,
                 message,
                 read_at,
                 created_at`,
      [
        msgId,
        ctx.relationshipId || null,
        ctx.patientId,
        ctx.caregiverId,
        requesterId,
        ctx.senderRole,
        cleanMessage,
      ]
    );

    let savedRow = insertRes.rows?.[0] || null;
    const isDuplicate = !savedRow;
    if (!savedRow) {
      const existingRes = await client.query(
        `SELECT id::text AS id,
                relationship_id::text AS relationship_id,
                patient_id::text AS patient_id,
                caregiver_id::text AS caregiver_id,
                sender_id::text AS sender_id,
                sender_role,
                message,
                read_at,
                created_at
         FROM caregiver_chat_messages
         WHERE id::text = $1::text
         LIMIT 1`,
        [msgId]
      );
      savedRow = existingRes.rows?.[0] || null;
    }

    const enrichedMessage = {
      ...savedRow,
      sender_name: ctx.senderRole === 'cuidador' ? ctx.caregiverName : ctx.patientName,
    };

    if (!isDuplicate) {
      await emitChatRealtimeNotification(client, {
        type: 'chat_message',
        threadKey: getChatThreadKey(ctx.patientId, ctx.caregiverId),
        patientId: ctx.patientId,
        caregiverId: ctx.caregiverId,
        message: enrichedMessage,
      });

      // Quando o paciente envia mensagem, avisa o cuidador via Web Push / notificação (com debounce de 2 min)
      if (ctx.senderRole === 'paciente') {
        const recentNotif = await client
          .query(
            `SELECT id FROM notificacoes
             WHERE user_id::text = $1::text
               AND tipo = 'mensagem'
               AND lida = FALSE
               AND created_at > NOW() - interval '2 minutes'
             LIMIT 1`,
            [ctx.caregiverId]
          )
          .catch(() => ({ rowCount: 0 }));

        if (recentNotif.rowCount === 0) {
          const preview = cleanMessage.length > 90 ? `${cleanMessage.slice(0, 90)}...` : cleanMessage;
          await client
            .query(
              `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida, created_at)
               VALUES ($1, $2, 'mensagem', $3, $4, FALSE, NOW())`,
              [
                crypto.randomUUID(),
                ctx.caregiverId,
                `Mensagem de ${ctx.patientName}`,
                preview,
              ]
            )
            .catch(() => {});

          await sendWebPushToUsers(client, [ctx.caregiverId], {
            title: `💬 Nova mensagem de ${ctx.patientName}`,
            body: preview,
            url: '/cuidador',
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json(
      { ok: true, message: enrichedMessage },
      { status: isDuplicate ? 200 : 201, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(req) {
  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/chat');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const patientIdParam = String(body?.patientId || '').trim();
  const caregiverIdParam = String(body?.caregiverId || '').trim();

  if ((patientIdParam && !UUID_REGEX.test(patientIdParam)) || (caregiverIdParam && !UUID_REGEX.test(caregiverIdParam))) {
    client.release();
    return NextResponse.json({ error: 'Identificador de vínculo inválido.' }, { status: 400, headers: corsHeaders });
  }

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const ctx = await resolveAuthorizedChatContext(client, String(claims.sub), {
      patientId: patientIdParam,
      caregiverId: caregiverIdParam,
    });
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers: corsHeaders });
    }

    const updatedRes = await client.query(
      `UPDATE caregiver_chat_messages
       SET read_at = NOW()
       WHERE patient_id::text = $1::text
         AND caregiver_id::text = $2::text
         AND sender_role <> $3
         AND read_at IS NULL
       RETURNING id::text AS id`,
      [ctx.patientId, ctx.caregiverId, ctx.senderRole]
    );

    if (updatedRes.rowCount > 0) {
      await emitChatRealtimeNotification(client, {
        type: 'chat_read',
        threadKey: getChatThreadKey(ctx.patientId, ctx.caregiverId),
        patientId: ctx.patientId,
        caregiverId: ctx.caregiverId,
        readerRole: ctx.senderRole,
        readAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { ok: true, markedRead: updatedRes.rowCount },
      { status: 200, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}
