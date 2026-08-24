alter table public.historico_doses add column if not exists correction_reason text;

create or replace function public.confirm_dose_retroactive(
  p_patient_id uuid,
  p_med_id     uuid,
  p_hora       text,
  p_dose_date  date,
  p_new_status text default 'confirmed',
  p_reason     text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_is_self         boolean := (auth.uid() = p_patient_id);
  v_role            text;
  v_has_caregiver   boolean;
  v_existing        public.historico_doses%rowtype;
  v_new_id          uuid;
  v_dose_datetime   timestamptz;
  v_hours_elapsed   numeric;
begin
  select role into v_role from public.profiles where id = auth.uid();
  
  select exists(
    select 1 from public.caregiver_relationships
    where patient_id = p_patient_id
      and caregiver_id = auth.uid()
      and status = 'active'
      and permission_level in ('caregiver','admin')
  ) into v_has_caregiver;

  -- Acesso negado: não é o próprio paciente nem cuidador autorizado
  if not v_is_self and not v_has_caregiver then
    return jsonb_build_object('success', false, 'error', 'Acesso negado a este paciente.');
  end if;

  -- Paciente (role='paciente') só corrige as próprias doses dentro de 24h
  v_dose_datetime := (p_dose_date::timestamptz + p_hora::time);
  if v_is_self and v_role = 'paciente' then
    v_hours_elapsed := extract(epoch from (now() - v_dose_datetime)) / 3600;
    if v_hours_elapsed > 24 then
      return jsonb_build_object('success', false, 'error', 'Prazo de 24 horas para correção expirado.');
    end if;
  end if;

  -- Cuidador deve sempre justificar a alteração
  if v_has_caregiver and not v_is_self and (p_reason is null or length(trim(p_reason)) = 0) then
    return jsonb_build_object('success', false, 'error', 'Informe o motivo da alteração.');
  end if;

  -- Busca registro existente para esta data/hora/medicamento
  select * into v_existing
  from public.historico_doses
  where user_id = p_patient_id
    and med_id  = p_med_id
    and hora    = p_hora
    and created_at::date = p_dose_date
  limit 1;

  if found then
    -- Impede que o próprio paciente sobrescreva um registro feito por um cuidador
    if v_is_self and v_existing.performed_by is not null and v_existing.performed_by <> p_patient_id then
      return jsonb_build_object('success', false, 'error', 'Este registro foi feito por um cuidador e não pode ser alterado por você.');
    end if;

    insert into public.audit_logs (patient_id, performed_by, action, old_value, new_value, reason)
    values (
      p_patient_id, auth.uid(), 'dose_status_updated',
      to_jsonb(v_existing),
      jsonb_build_object('status', p_new_status, 'hora', p_hora, 'date', p_dose_date),
      coalesce(nullif(trim(p_reason), ''), 'Ajuste do próprio usuário')
    );

    update public.historico_doses
    set status = p_new_status, is_retroactive = true, performed_by = auth.uid(), corrected_at = now(), correction_reason = nullif(trim(p_reason), '')
    where id = v_existing.id;

    return jsonb_build_object('success', true, 'id', v_existing.id, 'action', 'updated');
  else
    insert into public.historico_doses
      (med_id, user_id, hora, status, atraso_minutos, performed_by, is_retroactive, corrected_at, created_at, correction_reason)
    values
      (p_med_id, p_patient_id, p_hora, p_new_status, 0, auth.uid(), true, now(), v_dose_datetime, nullif(trim(p_reason), ''))
    returning id into v_new_id;

    insert into public.audit_logs (patient_id, performed_by, action, old_value, new_value, reason)
    values (
      p_patient_id, auth.uid(), 'dose_confirmed_retroactively',
      null,
      jsonb_build_object('status', p_new_status, 'hora', p_hora, 'date', p_dose_date),
      coalesce(nullif(trim(p_reason), ''), 'Ajuste do próprio usuário')
    );

    return jsonb_build_object('success', true, 'id', v_new_id, 'action', 'created');
  end if;
end;
$$;
