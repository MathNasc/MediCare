import { NextResponse } from 'next/server';
import { ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { connectPgOrFallback } from '@/lib/oracleProxy';
import { extractAuthenticatedUser, verifyActiveSessionInDb } from '@/lib/oracleAuth';
import { checkOverdueDosesForCaregivers, getVapidPublicKey } from '@/lib/caregiverNotifications';
import { ensureOverdueCaregiverScheduler } from '@/lib/reminderWorker';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, apikey, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req) {
  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/caregiver/notifications');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
  if (!claims?.sub) {
    client.release();
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  ensureOverdueCaregiverScheduler();

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const userId = String(claims.sub);

    // Avalia doses em atraso (+1h) dos pacientes vinculados a este cuidador antes de retornar
    await checkOverdueDosesForCaregivers(client, { caregiverId: userId }).catch(() => {});

    const notifRes = await client.query(
      `SELECT id, user_id, tipo, titulo, mensagem, lida, created_at
       FROM notificacoes
       WHERE user_id::text = $1::text
       ORDER BY created_at DESC
       LIMIT 40`,
      [userId]
    );

    const rows = notifRes.rows || [];
    const unreadCount = rows.filter((n) => !n.lida).length;
    const vapidPublicKey = getVapidPublicKey();
    const pushConfigured = Boolean(vapidPublicKey && process.env.VAPID_PRIVATE_KEY);

    return NextResponse.json(
      {
        ok: true,
        notifications: rows,
        unreadCount,
        pushConfigured,
        vapidPublicKey,
      },
      { status: 200, headers: corsHeaders }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(req) {
  const { client, fallbackResponse } = await connectPgOrFallback(req, '/api/v1/caregiver/notifications');
  if (fallbackResponse) return fallbackResponse;
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503, headers: corsHeaders });
  }

  const claims = extractAuthenticatedUser(req, { returnCsrfError: true });
  if (claims?.csrfError) {
    client.release();
    return NextResponse.json({ error: claims.reason }, { status: 403, headers: corsHeaders });
  }
  if (!claims?.sub) {
    client.release();
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const markAll = body?.markAll === true;
  const notifId = body?.id ? String(body.id).trim() : '';

  try {
    await ensureOraclePostgresSchema(client);
    const active = await verifyActiveSessionInDb(client, claims);
    if (!active) {
      return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401, headers: corsHeaders });
    }

    const userId = String(claims.sub);
    if (markAll) {
      await client.query(
        `UPDATE notificacoes SET lida = TRUE WHERE user_id::text = $1::text AND lida = FALSE`,
        [userId]
      );
    } else if (notifId) {
      await client.query(
        `UPDATE notificacoes SET lida = TRUE WHERE id::text = $1::text AND user_id::text = $2::text`,
        [notifId, userId]
      );
    } else {
      return NextResponse.json({ error: 'Informe id ou markAll=true.' }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } finally {
    client.release();
  }
}
