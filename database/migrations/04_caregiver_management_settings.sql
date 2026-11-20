-- =============================================================================
-- MediCare — Migração Incremental 04: Painel de Gerenciamento e Regras de Cuidado por Paciente
-- =============================================================================
-- Migração explícita, versionada, idempotente e não-destrutiva.
-- Cria a tabela patient_care_settings com regras personalizáveis pelo cuidador:
--   • Período de atraso para notificar o cuidador (overdue_notify_minutes)
--   • Exigência de confirmação do cuidador em doses no horário (require_caregiver_confirm)
--   • Exigência de confirmação após a dose ser considerada perdida (require_confirm_after_missed)
--   • Exigência de confirmação para desfazer dose (require_confirm_undo)
--   • Janela em minutos para considerar dose perdida (missed_dose_minutes)
--   • Permissão para o paciente editar prescrições/medicamentos (allow_patient_med_edit)
--   • Alertas de estoque baixo (notify_low_stock, low_stock_threshold)
--   • Alerta de uso SOS pelo paciente (notify_sos_usage)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_care_settings (
  patient_id                   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  overdue_notify_minutes       int NOT NULL DEFAULT 60,
  require_caregiver_confirm    boolean NOT NULL DEFAULT true,
  require_confirm_after_missed boolean NOT NULL DEFAULT true,
  require_confirm_undo         boolean NOT NULL DEFAULT true,
  missed_dose_minutes          int NOT NULL DEFAULT 180,
  allow_patient_med_edit       boolean NOT NULL DEFAULT true,
  notify_low_stock             boolean NOT NULL DEFAULT true,
  low_stock_threshold          int NOT NULL DEFAULT 5,
  notify_sos_usage             boolean NOT NULL DEFAULT true,
  updated_by                   uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_care_settings_updated
  ON public.patient_care_settings (updated_at DESC);

INSERT INTO public.schema_migrations (version, description)
VALUES (
  '04_caregiver_management_settings',
  'Tabela patient_care_settings para o painel de gerenciamento do cuidador'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
