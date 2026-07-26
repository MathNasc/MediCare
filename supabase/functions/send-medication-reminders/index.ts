// MediCare — send-medication-reminders (v2: Web Push / VAPID)
//
// Substitui a versão anterior, que usava a API legada do FCM
// (https://fcm.googleapis.com/fcm/send). Essa API foi DESLIGADA pelo
// Google em 22/07/2024 — por isso os lembretes nunca chegavam: o fetch
// falhava silenciosamente e o código só verificava `res.ok`.
//
// Agora usamos Web Push padrão (RFC 8291/8292) via a lib `web-push`
// (a mesma usada por milhares de projetos em produção), importada como
// pacote npm — Supabase Edge Functions/Deno suportam `npm:` nativamente.
//
// Variáveis de ambiente necessárias (configurar com `supabase secrets set`):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_CONTACT_EMAIL   (opcional — email de contato exigido pelo protocolo)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já ficam disponíveis automaticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY    = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY   = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_CONTACT_EMAIL = Deno.env.get('VAPID_CONTACT_EMAIL') || 'suporte@medicare-amber-five.vercel.app';

webpush.setVapidDetails(`mailto:${VAPID_CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Horário de Brasília (UTC-3)
  const nowBRT      = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRT    = nowBRT.toISOString().slice(0, 10);
  const currentHHMM = `${String(nowBRT.getHours()).padStart(2, '0')}:${String(nowBRT.getMinutes()).padStart(2, '0')}`;

  // Janela: horários entre agora e +2min (o cron roda a cada minuto)
  const windowEnd  = new Date(nowBRT.getTime() + 2 * 60 * 1000);
  const windowHHMM = `${String(windowEnd.getHours()).padStart(2, '0')}:${String(windowEnd.getMinutes()).padStart(2, '0')}`;

  const { data: meds } = await supabase
    .from('medicamentos')
    .select('id, nome, dosagem, unidade, horarios, user_id')
    .eq('ativo', true);

  if (!meds?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;
  let failed = 0;
  const subsCache = new Map<string, any[]>();

  for (const med of meds) {
    const horarios: string[] = med.horarios || [];
    const dueHorarios = horarios.filter((h) => h >= currentHHMM && h <= windowHHMM);
    if (!dueHorarios.length) continue;

    // Cacheia as subscriptions por usuário dentro desta execução (evita
    // repetir a mesma query quando o usuário tem vários medicamentos)
    if (!subsCache.has(med.user_id)) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', med.user_id);
      subsCache.set(med.user_id, subs || []);
    }
    const subs = subsCache.get(med.user_id)!;
    if (!subs.length) continue;

    for (const hora of dueHorarios) {
      // Já confirmada hoje? Não notifica de novo.
      const { data: hist } = await supabase
        .from('historico_doses')
        .select('id')
        .eq('med_id', med.id)
        .eq('hora', hora)
        .eq('status', 'confirmed')
        .gte('created_at', `${todayBRT}T00:00:00`)
        .lte('created_at', `${todayBRT}T23:59:59`)
        .maybeSingle();

      if (hist) continue;

      const payload = JSON.stringify({
        title:  `💊 ${med.nome}`,
        body:   `${med.dosagem} · Horário: ${hora}`,
        tag:    `dose-${med.id}-${hora}`,
        medId:  med.id,
        hora,
        doseId: `${med.id}-${hora.replace(':', '')}`,
        url:    `/?action=confirm&medId=${med.id}&hora=${hora}`,
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { urgency: 'high' }
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 404/410 = subscription expirada ou revogada pelo navegador → limpa do banco
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, failed, time: currentHHMM }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
