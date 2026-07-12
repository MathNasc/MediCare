-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 008: Histórico Automático de Reposição de Estoque
--  Execute no SQL Editor do Supabase após 007_treatment_types.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Tabela de movimentações de estoque ───────────────────────────────────────
create table if not exists public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  medication_id     uuid not null references public.medicamentos(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  movement_type     text not null check (movement_type in ('purchase','adjustment','correction','return')),
  quantity_before   numeric not null,
  quantity_changed  numeric not null, -- positivo = entrada, negativo = saída
  quantity_after    numeric not null,
  purchase_price    numeric,
  purchase_location text,
  batch             text,
  expiration_date   date,
  notes             text,
  created_at        timestamptz default now()
);

create index if not exists idx_stock_med_id     on public.stock_movements(medication_id);
create index if not exists idx_stock_user_id    on public.stock_movements(user_id);
create index if not exists idx_stock_type        on public.stock_movements(movement_type);
create index if not exists idx_stock_created     on public.stock_movements(created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.stock_movements enable row level security;

create policy "stock_own" on public.stock_movements
  for all using (auth.uid() = user_id);

create policy "stock_caregiver_select" on public.stock_movements
  for select using (
    user_id in (
      select patient_id from public.caregiver_relationships
      where caregiver_id = auth.uid() and status = 'active'
    )
  );

-- Nunca apagar movimentações pela API (somente leitura + inserção via RPC)
create policy "stock_no_delete" on public.stock_movements
  for delete using (false);

-- ─── Nova categoria de evento no calendário: 📦 Estoque ───────────────────────
alter table public.health_events drop constraint if exists health_events_type_check;
alter table public.health_events
  add constraint health_events_type_check
  check (type in ('consulta','exame','procedimento','outro','estoque'));

-- ─── Função: registrar movimentação de estoque (+ evento de calendário) ───────
-- Único caminho para registrar uma movimentação. Sempre roda com
-- security definer para garantir atomicidade entre stock_movements e
-- o evento de calendário correspondente (quando a quantidade aumenta).
create or replace function public.record_stock_movement(
  p_medication_id       uuid,
  p_movement_type       text,
  p_quantity_before     numeric,
  p_quantity_after      numeric,
  p_purchase_price      numeric default null,
  p_purchase_location   text default null,
  p_batch               text default null,
  p_expiration_date     date default null,
  p_notes               text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_med           record;
  v_movement_id   uuid;
  v_qty_changed   numeric := p_quantity_after - p_quantity_before;
  v_event_id      uuid;
begin
  select id, nome, unidade into v_med
  from public.medicamentos
  where id = p_medication_id and user_id = auth.uid();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Medicamento não encontrado ou acesso negado.');
  end if;

  if p_movement_type not in ('purchase','adjustment','correction','return') then
    return jsonb_build_object('success', false, 'error', 'Tipo de movimentação inválido.');
  end if;

  insert into public.stock_movements (
    medication_id, user_id, movement_type,
    quantity_before, quantity_changed, quantity_after,
    purchase_price, purchase_location, batch, expiration_date, notes
  ) values (
    p_medication_id, auth.uid(), p_movement_type,
    p_quantity_before, v_qty_changed, p_quantity_after,
    p_purchase_price, p_purchase_location, p_batch, p_expiration_date, p_notes
  ) returning id into v_movement_id;

  -- Evento no calendário: apenas quando a quantidade AUMENTA (reposição)
  if v_qty_changed > 0 then
    insert into public.health_events (user_id, type, title, description, date, time)
    values (
      auth.uid(), 'estoque', v_med.nome,
      format('Quantidade adicionada: +%s %s · Estoque atual: %s %s',
             v_qty_changed, v_med.unidade, p_quantity_after, v_med.unidade),
      current_date, to_char(now(), 'HH24:MI')
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object('success', true, 'movement_id', v_movement_id, 'event_id', v_event_id);
end;
$$;

-- ─── Função: previsão de término de estoque para UM medicamento ───────────────
-- Considera a taxa de consumo real (doses confirmadas nos últimos 30 dias)
-- para estimar quantos dias o estoque atual ainda vai durar.
create or replace function public.get_stock_forecast(p_med_id uuid)
returns jsonb language plpgsql stable security definer as $$
declare
  v_current_qty      numeric;
  v_last_purchase     date;
  v_month_qty         numeric;
  v_avg_duration      numeric;
  v_daily_rate        numeric;
  v_days_remaining    numeric;
  v_forecast_date     date;
begin
  select quantidade into v_current_qty
  from public.medicamentos where id = p_med_id and user_id = auth.uid();

  if not found then
    raise exception 'Medicamento não encontrado ou acesso negado.';
  end if;

  select max(created_at)::date into v_last_purchase
  from public.stock_movements
  where medication_id = p_med_id and movement_type = 'purchase';

  select coalesce(sum(quantity_changed), 0) into v_month_qty
  from public.stock_movements
  where medication_id = p_med_id and movement_type = 'purchase'
    and created_at >= date_trunc('month', now());

  with purchases as (
    select created_at, lag(created_at) over (order by created_at) as prev_at
    from public.stock_movements
    where medication_id = p_med_id and movement_type = 'purchase'
  )
  select avg(extract(epoch from (created_at - prev_at)) / 86400)
  into v_avg_duration
  from purchases where prev_at is not null;

  select coalesce(count(*)::numeric / 30, 0) into v_daily_rate
  from public.historico_doses
  where med_id = p_med_id and status = 'confirmed'
    and created_at >= now() - interval '30 days';

  if v_daily_rate > 0 then
    v_days_remaining := round(v_current_qty / v_daily_rate);
    v_forecast_date  := (now() + (v_days_remaining || ' days')::interval)::date;
  end if;

  return jsonb_build_object(
    'current_quantity',          v_current_qty,
    'last_purchase_date',        v_last_purchase,
    'month_quantity_purchased',  v_month_qty,
    'avg_purchase_duration_days', round(v_avg_duration),
    'daily_consumption_rate',    round(v_daily_rate, 2),
    'days_remaining',            v_days_remaining,
    'forecast_depletion_date',   v_forecast_date
  );
end;
$$;

-- ─── Função: previsão para TODOS os medicamentos (dashboard) ──────────────────
create or replace function public.get_all_stock_forecasts()
returns table (
  medication_id            uuid,
  nome                     text,
  unidade                  text,
  current_quantity         numeric,
  daily_consumption_rate   numeric,
  days_remaining           numeric,
  forecast_depletion_date  date
) language sql stable security definer as $$
  select
    m.id                                as medication_id,
    m.nome                              as nome,
    m.unidade                           as unidade,
    m.quantidade                        as current_quantity,
    coalesce(dr.rate, 0)                as daily_consumption_rate,
    case when coalesce(dr.rate,0) > 0
      then round(m.quantidade / dr.rate)
    end                                  as days_remaining,
    case when coalesce(dr.rate,0) > 0
      then (now() + (round(m.quantidade / dr.rate) || ' days')::interval)::date
    end                                  as forecast_depletion_date
  from public.medicamentos m
  left join lateral (
    select count(*)::numeric / 30 as rate
    from public.historico_doses hd
    where hd.med_id = m.id and hd.status = 'confirmed'
      and hd.created_at >= now() - interval '30 days'
  ) dr on true
  where m.user_id = auth.uid()
    and m.ativo = true
    and m.treatment_type <> 'sos'
  order by days_remaining asc nulls last;
$$;

-- ─── Função: listar movimentações de um medicamento (ou todos) ────────────────
create or replace function public.list_stock_movements(p_med_id uuid default null, p_limit int default 50)
returns setof public.stock_movements
language sql stable security definer as $$
  select *
  from public.stock_movements
  where user_id = auth.uid()
    and (p_med_id is null or medication_id = p_med_id)
  order by created_at desc
  limit p_limit;
$$;
