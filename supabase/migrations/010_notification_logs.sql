-- MediCare — Migration 010: Fila de Notificações Server-Side
-- 
-- Tabela para controlar notificações enviadas (Doses e Lembretes)
-- Garantindo idempotência e evitando spam.

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    med_id UUID NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
    dose_hora TEXT NOT NULL,
    data_referencia DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('DOSE', 'REMINDER_1', 'REMINDER_2')),
    sent_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(med_id, dose_hora, data_referencia, tipo)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_lookup ON public.notification_logs(med_id, dose_hora, data_referencia);
