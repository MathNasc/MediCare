-- =============================================================================
-- MediCare — Schema PostgreSQL Standalone para Servidor Oracle Cloud (medicare_db)
-- =============================================================================
-- Implementação PostgreSQL standalone com compatibilidade integral de UUIDs,
-- FKs, Views, Triggers, RBAC e Funções RPC.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 0. Contexto de Sessão Autenticada (Substituto de auth.uid()) ────────────
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 1. Autenticação Standalone (Substituto de auth.users do GoTrue) ─────────
CREATE TABLE IF NOT EXISTS public.app_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  password_hash       text NOT NULL, -- Compatível com bcrypt ($2a$/$2b$) ou scrypt/pbkdf2
  raw_user_meta_data  jsonb DEFAULT '{}'::jsonb,
  email_confirmed_at  timestamptz DEFAULT now(),
  last_sign_in_at     timestamptz,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(lower(email));

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  refresh_token_hash  text NOT NULL UNIQUE,
  user_agent          text,
  ip_address          text,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON public.auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash          text NOT NULL UNIQUE,
  expires_at          timestamptz NOT NULL,
  used_at             timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- ─── 2. RBAC: Papéis e Permissões ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO public.roles (code, label, description, is_active) VALUES
  ('paciente',      'Paciente',                  'Registra seus próprios medicamentos. Limite de 24h para alterações retroativas.', true),
  ('cuidador',      'Cuidador',                  'Acompanha e administra o tratamento de pacientes vinculados.', true),
  ('independente',  'Independente',              'Controle total sobre os próprios dados sem restrição de janela.', true),
  ('medico',        'Médico',                    'Acesso clínico a pacientes vinculados por prescrição.', false),
  ('enfermeiro',    'Enfermeiro',                'Suporte de enfermagem a pacientes vinculados.', false),
  ('clinica',       'Clínica',                   'Gestão institucional de múltiplos pacientes.', false),
  ('farmacia',      'Farmácia',                  'Acompanhamento de dispensação de medicamentos.', false),
  ('admin_sistema', 'Administrador do Sistema',  'Gestão da plataforma MediCare.', false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_code  text NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (role_code, permission)
);

INSERT INTO public.role_permissions (role_code, permission) VALUES
  ('paciente', 'meds.create'),
  ('paciente', 'meds.edit_own'),
  ('paciente', 'dose.confirm'),
  ('paciente', 'dose.edit_own_24h'),
  ('paciente', 'history.view'),
  ('paciente', 'calendar.view'),
  ('paciente', 'stats.view'),
  ('paciente', 'caregiver.share'),
  ('paciente', 'notes.add_own'),
  ('cuidador', 'patients.view_all'),
  ('cuidador', 'dose.confirm_for_patient'),
  ('cuidador', 'dose.confirm_retroactive'),
  ('cuidador', 'dose.correct_retroactive'),
  ('cuidador', 'calendar.view'),
  ('cuidador', 'history.view'),
  ('cuidador', 'notes.add_caregiver'),
  ('cuidador', 'alerts.receive'),
  ('independente', 'meds.create'),
  ('independente', 'meds.edit_own'),
  ('independente', 'meds.delete_own'),
  ('independente', 'dose.confirm'),
  ('independente', 'dose.edit_own_any_time'),
  ('independente', 'dose.confirm_retroactive_own'),
  ('independente', 'history.view'),
  ('independente', 'history.edit_own'),
  ('independente', 'calendar.view'),
  ('independente', 'stats.view'),
  ('independente', 'caregiver.share'),
  ('independente', 'notes.add_own')
ON CONFLICT DO NOTHING;

-- ─── 3. Perfis de Usuários (profiles) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                         uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  nome                       text NOT NULL,
  social_name                text,
  email                      text,
  foto_url                   text,
  role                       text NOT NULL DEFAULT 'independente' REFERENCES public.roles(code),
  dob                        date,
  sex                        text,
  cpf                        text,
  phone                      text,
  address                    text,
  weight                     numeric,
  height                     numeric,
  weight_updated_at          timestamptz,
  blood_type                 text DEFAULT 'O+',
  role_change_pin            text,
  role_change_pin_expires_at timestamptz,
  notifications_enabled      boolean DEFAULT true,
  emergency_settings         jsonb DEFAULT '{"show_name":true,"show_age":true,"show_photo":true,"show_blood_type":true,"show_allergies":true,"show_conditions":true,"show_meds":true,"show_contacts":true}'::jsonb,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

