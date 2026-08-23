-- FASE 1: Corrigir o Job do pg_cron
-- SUBSTITUA "seu-projeto-ref" pelo ref real do seu projeto ANTES de executar no SQL Editor!

-- 1. Remove o job antigo
SELECT cron.unschedule('send-medication-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-medication-reminders');

-- 2. Recria o job usando 'app.settings.service_role_key' (o path correto)
SELECT cron.schedule(
  'send-medication-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://seu-projeto-ref.supabase.co/functions/v1/send-medication-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
