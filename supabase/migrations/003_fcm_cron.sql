-- MediCare — Migration 003: FCM + pg_cron
-- Execute no SQL Editor do Supabase
-- SUBSTITUA "seu-projeto-ref" pelo ref real do seu projeto

create extension if not exists pg_cron;

-- Remove job antigo se existir
select cron.unschedule('send-medication-reminders')
where exists (select 1 from cron.job where jobname = 'send-medication-reminders');

-- Agenda a Edge Function a cada minuto
select cron.schedule(
  'send-medication-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://seu-projeto-ref.supabase.co/functions/v1/send-medication-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Verificar se ficou agendado:
-- select * from cron.job where jobname = 'send-medication-reminders';

-- Verificar execuções (após alguns minutos):
-- select * from cron.job_run_details
-- where jobname = 'send-medication-reminders'
-- order by start_time desc limit 10;
