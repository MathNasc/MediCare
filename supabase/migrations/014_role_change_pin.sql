-- Adiciona a coluna para armazenar o PIN gerado no perfil do cuidador
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_change_pin text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_change_pin_expires_at timestamptz;

-- Função para o cuidador gerar um PIN para seus pacientes
CREATE OR REPLACE FUNCTION public.generate_role_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin text;
BEGIN
  -- Gera um PIN de 6 digitos aleatorios
  v_pin := lpad((random() * 999999)::int::text, 6, '0');
  
  UPDATE public.profiles
  SET role_change_pin = v_pin,
      role_change_pin_expires_at = now() + interval '1 hour'
  WHERE id = auth.uid();
  
  RETURN v_pin;
END;
$$;

-- Função para o paciente tentar mudar o perfil com PIN
CREATE OR REPLACE FUNCTION public.change_role_with_pin(p_pin text, p_new_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caregiver_id uuid;
BEGIN
  -- Busca um cuidador ativo deste paciente que tenha o PIN correto e nao expirado
  SELECT c.caregiver_id INTO v_caregiver_id
  FROM public.caregiver_relationships c
  JOIN public.profiles p ON p.id = c.caregiver_id
  WHERE c.patient_id = auth.uid()
    AND c.status = 'active'
    AND p.role_change_pin = p_pin
    AND p.role_change_pin_expires_at > now()
  LIMIT 1;

  IF v_caregiver_id IS NOT NULL THEN
    -- Invalida o PIN para não ser usado de novo
    UPDATE public.profiles SET role_change_pin = NULL WHERE id = v_caregiver_id;
    
    -- Muda a role do paciente
    UPDATE public.profiles SET role = p_new_role WHERE id = auth.uid();
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
