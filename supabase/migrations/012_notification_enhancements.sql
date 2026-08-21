ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_tipo_check;
ALTER TABLE public.notification_logs ALTER COLUMN med_id DROP NOT NULL;
ALTER TABLE public.notification_logs ALTER COLUMN dose_hora DROP NOT NULL;
-- Drop and recreate unique constraint to allow nulls
ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_med_id_dose_hora_data_referencia_tipo_key;

-- We need a way to track idempotency for events. Let's add event_id
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.health_events(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_med ON public.notification_logs(med_id, dose_hora, data_referencia, tipo) WHERE med_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_event ON public.notification_logs(event_id, data_referencia, tipo) WHERE event_id IS NOT NULL;

