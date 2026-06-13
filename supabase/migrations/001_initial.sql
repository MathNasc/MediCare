-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Supabase Migration
--  Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text,
  foto_url    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Medicamentos ─────────────────────────────────────────────────────────────
create table if not exists public.medicamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  dosagem      text,
  quantidade   int  default 30 check (quantidade >= 0),
  unidade      text default 'comprimido',
  cor          text default '#3b82f6',
  observacoes  text,
  foto_url     text,
  horarios     text[] default '{"08:00"}',
  dias_semana  int[] default '{1,2,3,4,5,6,7}',
  ativo        boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_medicamentos_user_id on public.medicamentos(user_id);

-- ─── Historico Doses ─────────────────────────────────────────────────────────
create table if not exists public.historico_doses (
  id                  uuid primary key default gen_random_uuid(),
  med_id              uuid references public.medicamentos(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  hora                text not null,
  status              text not null default 'confirmed'
                      check (status in ('confirmed','missed','pending','late')),
  atraso_minutos      int  default 0,
  created_at          timestamptz default now()
);

create index if not exists idx_historico_user_id   on public.historico_doses(user_id);
create index if not exists idx_historico_med_id    on public.historico_doses(med_id);
create index if not exists idx_historico_created   on public.historico_doses(created_at desc);

-- ─── Cuidadores ──────────────────────────────────────────────────────────────
create table if not exists public.cuidadores (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references auth.users(id) on delete cascade,
  cuidador_id  uuid not null references auth.users(id) on delete cascade,
  nivel_acesso text default 'leitura' check (nivel_acesso in ('leitura','total')),
  status       text default 'pendente' check (status in ('pendente','ativo','recusado')),
  created_at   timestamptz default now(),
  unique (paciente_id, cuidador_id)
);

-- ─── Documentos ──────────────────────────────────────────────────────────────
create table if not exists public.documentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text default 'receita' check (tipo in ('receita','exame','laudo','outro')),
  nome        text,
  arquivo_url text,
  descricao   text,
  created_at  timestamptz default now()
);

-- ─── FCM Tokens ──────────────────────────────────────────────────────────────
create table if not exists public.fcm_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  updated_at timestamptz default now()
);

-- ─── Notificações ────────────────────────────────────────────────────────────
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text check (tipo in ('lembrete','atraso','critico','estoque','cuidador')),
  titulo      text,
  mensagem    text,
  lida        boolean default false,
  created_at  timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.medicamentos   enable row level security;
alter table public.historico_doses enable row level security;
alter table public.cuidadores     enable row level security;
alter table public.documentos     enable row level security;
alter table public.fcm_tokens     enable row level security;
alter table public.notificacoes   enable row level security;

-- Profiles: own + caregivers can read
create policy "profiles_own"    on public.profiles for all    using (auth.uid() = id);
create policy "profiles_caregiver" on public.profiles for select using (
  id in (select paciente_id from public.cuidadores where cuidador_id = auth.uid() and status = 'ativo')
);

-- Medicamentos: own + caregiver read
create policy "meds_own"         on public.medicamentos for all    using (auth.uid() = user_id);
create policy "meds_caregiver"   on public.medicamentos for select using (
  user_id in (select paciente_id from public.cuidadores where cuidador_id = auth.uid() and status = 'ativo')
);

-- History: own + caregiver read
create policy "hist_own"         on public.historico_doses for all    using (auth.uid() = user_id);
create policy "hist_caregiver"   on public.historico_doses for select using (
  user_id in (select paciente_id from public.cuidadores where cuidador_id = auth.uid() and status = 'ativo')
);

-- Cuidadores
create policy "cuida_patient"    on public.cuidadores for all    using (auth.uid() = paciente_id);
create policy "cuida_caregiver"  on public.cuidadores for select using (auth.uid() = cuidador_id);
create policy "cuida_accept"     on public.cuidadores for update using (auth.uid() = cuidador_id);

-- Documents: own only
create policy "docs_own"         on public.documentos for all using (auth.uid() = user_id);

-- FCM: own only
create policy "fcm_own"          on public.fcm_tokens for all using (auth.uid() = user_id);

-- Notificações: own only
create policy "notif_own"        on public.notificacoes for all using (auth.uid() = user_id);

-- ─── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "docs_storage_own" on storage.objects for all
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger meds_updated_at before update on public.medicamentos
  for each row execute procedure public.set_updated_at();

-- ─── Adhesion rate view ───────────────────────────────────────────────────────
create or replace view public.adhesion_stats as
select
  user_id,
  count(*) as total_doses,
  sum(case when status = 'confirmed' then 1 else 0 end) as confirmed_doses,
  round(
    sum(case when status = 'confirmed' then 1 else 0 end)::numeric / nullif(count(*),0) * 100, 1
  ) as adhesion_rate,
  avg(atraso_minutos) filter (where status = 'confirmed') as avg_delay_minutes
from public.historico_doses
group by user_id;
