-- Migration 013: Profile Enhancements and Health Info

-- 1. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_name text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS weight_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS emergency_settings jsonb DEFAULT '{"show_name":true, "show_age":true, "show_photo":true, "show_blood_type":true, "show_allergies":true, "show_conditions":true, "show_meds":true, "show_contacts":true}'::jsonb;

-- 2. New table: allergies
CREATE TABLE IF NOT EXISTS public.allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allergies_user ON public.allergies(user_id);

-- 3. New table: health_conditions
CREATE TABLE IF NOT EXISTS public.health_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  diagnosed_at date,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_conditions_user ON public.health_conditions(user_id);

-- 4. New table: emergency_contacts
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone text,
  secondary_phone text,
  priority int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON public.emergency_contacts(user_id);

-- 5. New table: healthcare_professionals
CREATE TABLE IF NOT EXISTS public.healthcare_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text,
  phone text,
  email text,
  clinic text,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_healthcare_professionals_user ON public.healthcare_professionals(user_id);

-- 6. Add important_for_emergency to medicamentos
ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS important_for_emergency boolean DEFAULT false;

-- 7. Setup RLS
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allergies_own" ON public.allergies;
CREATE POLICY "allergies_own" ON public.allergies FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "health_conditions_own" ON public.health_conditions;
CREATE POLICY "health_conditions_own" ON public.health_conditions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "emergency_contacts_own" ON public.emergency_contacts;
CREATE POLICY "emergency_contacts_own" ON public.emergency_contacts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "healthcare_professionals_own" ON public.healthcare_professionals;
CREATE POLICY "healthcare_professionals_own" ON public.healthcare_professionals FOR ALL USING (auth.uid() = user_id);

-- Caregiver read access policies
DROP POLICY IF EXISTS "caregiver_read_allergies" ON public.allergies;
CREATE POLICY "caregiver_read_allergies" ON public.allergies FOR SELECT USING (public.caregiver_has_permission(user_id, 'viewer'));

DROP POLICY IF EXISTS "caregiver_read_health_conditions" ON public.health_conditions;
CREATE POLICY "caregiver_read_health_conditions" ON public.health_conditions FOR SELECT USING (public.caregiver_has_permission(user_id, 'viewer'));

DROP POLICY IF EXISTS "caregiver_read_emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "caregiver_read_emergency_contacts" ON public.emergency_contacts FOR SELECT USING (public.caregiver_has_permission(user_id, 'viewer'));

DROP POLICY IF EXISTS "caregiver_read_healthcare_professionals" ON public.healthcare_professionals;
CREATE POLICY "caregiver_read_healthcare_professionals" ON public.healthcare_professionals FOR SELECT USING (public.caregiver_has_permission(user_id, 'viewer'));

DROP POLICY IF EXISTS "caregiver_read_profiles" ON public.profiles;
CREATE POLICY "caregiver_read_profiles" ON public.profiles FOR SELECT USING (public.caregiver_has_permission(id, 'viewer'));

-- 8. Avatars Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
CREATE POLICY "Anyone can upload an avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Anyone can update their avatar" ON storage.objects;
CREATE POLICY "Anyone can update their avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Anyone can delete their avatar" ON storage.objects;
CREATE POLICY "Anyone can delete their avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
