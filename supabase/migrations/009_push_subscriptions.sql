-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 009: Web Push (VAPID) subscriptions
--  Substitui o antigo fcm_tokens (API legada do FCM, desligada pelo
--  Google em 22/07/2024) por Web Push padrão (RFC 8291/8292).
--  Run this in the Supabase SQL Editor after 008c.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Um usuário pode ter várias subscriptions (celular + tablet, por ex.)
create index if not exists idx_push_subs_user_id on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_own" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- Reaproveita a função set_updated_at() criada na migration 001
create trigger push_subs_updated_at before update on public.push_subscriptions
  for each row execute procedure public.set_updated_at();

-- ─── Nota ──────────────────────────────────────────────────────────────────
-- A tabela public.fcm_tokens (migration 001) fica preservada por enquanto,
-- mas deixa de ser usada a partir desta migration. Depois de confirmar que
-- o Web Push está estável em produção por algumas semanas, ela pode ser
-- removida com:
--
--   drop table if exists public.fcm_tokens;
