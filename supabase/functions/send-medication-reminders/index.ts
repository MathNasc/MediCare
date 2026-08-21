import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_CONTACT_EMAIL = Deno.env.get('VAPID_CONTACT_EMAIL') || 'suporte@medicare-amber-five.vercel.app';

webpush.setVapidDetails(`mailto:${VAPID_CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const now = new Date();

  // Buscar todos os medicamentos ativos
  const { data: meds } = await supabase
    .from('medicamentos')
    .select('id, nome, dosagem, unidade, horarios, dias_semana, treatment_type, start_date, end_date, user_id')
    .eq('ativo', true);

  if (!meds?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_meds' }), { status: 200 });
  }

  // Pre-carregar todas as inscrições para evitar N+1
  const { data: allSubs } = await supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, timezone');
  if (!allSubs?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_subs' }), { status: 200 });
  }
  
  const subsByUser = new Map<string, any[]>();
  for (const sub of allSubs) {
    const arr = subsByUser.get(sub.user_id) || [];
    arr.push(sub);
    subsByUser.set(sub.user_id, arr);
  }

  let sent = 0;
  let failed = 0;
  let ignored = 0;

  for (const med of meds) {
    // SOS não gera lembretes programados
    if (med.treatment_type === 'sos') continue;

    const userSubs = subsByUser.get(med.user_id);
    if (!userSubs?.length) continue;

    const horarios: string[] = med.horarios || [];
    if (!horarios.length) continue;

    for (const sub of userSubs) {
      const tz = sub.timezone || 'America/Sao_Paulo';
      let nowLocal;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const parts = formatter.formatToParts(now);
        const map: any = {};
        parts.forEach(p => map[p.type] = p.value);
        nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}`);
      } catch (e) {
        nowLocal = now; // Fallback se o tz for inválido
      }
      
      const currentHHMM = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
      const todayISO = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
      const dayOfWeek = nowLocal.getDay() === 0 ? 7 : nowLocal.getDay(); // 1-7, 1=Monday
      
      // Validações de data e dia
      if (med.treatment_type === 'temporary') {
        if (med.start_date && todayISO < med.start_date) continue;
        if (med.end_date && todayISO > med.end_date) continue;
      }
      if (med.dias_semana && med.dias_semana.length > 0 && !med.dias_semana.includes(dayOfWeek)) {
         continue;
      }

      for (const hora of horarios) {
        // Calcular diferença em minutos da dose para agora
        const [h, m] = hora.split(':').map(Number);
        const doseTime = new Date(nowLocal);
        doseTime.setHours(h, m, 0, 0);
        
        const diffMin = Math.floor((nowLocal.getTime() - doseTime.getTime()) / 60000);
        
        let targetType = null;
        if (diffMin >= 0 && diffMin <= 2) {
            targetType = 'DOSE';
        } else if (diffMin >= 10 && diffMin <= 12) { // Primeiro lembrete +10m
            targetType = 'REMINDER_1';
        } else if (diffMin >= 20 && diffMin <= 22) { // Segundo lembrete +20m
            targetType = 'REMINDER_2';
        }

        if (!targetType) {
           continue; 
        }

        // Verifica se a dose já foi confirmada
        const { data: hist } = await supabase
          .from('historico_doses')
          .select('id, status')
          .eq('med_id', med.id)
          .eq('hora', hora)
          .gte('created_at', `${todayISO}T00:00:00Z`)
          .lte('created_at', `${todayISO}T23:59:59Z`)
          .limit(1);

        // Se houver histórico que não seja pendente, ou seja, tomado/ignorado, ignora
        if (hist && hist.length > 0 && hist[0].status === 'confirmed') {
           ignored++;
           continue;
        }

        // Verifica idempotência
        const { data: existingLog } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('med_id', med.id)
          .eq('dose_hora', hora)
          .eq('data_referencia', todayISO)
          .eq('tipo', targetType)
          .limit(1);

        if (existingLog && existingLog.length > 0) {
           ignored++;
           continue; 
        }

        // Enviar Web Push!
        let title = `💊 ${med.nome}`;
        let body = `${med.dosagem} · Horário: ${hora}`;
        
        if (targetType === 'REMINDER_1') {
            title = `⚠️ Lembrete de Dose: ${med.nome}`;
            body = `Você esqueceu? Dose agendada para ${hora}.`;
        } else if (targetType === 'REMINDER_2') {
            title = `🚨 Último Lembrete: ${med.nome}`;
            body = `Não esqueça de tomar o seu medicamento! (${hora})`;
        }

        const payload = JSON.stringify({
          title,
          body,
          tag:    `dose-${med.id}-${hora}`,
          medId:  med.id,
          hora,
          doseId: `${med.id}-${hora.replace(':', '')}`,
          url:    `/?action=confirm&medId=${med.id}&hora=${hora}`,
        });

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { urgency: 'high' }
          );
          
          // Registra no DB para garantir que não mande de novo
          await supabase.from('notification_logs').insert({
              user_id: med.user_id,
              med_id: med.id,
              dose_hora: hora,
              data_referencia: todayISO,
              tipo: targetType
          });

          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, failed, ignored }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
