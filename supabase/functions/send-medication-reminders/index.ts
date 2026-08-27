import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_CONTACT_EMAIL = Deno.env.get('VAPID_CONTACT_EMAIL') || 'suporte@medicare-amber-five.vercel.app';

webpush.setVapidDetails(
  `mailto:${VAPID_CONTACT_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const now = new Date();

  // Busca todos os medicamentos ativos
  const { data: meds } = await supabase
    .from('medicamentos')
    .select('id, nome, dosagem, unidade, quantidade, horarios, dias_semana, treatment_type, start_date, end_date, user_id')
    .eq('ativo', true);

  // Busca todos os eventos pendentes
  const { data: events } = await supabase
    .from('health_events')
    .select('*')
    .gte('date', now.toISOString().split('T')[0]);

  // Busca TODAS as assinaturas de push (pacientes e cuidadores)
  const { data: pushSubs } = await supabase.from('push_subscriptions').select('*');
  const subsByUser = new Map<string, any[]>();
  if (pushSubs) {
    for (const sub of pushSubs) {
      if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
      subsByUser.get(sub.user_id)!.push(sub);
    }
  }

  // Busca cuidadores ativos para poder notificá-los
  const { data: caregivers } = await supabase
    .from('caregiver_relationships')
    .select('patient_id, caregiver_id')
    .eq('status', 'active');
  const caregiversByPatient = new Map<string, string[]>();
  if (caregivers) {
    for (const rel of caregivers) {
      if (!caregiversByPatient.has(rel.patient_id)) caregiversByPatient.set(rel.patient_id, []);
      caregiversByPatient.get(rel.patient_id)!.push(rel.caregiver_id);
    }
  }

  // Perfis para nome do paciente (útil para notificar o cuidador)
  const { data: profiles } = await supabase.from('profiles').select('id, nome');
  const patientNames = new Map<string, string>();
  if (profiles) {
    for (const profile of profiles) {
      patientNames.set(profile.id, profile.nome);
    }
  }

  let sent = 0;
  let failed = 0;
  let ignored = 0;

  // 1. Processamento de Medicamentos
  if (meds) {
    for (const med of meds) {
      if (med.treatment_type === 'sos') continue;

      const userSubs = subsByUser.get(med.user_id) || [];
      const caregiverIds = caregiversByPatient.get(med.user_id) || [];
      const hasAnyCaregiverSub = caregiverIds.some(cgId => (subsByUser.get(cgId) || []).length > 0);

      if (userSubs.length === 0 && !hasAnyCaregiverSub) continue;

      let defaultTz = 'America/Sao_Paulo';
      if (userSubs.length > 0 && userSubs[0].timezone) defaultTz = userSubs[0].timezone;
      else {
          for (const cgId of caregiverIds) {
             const cSubs = subsByUser.get(cgId);
             if (cSubs && cSubs.length > 0 && cSubs[0].timezone) {
                 defaultTz = cSubs[0].timezone;
                 break;
             }
          }
      }

      const horarios: string[] = med.horarios || [];
      let nowLocal;
      let startOfDayUTC;
      let endOfDayUTC;

      try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: defaultTz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const parts = formatter.formatToParts(now);
        const map: any = {};
        parts.forEach(p => map[p.type] = p.value);
        nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}Z`);
        const offsetMs = now.getTime() - nowLocal.getTime();
        
        const startOfDayFakeUTC = new Date(nowLocal);
        startOfDayFakeUTC.setUTCHours(0,0,0,0);
        startOfDayUTC = new Date(startOfDayFakeUTC.getTime() + offsetMs).toISOString();
        
        const endOfDayFakeUTC = new Date(nowLocal);
        endOfDayFakeUTC.setUTCHours(23,59,59,999);
        endOfDayUTC = new Date(endOfDayFakeUTC.getTime() + offsetMs).toISOString();
      } catch (e) {
        nowLocal = now; 
        startOfDayUTC = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0, 0).toISOString();
        endOfDayUTC = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 23, 59, 59, 999).toISOString();
      }

      const todayISO = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth()+1).padStart(2, '0')}-${String(nowLocal.getUTCDate()).padStart(2, '0')}`;
      const dayOfWeek = nowLocal.getUTCDay() + 1;

      // 1.A. Verificação de Estoque Baixo (enviado ao paciente)
      if (med.quantidade != null && med.quantidade <= 5 && userSubs.length > 0) {
        const { data: existingStockNotif } = await supabase
          .from('audit_logs')
          .select('id')
          .eq('patient_id', med.user_id)
          .eq('action', 'SYSTEM_NOTIF_LOW_STOCK')
          .contains('new_value', { med_id: med.id, date: todayISO })
          .limit(1);

        if (!existingStockNotif || existingStockNotif.length === 0) {
          const payload = JSON.stringify({
            title: `⚠️ Estoque Baixo: ${med.nome}`,
            body: `Restam apenas ${med.quantidade} ${med.unidade || 'unidade'}(s). Lembre-se de repor!`,
            tag: `stock-${med.id}`,
            url: `/?tab=meds`,
          });
          let notifSent = false;
          for (const sub of userSubs) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { urgency: 'high' });
              sent++;
              notifSent = true;
            } catch (err: any) {
              failed++;
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              }
            }
          }
          if (notifSent) {
             await supabase.from('audit_logs').insert({
                patient_id: med.user_id,
                action: 'SYSTEM_NOTIF_LOW_STOCK',
                new_value: { med_id: med.id, date: todayISO }
             });
          }
        }
      }

      if (horarios.length === 0) continue;

      if (med.treatment_type === 'temporary') {
        if (med.start_date && todayISO < med.start_date) continue;
        if (med.end_date && todayISO > med.end_date) continue;
      }

      if (med.dias_semana && med.dias_semana.length > 0 && !med.dias_semana.map(String).includes(String(dayOfWeek))) continue;

      for (const hora of horarios) {
        const [h, m] = hora.split(':').map(Number);
        const doseTime = new Date(nowLocal);
        doseTime.setUTCHours(h, m, 0, 0);
        
        const diffMin = Math.floor((nowLocal.getTime() - doseTime.getTime()) / 60000);
        
        let targetType = null;
        if (diffMin >= 0 && diffMin <= 4) targetType = 'DOSE';
        else if (diffMin >= 10 && diffMin <= 14) targetType = 'REMINDER_1';
        else if (diffMin >= 20 && diffMin <= 24) targetType = 'REMINDER_2';

        if (!targetType) continue;
        
        const { data: hist } = await supabase
          .from('historico_doses')
          .select('id, status')
          .eq('med_id', med.id)
          .eq('hora', hora)
          .gte('created_at', startOfDayUTC)
          .lte('created_at', endOfDayUTC)
          .limit(1);

        if (hist && hist.length > 0 && hist[0].status === 'confirmed') {
           ignored++;
           continue;
        }

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
          tag: `dose-${med.id}-${hora}`,
          medId: med.id,
          hora,
          doseId: `${med.id}-${hora.replace(':', '')}`,
          url: `/?action=confirm&medId=${med.id}&hora=${hora}`,
        });

        // Enviar para o paciente (se tiver subscrições)
        let anySent = false;
        for (const sub of userSubs) {
           try {
             await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { urgency: 'high' });
             sent++;
             anySent = true;
           } catch (err: any) {
             failed++;
             if (err?.statusCode === 404 || err?.statusCode === 410) {
               await supabase.from('push_subscriptions').delete().eq('id', sub.id);
             }
           }
        }

        // Se o paciente esquecer (REMINDER_2), notifica os cuidadores!
        if (targetType === 'REMINDER_2') {
           const patientName = patientNames.get(med.user_id) || 'Seu paciente';
           const cgPayload = JSON.stringify({
              title: `🚨 Paciente Atrasado: ${med.nome}`,
              body: `${patientName} esqueceu a dose das ${hora}.`,
              tag: `cg-dose-${med.id}-${hora}`,
              url: `/?tab=history`,
           });
           
           for (const cgId of caregiverIds) {
               const cgSubs = subsByUser.get(cgId);
               if (cgSubs) {
                   for (const cgSub of cgSubs) {
                       try {
                           await webpush.sendNotification({ endpoint: cgSub.endpoint, keys: { p256dh: cgSub.p256dh, auth: cgSub.auth } }, cgPayload, { urgency: 'high' });
                           sent++;
                           anySent = true;
                       } catch(e: any) {
                           failed++;
                           if (e?.statusCode === 404 || e?.statusCode === 410) {
                               await supabase.from('push_subscriptions').delete().eq('id', cgSub.id);
                           }
                       }
                   }
               }
           }
        }

        if (anySent || userSubs.length === 0) {
           // Registra o log para não enviar novamente
           await supabase.from('notification_logs').insert({
              user_id: med.user_id,
              med_id: med.id,
              dose_hora: hora,
              data_referencia: todayISO,
              tipo: targetType
           });
        }
      }
    }
  }

  // 2. Processamento de Eventos Médicos
  if (events) {
    for (const ev of events) {
      if (!ev.date || !ev.time) continue;
      const userSubs = subsByUser.get(ev.user_id);
      if (!userSubs?.length) continue;

      for (const sub of userSubs) {
        const tz = sub.timezone || 'America/Sao_Paulo';
        let nowLocal;
        try {
          const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const parts = formatter.formatToParts(now);
          const map: any = {};
          parts.forEach(p => map[p.type] = p.value);
          nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}Z`);
        } catch (e) {
          nowLocal = now;
        }

        const [eh, em] = ev.time.split(':').map(Number);
        const [ey, eM, ed] = ev.date.split('-').map(Number);
        
        const eventDateLocal = new Date(Date.UTC(ey, eM - 1, ed, eh, em, 0));
        
        const diffMin = Math.floor((eventDateLocal.getTime() - nowLocal.getTime()) / 60000);
        
        let targetType = null;
        if (diffMin >= 1435 && diffMin <= 1445) targetType = 'EVENT_1D'; // ~24h
        else if (diffMin >= 295 && diffMin <= 305) targetType = 'EVENT_5H'; // ~5h
        else if (diffMin >= 55 && diffMin <= 65) targetType = 'EVENT_1H'; // ~1h

        if (!targetType) continue;

        const { data: existingEventNotif } = await supabase
          .from('audit_logs')
          .select('id')
          .eq('patient_id', ev.user_id)
          .eq('action', `SYSTEM_NOTIF_${targetType}`)
          .contains('new_value', { event_id: ev.id })
          .limit(1);

        if (existingEventNotif && existingEventNotif.length > 0) continue;

        const timeLabels: Record<string, string> = {
          'EVENT_1D': 'Amanhã',
          'EVENT_5H': 'Em 5 horas',
          'EVENT_1H': 'Em 1 hora'
        };

        const payload = JSON.stringify({
          title: `📅 Evento: ${ev.title}`,
          body: `${timeLabels[targetType]} às ${ev.time}${ev.location ? ` em ${ev.location}` : ''}`,
          tag: `event-${ev.id}-${targetType}`,
          url: `/?tab=calendar`,
        });

        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { urgency: 'high' });
          await supabase.from('audit_logs').insert({
            patient_id: ev.user_id,
            action: `SYSTEM_NOTIF_${targetType}`,
            new_value: { event_id: ev.id }
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
