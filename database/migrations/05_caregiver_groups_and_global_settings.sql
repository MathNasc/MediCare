-- =============================================================================
-- MediCare — Migração Incremental 05: Regras Globais e Grupos de Pacientes (Clínica)
-- =============================================================================
-- Migração explícita, versionada, idempotente e não-destrutiva.
-- Adiciona suporte para:
--   1. Configurações Globais do Cuidador/Clínica (caregiver_global_settings)
--   2. Grupos de Pacientes com regras compartilhadas (caregiver_patient_groups)
--   3. Modo de herança por paciente em patient_care_settings (config_mode: global | group | custom)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.caregiver_global_settings (
  caregiver_id                 uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  overdue_notify_minutes       int NOT NULL DEFAULT 60,
  require_caregiver_confirm    boolean NOT NULL DEFAULT true,
  require_confirm_after_missed boolean NOT NULL DEFAULT true,
  require_confirm_undo         boolean NOT NULL DEFAULT true,
  missed_dose_minutes          int NOT NULL DEFAULT 180,
  allow_patient_med_edit       boolean NOT NULL DEFAULT true,
  notify_low_stock             boolean NOT NULL DEFAULT true,
  low_stock_threshold          int NOT NULL DEFAULT 5,
  notify_sos_usage             boolean NOT NULL DEFAULT true,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.caregiver_patient_groups (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id                 uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name                         text NOT NULL,
  description                  text,
  color                        text DEFAULT '#3b82f6',
  overdue_notify_minutes       int NOT NULL DEFAULT 60,
  require_caregiver_confirm    boolean NOT NULL DEFAULT true,
  require_confirm_after_missed boolean NOT NULL DEFAULT true,
  require_confirm_undo         boolean NOT NULL DEFAULT true,
  missed_dose_minutes          int NOT NULL DEFAULT 180,
  allow_patient_med_edit       boolean NOT NULL DEFAULT true,
  notify_low_stock             boolean NOT NULL DEFAULT true,
  low_stock_threshold          int NOT NULL DEFAULT 5,
  notify_sos_usage             boolean NOT NULL DEFAULT true,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_patient_groups_cg
  ON public.caregiver_patient_groups (caregiver_id, name);

ALTER TABLE public.patient_care_settings
  ADD COLUMN IF NOT EXISTS config_mode text NOT NULL DEFAULT 'custom';

ALTER TABLE public.patient_care_settings
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.caregiver_patient_groups(id) ON DELETE SET NULL;

ALTER TABLE public.patient_care_settings
  ADD COLUMN IF NOT EXISTS caregiver_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_care_settings_group
  ON public.patient_care_settings (group_id);

CREATE INDEX IF NOT EXISTS idx_patient_care_settings_mode
  ON public.patient_care_settings (config_mode);

INSERT INTO public.schema_migrations (version, description)
VALUES (
  '05_caregiver_groups_and_global_settings',
  'Suporte a regras globais do cuidador, grupos de pacientes e modo de heranca por paciente'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
