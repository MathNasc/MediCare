-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 006: Perfis, RBAC e Auditoria
--  Execute no SQL Editor do Supabase após 005_caregiver_system.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Tabela de papéis (RBAC extensível) ──────────────────────────────────────
create table if not exists public.roles (
  code        text primary key,
  label       text not null,
  description text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

insert into public.roles (code, label, description) values
  ('paciente',     'Paciente',     'Registra seus próprios medicamentos. Não pode alterar confirmações após 24h nem editar registros feitos por cuidadores.'),
  ('cuidador',     'Cuidador',     'Acompanha e administra o tratamento de pacientes vinculados, incluindo correções retroativas com justificativa.'),
  ('independente', 'Independente', 'Controle total sobre os próprios dados, sem restrição de tempo e sem depender de cuidador.')
on conflict (code) do nothing;

-- Papéis futuros (desativados por padrão — ativar quando implementados)
insert into public.roles (code, label, description, is_active) values
  ('medico',          'Médico',                'Acesso clínico a pacientes vinculados por prescrição.', false),
  ('enfermeiro',      'Enfermeiro',             'Suporte de enfermagem a pacientes vinculados.',          false),
  ('clinica',         'Clínica',                'Gestão institucional de múltiplos pacientes.',           false),
  ('farmacia',        'Farmácia',               'Acompanhamento de dispensação de medicamentos.',         false),
  ('admin_sistema',   'Administrador do Sistema','Gestão da plataforma MediCare.',                        false)
on conflict (code) do nothing;

-- ─── Permissões por papel (RBAC) ──────────────────────────────────────────────
create table if not exists public.role_permissions (
  role_code  text not null references public.roles(code) on delete cascade,
  permission text not null,
  primary key (role_code, permission)
);

insert into public.role_permissions (role_code, permission) values
  -- Paciente
  ('paciente', 'meds.create'),
  ('paciente', 'meds.edit_own'),
  ('paciente', 'dose.confirm'),
  ('paciente', 'dose.edit_own_24h'),
  ('paciente', 'history.view'),
  ('paciente', 'calendar.view'),
  ('paciente', 'stats.view'),
  ('paciente', 'caregiver.share'),
  ('paciente', 'notes.add_own'),
  -- Cuidador
  ('cuidador', 'patients.view_all'),
  ('cuidador', 'dose.confirm_for_patient'),
  ('cuidador', 'dose.confirm_retroactive'),
  ('cuidador', 'dose.correct_retroactive'),
  ('cuidador', 'calendar.view'),
  ('cuidador', 'history.view'),
  ('cuidador', 'notes.add_caregiver'),
  ('cuidador', 'alerts.receive'),
  -- Independente
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
on conflict do nothing;

-- ─── Coluna de papel no perfil ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'independente' references public.roles(code);

-- ─── Atualiza trigger de criação de perfil para respeitar o papel escolhido ───
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'independente')
  )
  on conflict (id) do update set
    nome = excluded.nome,
    role = coalesce(public.profiles.role, excluded.role);
  return new;
end;
$$;

-- ─── Colunas de rastreabilidade em historico_doses ────────────────────────────
alter table public.historico_doses
  add column if not exists performed_by   uuid references auth.users(id),
  add column if not exists is_retroactive boolean default false,
  add column if not exists corrected_at   timestamptz;

create index if not exists idx_hist_performed_by on public.historico_doses(performed_by);

-- ─── Log de auditoria (nunca apaga o histórico original) ──────────────────────
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references auth.users(id) on delete cascade,
  performed_by uuid references auth.users(id),
  action       text not null,
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_at   timestamptz default now()
);

create index if not exists idx_audit_patient_id   on public.audit_logs(patient_id);
create index if not exists idx_audit_performed_by on public.audit_logs(performed_by);
create index if not exists idx_audit_created      on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_read_involved" on public.audit_logs
  for select using (
    patient_id = auth.uid() or performed_by = auth.uid()
  );

-- Auditoria é somente inserida via função security definer (nunca direto pela API)
create policy "audit_no_direct_insert" on public.audit_logs
  for insert with check (false);

-- ─── Funções auxiliares de RBAC ──────────────────────────────────────────────
create or replace function public.get_user_role(p_user_id uuid default null)
returns text language sql stable security definer as $$
  select role from public.profiles where id = coalesce(p_user_id, auth.uid());
$$;

create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.profiles p on p.role = rp.role_code
    where p.id = auth.uid() and rp.permission = p_permission
  );
$$;

-- ─── RLS de historico_doses: granular por papel ───────────────────────────────
-- Remove a policy antiga "for all" (excessivamente permissiva)
drop policy if exists "hist_own" on public.historico_doses;

create policy "hist_select_own" on public.historico_doses
  for select using (auth.uid() = user_id);

create policy "hist_insert_own" on public.historico_doses
  for insert with check (auth.uid() = user_id);

-- Independente: edita a qualquer momento
create policy "hist_update_unrestricted" on public.historico_doses
  for update using (
    auth.uid() = user_id and public.has_permission('dose.edit_own_any_time')
  );

-- Paciente: edita apenas nas primeiras 24h e apenas registros que ele mesmo fez
create policy "hist_update_24h_window" on public.historico_doses
  for update using (
    auth.uid() = user_id
    and public.has_permission('dose.edit_own_24h')
    and created_at > now() - interval '24 hours'
    and (performed_by is null or performed_by = auth.uid())
  );

-- Nenhuma policy de DELETE é criada de propósito:
-- o histórico nunca é apagado, apenas corrigido via auditoria.

-- ─── Função: confirmar/corrigir dose retroativamente ──────────────────────────
-- Único caminho permitido para correções em datas passadas.
-- Cuidadores DEVEM informar o motivo. Independente pode omitir (padrão registrado).
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
    set status = p_new_status, is_retroactive = true, performed_by = auth.uid(), corrected_at = now()
    where id = v_existing.id;

    return jsonb_build_object('success', true, 'id', v_existing.id, 'action', 'updated');
  else
    insert into public.historico_doses
      (med_id, user_id, hora, status, atraso_minutos, performed_by, is_retroactive, corrected_at, created_at)
    values
      (p_med_id, p_patient_id, p_hora, p_new_status, 0, auth.uid(), true, now(), v_dose_datetime)
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

-- ─── Função: listar auditoria de um paciente (para tela de histórico/transparência) ─
create or replace function public.list_audit_logs(p_patient_id uuid, p_limit int default 50)
returns setof public.audit_logs
language sql stable security definer as $$
  select * from public.audit_logs
  where patient_id = p_patient_id
    and (patient_id = auth.uid() or performed_by = auth.uid()
         or exists (
           select 1 from public.caregiver_relationships
           where patient_id = p_patient_id and caregiver_id = auth.uid() and status = 'active'
         ))
  order by created_at desc
  limit p_limit;
$$;

-- ─── View auxiliar: última correção de cada dose (para badge visual) ──────────
create or replace view public.dose_corrections as
select
  hd.id            as historico_id,
  hd.user_id       as patient_id,
  hd.performed_by,
  hd.is_retroactive,
  hd.corrected_at,
  prof.nome        as corrector_name,
  (hd.performed_by is not null and hd.performed_by <> hd.user_id) as corrected_by_other
from public.historico_doses hd
left join public.profiles prof on prof.id = hd.performed_by;