-- Trigger automático para criar perfil ao inserir em app_users
CREATE OR REPLACE FUNCTION public.handle_new_app_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'role', 'independente')
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = coalesce(EXCLUDED.nome, public.profiles.nome),
    email = coalesce(EXCLUDED.email, public.profiles.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_app_user_created ON public.app_users;
CREATE TRIGGER on_app_user_created
  AFTER INSERT ON public.app_users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_app_user();

-- ─── 4. Medicamentos (medicamentos) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  nome                    text NOT NULL,
  principio_ativo         text,
  fabricante              text,
  dosagem                 text,
  quantidade              int DEFAULT 30 CHECK (quantidade >= 0),
  unidade                 text DEFAULT 'comprimido',
  cor                     text DEFAULT '#3b82f6',
  observacoes             text,
  foto_url                text,
  horarios                text[] DEFAULT '{"08:00"}',
  dias_semana             int[] DEFAULT '{1,2,3,4,5,6,7}',
  ativo                   boolean DEFAULT true,
  treatment_type          text NOT NULL DEFAULT 'continuous' CHECK (treatment_type IN ('continuous','temporary','sos')),
  start_date              date,
  end_date                date,
  treatment_days          int,
  status                  text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','cancelado')),
  finished_at             timestamptz,
  important_for_emergency boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicamentos_user_id ON public.medicamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_treatment_type ON public.medicamentos(treatment_type);
CREATE INDEX IF NOT EXISTS idx_medicamentos_status ON public.medicamentos(status);
CREATE INDEX IF NOT EXISTS idx_medicamentos_end_date ON public.medicamentos(end_date);

DROP TRIGGER IF EXISTS meds_updated_at ON public.medicamentos;
CREATE TRIGGER meds_updated_at BEFORE UPDATE ON public.medicamentos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 5. Histórico de Doses (historico_doses) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.historico_doses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  med_id            uuid REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  hora              text NOT NULL,
  status            text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','missed','pending','late')),
  atraso_minutos    int DEFAULT 0,
  motivo            text,
  quantidade_usada  numeric DEFAULT 1,
  performed_by      uuid REFERENCES public.app_users(id),
  is_retroactive    boolean DEFAULT false,
  corrected_at      timestamptz,
  correction_reason text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_user_id ON public.historico_doses(user_id);
CREATE INDEX IF NOT EXISTS idx_historico_med_id ON public.historico_doses(med_id);
CREATE INDEX IF NOT EXISTS idx_historico_created ON public.historico_doses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hist_performed_by ON public.historico_doses(performed_by);

-- ─── 6. Cuidadores e Vínculos (caregiver_relationships, caregiver_notes, caregiver_audit_log, cuidadores) ─
CREATE TABLE IF NOT EXISTS public.cuidadores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  cuidador_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  nivel_acesso text DEFAULT 'leitura' CHECK (nivel_acesso IN ('leitura','total')),
  status       text DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','recusado')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (paciente_id, cuidador_id)
);

CREATE TABLE IF NOT EXISTS public.caregiver_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  caregiver_id       uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  permission_level   text NOT NULL DEFAULT 'viewer' CHECK (permission_level IN ('viewer','caregiver','admin')),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined','revoked')),
  invite_token       text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invite_email       text,
  invite_expires_at  timestamptz DEFAULT (now() + interval '7 days'),
  relationship_label text,
  created_at         timestamptz DEFAULT now(),
  accepted_at        timestamptz,
  revoked_at         timestamptz,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (patient_id, caregiver_id)
);

