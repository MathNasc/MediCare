-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 004: Catálogo de Medicamentos
--  Execute no SQL Editor do Supabase após 003_fcm_cron.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Catálogo global de medicamentos ─────────────────────────────────────────
create table if not exists public.medication_catalog (
  id                  uuid primary key default gen_random_uuid(),
  commercial_name     text not null,
  active_ingredient   text not null,
  dosage              text not null,
  pharmaceutical_form text not null,
  presentation        text,
  unit                text not null default 'comprimido',
  manufacturer        text,
  medicine_type       text not null default 'generico'
                      check (medicine_type in ('referencia','generico','similar','outro')),
  is_reference        boolean default false,
  is_generic          boolean default false,
  is_similar          boolean default false,
  search_vector       tsvector,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Índices de performance
create index if not exists idx_catalog_commercial   on public.medication_catalog using gin(to_tsvector('portuguese', commercial_name));
create index if not exists idx_catalog_active       on public.medication_catalog using gin(to_tsvector('portuguese', active_ingredient));
create index if not exists idx_catalog_manufacturer on public.medication_catalog(manufacturer);
create index if not exists idx_catalog_type         on public.medication_catalog(medicine_type);
create index if not exists idx_catalog_search_vec   on public.medication_catalog using gin(search_vector);

-- Trigger para manter search_vector atualizado
create or replace function public.update_catalog_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.commercial_name, '')),   'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.active_ingredient, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(new.manufacturer, '')),      'C') ||
    setweight(to_tsvector('portuguese', coalesce(new.dosage, '')),            'D');
  return new;
end;
$$;

drop trigger if exists catalog_search_vector_update on public.medication_catalog;
create trigger catalog_search_vector_update
  before insert or update on public.medication_catalog
  for each row execute procedure public.update_catalog_search_vector();

-- ─── Medicamentos personalizados por usuário ──────────────────────────────────
create table if not exists public.custom_medications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  commercial_name     text not null,
  active_ingredient   text,
  dosage              text,
  pharmaceutical_form text,
  presentation        text,
  unit                text default 'comprimido',
  manufacturer        text,
  medicine_type       text default 'outro',
  is_custom           boolean default true,
  search_vector       tsvector,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_custom_user_id on public.custom_medications(user_id);
create index if not exists idx_custom_search  on public.custom_medications using gin(search_vector);

drop trigger if exists custom_search_vector_update on public.custom_medications;
create trigger custom_search_vector_update
  before insert or update on public.custom_medications
  for each row execute procedure public.update_catalog_search_vector();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Catálogo: leitura pública (todos os usuários autenticados)
alter table public.medication_catalog enable row level security;
create policy "catalog_read_all" on public.medication_catalog
  for select using (auth.role() = 'authenticated');

-- Medicamentos personalizados: acesso somente do próprio usuário
alter table public.custom_medications enable row level security;
create policy "custom_own" on public.custom_medications
  for all using (auth.uid() = user_id);

-- ─── Função de pesquisa fulltext + fallback ILIKE ────────────────────────────
create or replace function public.search_medications(query text, result_limit int default 20)
returns table (
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
)
language sql stable security definer as $$
  select
    id, commercial_name, active_ingredient, dosage,
    pharmaceutical_form, presentation, unit, manufacturer,
    medicine_type, is_reference, is_generic, is_similar,
    ts_rank(search_vector, websearch_to_tsquery('portuguese', query)) as score
  from public.medication_catalog
  where
    search_vector @@ websearch_to_tsquery('portuguese', query)
    or commercial_name   ilike '%' || query || '%'
    or active_ingredient ilike '%' || query || '%'
    or manufacturer      ilike '%' || query || '%'
  order by score desc, commercial_name asc
  limit result_limit;
$$;

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create trigger catalog_updated_at before update on public.medication_catalog
  for each row execute procedure public.set_updated_at();

create trigger custom_updated_at before update on public.custom_medications
  for each row execute procedure public.set_updated_at();
