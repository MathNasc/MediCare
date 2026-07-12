-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 007: Tipos de Tratamento
--  (Uso Contínuo / Tratamento Temporário / Uso Sob Demanda - SOS)
--  Execute no SQL Editor do Supabase após 006_rbac_and_audit.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Novas colunas em medicamentos ────────────────────────────────────────────
alter table public.medicamentos
  add column if not exists treatment_type text not null default 'continuous'
    check (treatment_type in ('continuous','temporary','sos')),
  add column if not exists start_date     date,
  add column if not exists end_date       date,
  add column if not exists treatment_days int,
  add column if not exists status         text not null default 'ativo'
    check (status in ('ativo','pausado','concluido','cancelado')),
  add column if not exists finished_at    timestamptz;

create index if not exists idx_medicamentos_treatment_type on public.medicamentos(treatment_type);
create index if not exists idx_medicamentos_status         on public.medicamentos(status);
create index if not exists idx_medicamentos_end_date        on public.medicamentos(end_date);

-- Medicamentos já existentes continuam como "uso contínuo / ativo"
-- (o default acima já cobre isso para linhas futuras; a linha abaixo
--  normaliza dados antigos que porventura tenham status nulo)
update public.medicamentos set status = 'ativo' where status is null;

-- ─── Novas colunas em historico_doses (uso SOS e ajustes) ────────────────────
alter table public.historico_doses
  add column if not exists motivo           text,   -- ex: "Dor de cabeça" (uso SOS)
  add column if not exists quantidade_usada numeric default 1;

-- ─── Função: encerrar automaticamente tratamentos temporários vencidos ────────
-- Chamada de forma barata e idempotente a cada carregamento do app
-- (ver AppContext.loadAll). Também pode ser agendada via pg_cron, análogo
-- ao job de lembretes em 003_fcm_cron.sql, se desejado no futuro.
create or replace function public.finish_expired_treatments()
returns integer language plpgsql security definer as $$
declare
  v_count integer;
begin
  with updated as (
    update public.medicamentos
    set status = 'concluido', finished_at = now(), ativo = false
    where treatment_type = 'temporary'
      and status = 'ativo'
      and end_date is not null
      and end_date < current_date
      and user_id = auth.uid()
    returning id
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

-- ─── Função: repetir um tratamento temporário já concluído ────────────────────
-- Duplica nome, dosagem, horários, unidade e cor; solicita apenas a nova
-- data de início. A data de término é recalculada a partir de treatment_days.
create or replace function public.repeat_treatment(p_med_id uuid, p_new_start_date date)
returns uuid language plpgsql security definer as $$
declare
  v_original public.medicamentos%rowtype;
  v_new_id   uuid;
  v_days     int;
  v_end_date date;
begin
  select * into v_original
  from public.medicamentos
  where id = p_med_id and user_id = auth.uid();

  if not found then
    raise exception 'Medicamento não encontrado ou acesso negado.';
  end if;

  v_days := coalesce(v_original.treatment_days, 7);
  v_end_date := p_new_start_date + (v_days - 1);

  insert into public.medicamentos (
    user_id, nome, dosagem, quantidade, unidade, cor, observacoes,
    horarios, dias_semana, ativo,
    treatment_type, start_date, end_date, treatment_days, status
  ) values (
    auth.uid(), v_original.nome, v_original.dosagem, v_original.quantidade,
    v_original.unidade, v_original.cor, v_original.observacoes,
    v_original.horarios, v_original.dias_semana, true,
    'temporary', p_new_start_date, v_end_date, v_days, 'ativo'
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ─── View auxiliar: indicadores do dashboard ──────────────────────────────────
create or replace function public.get_treatment_dashboard(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_continuous  integer;
  v_active_temp integer;
  v_finished    integer;
  v_sos_month   integer;
begin
  select count(*) into v_continuous
  from public.medicamentos
  where user_id = v_uid and treatment_type = 'continuous' and ativo = true;

  select count(*) into v_active_temp
  from public.medicamentos
  where user_id = v_uid and treatment_type = 'temporary' and status = 'ativo';

  select count(*) into v_finished
  from public.medicamentos
  where user_id = v_uid and treatment_type = 'temporary' and status = 'concluido';

  select count(*) into v_sos_month
  from public.historico_doses hd
  join public.medicamentos m on m.id = hd.med_id
  where hd.user_id = v_uid
    and m.treatment_type = 'sos'
    and hd.created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'continuous_count',      v_continuous,
    'active_treatments',     v_active_temp,
    'finished_treatments',   v_finished,
    'sos_uses_this_month',   v_sos_month
  );
end;
$$;