CREATE INDEX IF NOT EXISTS idx_cr_patient_id ON public.caregiver_relationships(patient_id);
CREATE INDEX IF NOT EXISTS idx_cr_caregiver_id ON public.caregiver_relationships(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cr_invite_token ON public.caregiver_relationships(invite_token);
CREATE INDEX IF NOT EXISTS idx_cr_status ON public.caregiver_relationships(status);

CREATE TABLE IF NOT EXISTS public.caregiver_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.caregiver_relationships(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  caregiver_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.caregiver_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid REFERENCES public.caregiver_relationships(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES public.app_users(id),
  action          text NOT NULL,
  details         jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

-- ─── 7. Calendário, Notas e Observações de Dose ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  time        time,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON public.notes(user_id, date);

CREATE TABLE IF NOT EXISTS public.health_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('consulta','exame','procedimento','outro','estoque')),
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  time        time,
  location    text,
  doctor      text,
  completed   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_date ON public.health_events(user_id, date);

CREATE TABLE IF NOT EXISTS public.dose_observations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  hist_id     uuid REFERENCES public.historico_doses(id) ON DELETE CASCADE,
  med_id      uuid REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  date        date NOT NULL,
  hora        text NOT NULL,
  observation text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obs_user_date ON public.dose_observations(user_id, date);

-- ─── 8. Catálogo de Medicamentos & Personalizados ────────────────────────────
CREATE TABLE IF NOT EXISTS public.medication_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name     text NOT NULL,
  active_ingredient   text NOT NULL,
  dosage              text NOT NULL,
  pharmaceutical_form text NOT NULL,
  presentation        text,
  unit                text NOT NULL DEFAULT 'comprimido',
  manufacturer        text,
  medicine_type       text NOT NULL DEFAULT 'generico' CHECK (medicine_type IN ('referencia','generico','similar','outro')),
  is_reference        boolean DEFAULT false,
  is_generic          boolean DEFAULT false,
  is_similar          boolean DEFAULT false,
  search_vector       tsvector,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_search_vec ON public.medication_catalog USING gin(search_vector);

CREATE OR REPLACE FUNCTION public.update_catalog_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.commercial_name, '')),   'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.active_ingredient, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.manufacturer, '')),      'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.dosage, '')),            'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_search_vector_update ON public.medication_catalog;
CREATE TRIGGER catalog_search_vector_update
  BEFORE INSERT OR UPDATE ON public.medication_catalog
  FOR EACH ROW EXECUTE PROCEDURE public.update_catalog_search_vector();

CREATE TABLE IF NOT EXISTS public.custom_medications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  commercial_name     text NOT NULL,
  active_ingredient   text,
  dosage              text,
  pharmaceutical_form text,
  presentation        text,
  unit                text DEFAULT 'comprimido',
  manufacturer        text,
  medicine_type       text DEFAULT 'outro',
  is_custom           boolean DEFAULT true,
  search_vector       tsvector,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── 9. Movimentações de Estoque (stock_movements) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id     uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  movement_type     text NOT NULL CHECK (movement_type IN ('purchase','adjustment','correction','return')),
  quantity_before   numeric NOT NULL,
  quantity_changed  numeric NOT NULL,
  quantity_after    numeric NOT NULL,
  purchase_price    numeric,
  purchase_location text,
  batch             text,
  expiration_date   date,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_med_id ON public.stock_movements(medication_id);
CREATE INDEX IF NOT EXISTS idx_stock_user_id ON public.stock_movements(user_id);

-- ─── 10. Auditoria, Notificações, Push, Saúde e Emergência ───────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES public.app_users(id),
  action       text NOT NULL,
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_patient_id ON public.audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  timezone    text DEFAULT 'America/Sao_Paulo',
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  med_id          uuid REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES public.health_events(id) ON DELETE CASCADE,
  dose_hora       text,
  data_referencia date NOT NULL,
  tipo            text NOT NULL,
  sent_at         timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_med
  ON public.notification_logs(med_id, dose_hora, data_referencia, tipo) WHERE med_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_event
  ON public.notification_logs(event_id, data_referencia, tipo) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.allergies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  reaction   text,
  severity   text DEFAULT 'Moderada',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_conditions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  notes        text,
  diagnosed_at date,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  relationship    text,
  phone           text,
  secondary_phone text,
  priority        int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.healthcare_professionals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  specialty  text,
  crm        text,
  phone      text,
  email      text,
  clinic     text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  tipo        text DEFAULT 'receita' CHECK (tipo IN ('receita','exame','laudo','outro')),
  nome        text,
  arquivo_url text,
  descricao   text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  tipo        text CHECK (tipo IN ('lembrete','atraso','critico','estoque','cuidador')),
  titulo      text,
  mensagem    text,
  lida        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ─── 11. Views (adhesion_stats e dose_corrections) ───────────────────────────
