import { NextResponse } from 'next/server';
import crypto from 'crypto';
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
    const body = await req.json();
    const { patientName = 'Paciente', medName = 'Medicamento', hora = '', caregivers = [] } = body || {};

    if (!Array.isArray(caregivers) || caregivers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 }, { status: 200, headers: corsHeaders });
    }

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json(
        { ok: false, error: 'PostgreSQL Oracle ainda não configurado.' },
        { status: 503, headers: corsHeaders }
      );
    }

    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_CONTACT_EMAIL || 'suporte@medicare.app';
    const pushReady = Boolean(pub && priv);

    if (pushReady) {
      webpush.setVapidDetails(`mailto:${email}`, pub, priv);
    }

    const client = await pool.connect();
    let sent = 0;
    try {
      await ensureOraclePostgresSchema(client);
      const cleanIds = caregivers.filter(Boolean).map(String);

      for (const cgId of cleanIds) {
        await client
          .query(
            `INSERT INTO notificacoes (id, user_id, tipo, titulo, mensagem, lida)
             VALUES ($1, $2, 'cuidador', $3, $4, FALSE)`,
            [
              crypto.randomUUID(),
              cgId,
              `🚨 Alerta de Dose: ${medName}`,
              `${patientName} precisa de atenção com o medicamento ${medName}${hora ? ` (${hora})` : ''}.`,
            ]
          )
          .catch(() => {});
      }

      if (pushReady && cleanIds.length > 0) {
        const subsRes = await client.query(
          `SELECT * FROM push_subscriptions WHERE user_id::text = ANY($1::text[])`,
          [cleanIds]
        );
        const payload = JSON.stringify({
          title: `🚨 Alerta de Cuidador: ${medName}`,
          body: `${patientName} não confirmou a dose de ${medName}${hora ? ` (${hora})` : ''}.`,
          tag: `cg-alert-${Date.now()}`,
          url: '/?tab=profile&view=caregiver_dash&cgTab=history',
        });

        for (const sub of subsRes.rows) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { urgency: 'high' }
            );
            sent++;
          } catch (err) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]).catch(() => {});
            }
          }
        }
      }

      return NextResponse.json({ ok: true, sent }, { status: 200, headers: corsHeaders });
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Falha ao enviar alerta aos cuidadores' },
      { status: 500, headers: corsHeaders }
    );
  }
}
