-- MediCare — Migração 06: Chat Direto Paciente <-> Cuidador (Vínculo Ativo)
-- Idempotente e não-destrutiva.

CREATE TABLE IF NOT EXISTS public.caregiver_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid REFERENCES public.caregiver_relationships(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('paciente', 'cuidador')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cg_chat_thread_created
  ON public.caregiver_chat_messages (patient_id, caregiver_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_cg_chat_unread
  ON public.caregiver_chat_messages (patient_id, caregiver_id, sender_role, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cg_chat_caregiver_recent
  ON public.caregiver_chat_messages (caregiver_id, created_at DESC);

INSERT INTO public.schema_migrations (version, description)
VALUES (
  '06_caregiver_patient_chat',
  'Tabela caregiver_chat_messages para comunicação direta entre paciente supervisionado e cuidador vinculado'
)
ON CONFLICT (version) DO NOTHING;