CREATE OR REPLACE VIEW public.adhesion_stats AS
SELECT
  user_id,
  count(*) AS total_doses,
  sum(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_doses,
  round(
    sum(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::numeric / nullif(count(*),0) * 100, 1
  ) AS adhesion_rate,
  avg(atraso_minutos) FILTER (WHERE status = 'confirmed') AS avg_delay_minutes
FROM public.historico_doses
GROUP BY user_id;

CREATE OR REPLACE VIEW public.dose_corrections AS
SELECT
  hd.id            AS historico_id,
  hd.user_id       AS patient_id,
  hd.performed_by,
  hd.is_retroactive,
  hd.corrected_at,
  hd.correction_reason,
  prof.nome        AS corrector_name,
  (hd.performed_by IS NOT NULL AND hd.performed_by <> hd.user_id) AS corrected_by_other
FROM public.historico_doses hd
LEFT JOIN public.profiles prof ON prof.id = hd.performed_by;

-- ─── 12. Funções RPC Standalone (Contexto app_current_user_id()) ─────────────
CREATE OR REPLACE FUNCTION public.caregiver_has_permission(
  p_patient_id uuid,
  p_permission text
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_relationships
    WHERE patient_id   = p_patient_id
      AND caregiver_id = public.app_current_user_id()
      AND status       = 'active'
      AND (
        permission_level = p_permission
        OR permission_level = 'admin'
        OR (p_permission = 'viewer' AND permission_level IN ('viewer','caregiver','admin'))
        OR (p_permission = 'caregiver' AND permission_level IN ('caregiver','admin'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.profiles p ON p.role = rp.role_code
    WHERE p.id = public.app_current_user_id() AND rp.permission = p_permission
  );
$$;

CREATE OR REPLACE FUNCTION public.confirm_dose_retroactive(
  p_patient_id uuid,
  p_med_id     uuid,
  p_hora       text,
  p_dose_date  date,
  p_new_status text DEFAULT 'confirmed',
  p_reason     text DEFAULT null
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_actor           uuid := coalesce(public.app_current_user_id(), p_patient_id);
  v_is_self         boolean := (v_actor = p_patient_id);
  v_role            text;
  v_has_caregiver   boolean;
  v_existing        public.historico_doses%rowtype;
  v_new_id          uuid;
  v_dose_datetime   timestamptz;
  v_hours_elapsed   numeric;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;

  SELECT EXISTS(
    SELECT 1 FROM public.caregiver_relationships
    WHERE patient_id = p_patient_id
      AND caregiver_id = v_actor
      AND status = 'active'
      AND permission_level IN ('caregiver','admin')
  ) INTO v_has_caregiver;

  IF NOT v_is_self AND NOT v_has_caregiver THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado a este paciente.');
  END IF;

  v_dose_datetime := (p_dose_date::timestamptz + p_hora::time);
  IF v_is_self AND v_role = 'paciente' THEN
    v_hours_elapsed := extract(epoch FROM (now() - v_dose_datetime)) / 3600;
    IF v_hours_elapsed > 24 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Prazo de 24 horas para correção expirado.');
    END IF;
  END IF;

  IF v_has_caregiver AND NOT v_is_self AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o motivo da alteração.');
  END IF;

  SELECT * INTO v_existing
  FROM public.historico_doses
  WHERE user_id = p_patient_id
    AND med_id  = p_med_id
    AND hora    = p_hora
    AND created_at::date = p_dose_date
  LIMIT 1;

  IF FOUND THEN
    IF v_is_self AND v_existing.performed_by IS NOT NULL AND v_existing.performed_by <> p_patient_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este registro foi feito por um cuidador e não pode ser alterado por você.');
    END IF;

    INSERT INTO public.audit_logs (patient_id, performed_by, action, old_value, new_value, reason)
    VALUES (
      p_patient_id, v_actor, 'dose_status_updated',
      to_jsonb(v_existing),
      jsonb_build_object('status', p_new_status, 'hora', p_hora, 'date', p_dose_date),
      coalesce(nullif(trim(p_reason), ''), 'Ajuste do próprio usuário')
    );

    UPDATE public.historico_doses
    SET status = p_new_status, is_retroactive = true, performed_by = v_actor, corrected_at = now(), correction_reason = nullif(trim(p_reason), '')
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'id', v_existing.id, 'action', 'updated');
  ELSE
    INSERT INTO public.historico_doses
      (med_id, user_id, hora, status, atraso_minutos, performed_by, is_retroactive, corrected_at, created_at, correction_reason)
    VALUES
      (p_med_id, p_patient_id, p_hora, p_new_status, 0, v_actor, true, now(), v_dose_datetime, nullif(trim(p_reason), ''))
    RETURNING id INTO v_new_id;

    INSERT INTO public.audit_logs (patient_id, performed_by, action, old_value, new_value, reason)
    VALUES (
      p_patient_id, v_actor, 'dose_confirmed_retroactively',
      null,
      jsonb_build_object('status', p_new_status, 'hora', p_hora, 'date', p_dose_date),
      coalesce(nullif(trim(p_reason), ''), 'Ajuste do próprio usuário')
    );

    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'action', 'created');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_expired_treatments(p_user_id uuid DEFAULT null)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_uid   uuid := coalesce(p_user_id, public.app_current_user_id());
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.medicamentos
    SET status = 'concluido', finished_at = now(), ativo = false
    WHERE treatment_type = 'temporary'
      AND status = 'ativo'
      AND end_date IS NOT NULL
      AND end_date < current_date
      AND (v_uid IS NULL OR user_id = v_uid)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_medication_id       uuid,
  p_movement_type       text,
  p_quantity_before     numeric,
  p_quantity_after      numeric,
  p_purchase_price      numeric DEFAULT null,
  p_purchase_location   text DEFAULT null,
  p_batch               text DEFAULT null,
  p_expiration_date     date DEFAULT null,
  p_notes               text DEFAULT null
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_med           record;
  v_movement_id   uuid;
  v_qty_changed   numeric := p_quantity_after - p_quantity_before;
  v_event_id      uuid;
BEGIN
  SELECT id, user_id, nome, unidade INTO v_med
  FROM public.medicamentos
  WHERE id = p_medication_id
    AND (public.app_current_user_id() IS NULL OR user_id = public.app_current_user_id());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Medicamento não encontrado ou acesso negado.');
  END IF;

  UPDATE public.medicamentos SET quantidade = p_quantity_after::int WHERE id = p_medication_id;

  INSERT INTO public.stock_movements (
    medication_id, user_id, movement_type,
    quantity_before, quantity_changed, quantity_after,
    purchase_price, purchase_location, batch, expiration_date, notes
  ) VALUES (
    p_medication_id, v_med.user_id, p_movement_type,
    p_quantity_before, v_qty_changed, p_quantity_after,
    p_purchase_price, p_purchase_location, p_batch, p_expiration_date, p_notes
  ) RETURNING id INTO v_movement_id;

  IF v_qty_changed > 0 THEN
    INSERT INTO public.health_events (user_id, type, title, description, date, time)
    VALUES (
      v_med.user_id, 'estoque', v_med.nome,
      format('Quantidade adicionada: +%s %s · Estoque atual: %s %s',
             v_qty_changed, v_med.unidade, p_quantity_after, v_med.unidade),
      current_date, to_char(now(), 'HH24:MI')::time
    )
    RETURNING id INTO v_event_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'movement_id', v_movement_id, 'event_id', v_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_role_with_pin(p_pin text, p_new_role text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_uid          uuid := public.app_current_user_id();
  v_caregiver_id uuid;
BEGIN
  SELECT c.caregiver_id INTO v_caregiver_id
  FROM public.caregiver_relationships c
  JOIN public.profiles p ON p.id = c.caregiver_id
  WHERE c.patient_id = v_uid
    AND c.status = 'active'
    AND p.role_change_pin = p_pin
    AND p.role_change_pin_expires_at > now()
  LIMIT 1;

  IF v_caregiver_id IS NOT NULL THEN
    UPDATE public.profiles SET role_change_pin = NULL WHERE id = v_caregiver_id;
    UPDATE public.profiles SET role = p_new_role WHERE id = v_uid;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_medications(query text, result_limit int DEFAULT 20)
RETURNS TABLE (
  id                  uuid,
  commercial_name     text,
  active_ingredient   text,
  dosage              text,
  pharmaceutical_form text,
  presentation        text,
  unit                text,
  manufacturer        text,
  medicine_type       text,
  is_reference        boolean,
  is_generic          boolean,
  is_similar          boolean,
  score               float
) LANGUAGE sql STABLE AS $$
  SELECT
    id, commercial_name, active_ingredient, dosage,
    pharmaceutical_form, presentation, unit, manufacturer,
    medicine_type, is_reference, is_generic, is_similar,
    ts_rank(search_vector, websearch_to_tsquery('portuguese', query))::float AS score
  FROM public.medication_catalog
  WHERE
    search_vector @@ websearch_to_tsquery('portuguese', query)
    OR commercial_name   ILIKE '%' || query || '%'
    OR active_ingredient ILIKE '%' || query || '%'
    OR manufacturer      ILIKE '%' || query || '%'
  ORDER BY score DESC, commercial_name ASC
  LIMIT result_limit;
$$;
