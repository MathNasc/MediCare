import { NextResponse } from 'next/server';
import { ensureOraclePostgresSchema } from '@/lib/oraclePostgres';
import { getPgPool } from '@/lib/oraclePostgres';
import { canUseOracleHttpFallback } from '@/lib/oracleProxy';
import { extractAuthenticatedUser, verifyActiveSessionInDb } from '@/lib/oracleAuth';
import { subscribeChatEvents } from '@/lib/chatRealtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const claims = extractAuthenticatedUser(req, { enforceCsrf: false });
  if (!claims?.sub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    if (canUseOracleHttpFallback(req)) {
      return NextResponse.json({ error: 'Stream direto disponível apenas no backend principal.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503 });
  }

  const client = await pool.connect().catch(() => null);
  if (!client) {
    return NextResponse.json({ error: 'PostgreSQL Oracle indisponível.' }, { status: 503 });
  }

  let sessionOk = false;
  try {
    await ensureOraclePostgresSchema(client);
    sessionOk = await verifyActiveSessionInDb(client, claims);
  } finally {
    client.release();
  }

  if (!sessionOk) {
    return NextResponse.json({ error: 'Sessão inválida ou revogada.' }, { status: 401 });
  }

  const requesterId = String(claims.sub).toLowerCase();
  const encoder = new TextEncoder();

  let cleanupFn = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const sendEvent = (eventName, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // ignore closed stream
        }
      };

      sendEvent('connected', { ok: true, userId: requesterId, ts: new Date().toISOString() });

      const unsubscribe = subscribeChatEvents((evt) => {
        if (!evt) return;
        const pId = String(evt.patientId || '').toLowerCase();
        const cId = String(evt.caregiverId || '').toLowerCase();
        if (pId === requesterId || cId === requesterId) {
          sendEvent(evt.type || 'chat_event', evt);
        }
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // ignore closed stream
        }
      }, 20000);

      cleanupFn = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal?.addEventListener('abort', cleanupFn);
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
