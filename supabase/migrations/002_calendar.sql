-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 002: Calendar & Notes
--  Run this in the Supabase SQL Editor after 001_initial.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Anotações do dia ────────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  date        date not null,
  time        time,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_notes_user_date on public.notes(user_id, date);

-- ─── Eventos de saúde ────────────────────────────────────────────────────────
create table if not exists public.health_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('consulta','exame','procedimento','outro')),
  title       text not null,
  description text,
  date        date not null,
  time        time,
  location    text,
  doctor      text,
  completed   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_events_user_date on public.health_events(user_id, date);

-- ─── Observações de dose (anotação por dose confirmada) ──────────────────────
create table if not exists public.dose_observations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  hist_id     uuid references public.historico_doses(id) on delete cascade,
  med_id      uuid references public.medicamentos(id) on delete cascade,
  date        date not null,
  hora        text not null,
  observation text not null,
  created_at  timestamptz default now()
);

create index if not exists idx_obs_user_date on public.dose_observations(user_id, date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.notes              enable row level security;
alter table public.health_events      enable row level security;
alter table public.dose_observations  enable row level security;

create policy "notes_own"   on public.notes              for all using (auth.uid() = user_id);
create policy "events_own"  on public.health_events      for all using (auth.uid() = user_id);
create policy "obs_own"     on public.dose_observations  for all using (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create trigger notes_updated_at before update on public.notes
  for each row execute procedure public.set_updated_at();

create trigger events_updated_at before update on public.health_events
  for each row execute procedure public.set_updated_at();
