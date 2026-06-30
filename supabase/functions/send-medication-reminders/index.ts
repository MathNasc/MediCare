import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SERVER_KEY   = Deno.env.get('FCM_SERVER_KEY')!;

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Horário de Brasília (UTC-3)
  const nowBRT      = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRT    = nowBRT.toISOString().slice(0, 10);
  const hh          = String(nowBRT.getHours()).padStart(2, '0');
  const mm          = String(nowBRT.getMinutes()).padStart(2, '0');
  const currentHHMM = `${hh}:${mm}`;

  // Janela: horários entre agora e +2min
  const windowEnd   = new Date(nowBRT.getTime() + 2 * 60 * 1000);
  const wHH         = String(windowEnd.getHours()).padStart(2, '0');
  const wMM         = String(windowEnd.getMinutes()).padStart(2, '0');
  const windowHHMM  = `${wHH}:${wMM}`;

  // Busca medicamentos ativos com token FCM
  const { data: meds } = await supabase
    .from('medicamentos')
    .select('id, nome, dosagem, unidade, horarios, user_id')
    .eq('ativo', true);

  if (!meds?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;

  for (const med of meds) {
    // Busca token FCM do usuário
    const { data: tokenRow } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', med.user_id)
      .maybeSingle();

    if (!tokenRow?.token) continue;

    const horarios: string[] = med.horarios || [];

    for (const hora of horarios) {
      if (hora < currentHHMM || hora > windowHHMM) continue;

      // Verifica se já foi confirmada hoje
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

      // Envia push via FCM
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
          to: tokenRow.token,
          priority: 'high',
          notification: {
            title: `💊 ${med.nome}`,
            body:  `${med.dosagem} · Horário: ${hora}`,
            icon:  '/icon-192.png',
            badge: '/icon-96.png',
            tag:   `dose-${med.id}-${hora}`,
          },
          data: {
            type:    'medication_reminder',
            medId:   med.id,
            medName: med.nome,
            dosagem: med.dosagem,
            hora,
            doseId:  `${med.id}-${hora.replace(':', '')}`,
            url:     `/?action=confirm&medId=${med.id}&hora=${hora}`,
          },
          android: {
            priority: 'high',
            notification: {
              channel_id:              'medication_reminders',
              priority:                'max',
              default_vibrate_timings: true,
              default_sound:           true,
            },
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              requireInteraction: true,
              vibrate: [200, 100, 200],
              actions: [
                { action: 'confirm', title: '✓ Tomei agora' },
                { action: 'snooze',  title: '⏰ 15 minutos' },
              ],
            },
          },
        }),
      });

      if (res.ok) sent++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, time: currentHHMM }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
