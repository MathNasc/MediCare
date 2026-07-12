-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Fix 008b: corrige get_all_stock_forecasts
--  O erro "column days_remaining does not exist" acontece porque a
--  função original não dava um ALIAS às colunas calculadas no SELECT,
--  então o ORDER BY não conseguia enxergar esse nome. Basta rodar este
--  script (substitui a função anterior).
-- ═══════════════════════════════════════════════════════════════════

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
