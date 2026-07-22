-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Fix 008c: corrige tipo de dado em record_stock_movement
--
--  Erro original: "column "time" is of type time without time zone
--  but expression is of type text"
--
--  Causa: to_char(now(), 'HH24:MI') retorna TEXT, mas health_events.time
--  é do tipo TIME. Faltava um cast explícito (::time).
--
--  Basta rodar este arquivo — ele substitui a função anterior via
--  CREATE OR REPLACE, sem precisar re-rodar a migration 008 inteira
--  nem mexer em nenhuma tabela já criada.
-- ═══════════════════════════════════════════════════════════════════

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
      current_date,
      to_char(now(), 'HH24:MI')::time  -- ← FIX: cast explícito text → time
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object('success', true, 'movement_id', v_movement_id, 'event_id', v_event_id);
end;
$$;
