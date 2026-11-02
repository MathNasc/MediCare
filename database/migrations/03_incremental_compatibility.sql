-- =============================================================================
-- MediCare — Migração Incremental 03: Compatibilidade Clínica, Rastreabilidade de Doses e Aprovações
-- =============================================================================
-- Migração explícita, versionada, idempotente e não-destrutiva.
-- Preserva integralmente os dados e os tipos UUID definidos em 02_schema_oracle_standalone.sql.
-- =============================================================================

BEGIN;

-- 1. Tabela de controle explícito de versão de esquema
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version     text PRIMARY KEY,
  description text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Evolução não-destrutiva de perfis (pacientes gerenciados sem conta própria)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_updated_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_managed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL;

-- 3. Evolução não-destrutiva de medicamentos
ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS active_ingredient text;
ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS principio_ativo text;
ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS fabricante text;
ALTER TABLE public.medicamentos ADD COLUMN IF NOT EXISTS aviso_estoque int DEFAULT 5;

-- 4. Evolução não-destrutiva de histórico de doses (horário previsto vs real vs registro, ator e origem)
ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS dose_date date;
ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS administered_at timestamptz;
ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS origin text DEFAULT 'patient_app';
ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS confirmed_by_name text;
ALTER TABLE public.historico_doses ADD COLUMN IF NOT EXISTS confirmed_by_role text;

CREATE INDEX IF NOT EXISTS idx_historico_doses_user_date
  ON public.historico_doses (user_id, dose_date);

-- 5. Evolução não-destrutiva de contatos, profissionais e estoque
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS relation text;
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS relationship text;
ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS clinic text;
ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.healthcare_professionals ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS med_name text;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS quantity_delta numeric;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS quantity_changed numeric;

-- 6. Tabelas complementares (notas de calendário e solicitações de aprovação do cuidador)
CREATE TABLE IF NOT EXISTS public.calendar_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  content    text NOT NULL,
  mood       text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  med_id           text,
  med_nome         text,
  dose_date        text,
  hora             text,
  action_type      text NOT NULL,
  requested_status text NOT NULL,
  reason           text NOT NULL,
  status           text DEFAULT 'pending',
  metadata         jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_patient_status
  ON public.approval_requests (patient_id, status);

-- 7. Registro de versões aplicadas
INSERT INTO public.schema_migrations (version, description)
VALUES
  ('02_schema_oracle_standalone', 'Esquema base PostgreSQL standalone com UUIDs, RBAC e RPCs'),
  ('03_incremental_compatibility', 'Colunas de rastreabilidade de doses, pacientes gerenciados e aprovações')
ON CONFLICT (version) DO NOTHING;

COMMIT;
