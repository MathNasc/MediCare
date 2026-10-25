import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getPgPool, ensureOraclePostgresSchema } from '@/lib/oraclePostgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ ok: false, error: 'user_id é obrigatório' }, { status: 400, headers: corsHeaders });
    }

    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_CONTACT_EMAIL || 'suporte@medicare.app';

    if (!pub || !priv) {
      return NextResponse.json(
        { ok: false, error: 'Chaves VAPID não configuradas no servidor.' },
        { status: 503, headers: corsHeaders }
      );
    }

    webpush.setVapidDetails(`mailto:${email}`, pub, priv);

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json(
        { ok: false, error: 'PostgreSQL Oracle ainda não configurado.' },
        { status: 503, headers: corsHeaders }
      );
    }

    const client = await pool.connect();
    try {
      await ensureOraclePostgresSchema(client);
      const subsRes = await client.query(`SELECT * FROM push_subscriptions WHERE user_id = $1`, [String(user_id)]);
      if (subsRes.rowCount === 0) {
        return NextResponse.json(
          { ok: false, error: 'Nenhuma assinatura de push encontrada para este usuário.' },
          { status: 404, headers: corsHeaders }
        );
      }

      const sub = subsRes.rows[0];
      const payload = JSON.stringify({
        title: 'MediCare — Teste',
        body: 'Push recebido com sucesso via Servidor Oracle.',
        tag: `test-${Date.now()}`,
        url: '/',
      });

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );

      return NextResponse.json(
        { ok: true, message: 'Push disparado com sucesso', endpoint: sub.endpoint },
        { status: 200, headers: corsHeaders }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Erro ao enviar push de teste' },
      { status: 500, headers: corsHeaders }
    );
  }
}
