-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Migration 005: Sistema de Cuidado Compartilhado
--  Execute no SQL Editor do Supabase após 004_medication_catalog.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── Extensão para geração de tokens ─────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Relacionamentos paciente ↔ cuidador ──────────────────────────────────────
create table if not exists public.caregiver_relationships (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references auth.users(id) on delete cascade,
  caregiver_id     uuid references auth.users(id) on delete set null,
  permission_level text not null default 'viewer'
                   check (permission_level in ('viewer','caregiver','admin')),
  status           text not null default 'pending'
                   check (status in ('pending','active','declined','revoked')),
  -- Convite
  invite_token     text unique default encode(gen_random_bytes(24), 'hex'),
  invite_email     text,
  invite_expires_at timestamptz default (now() + interval '7 days'),
  -- Labels
  relationship_label text,              -- ex: "Mãe", "Companheiro", "Filho"
  -- Timestamps
  created_at       timestamptz default now(),
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  updated_at       timestamptz default now(),
  -- Garante unicidade: um usuário pode ser cuidador de um paciente apenas uma vez (ativo)
  unique (patient_id, caregiver_id)
);

create index if not exists idx_cr_patient_id   on public.caregiver_relationships(patient_id);
create index if not exists idx_cr_caregiver_id on public.caregiver_relationships(caregiver_id);
create index if not exists idx_cr_invite_token on public.caregiver_relationships(invite_token);
create index if not exists idx_cr_status       on public.caregiver_relationships(status);

-- ─── Anotações do cuidador (separadas das notas pessoais do paciente) ──────────
create table if not exists public.caregiver_notes (
  id              uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.caregiver_relationships(id) on delete cascade,
  patient_id      uuid not null references auth.users(id) on delete cascade,
  caregiver_id    uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  -- Metadados opcionais (pressão, temperatura etc.)
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_cn_patient_id    on public.caregiver_notes(patient_id);
create index if not exists idx_cn_caregiver_id  on public.caregiver_notes(caregiver_id);
create index if not exists idx_cn_relationship  on public.caregiver_notes(relationship_id);
create index if not exists idx_cn_created       on public.caregiver_notes(created_at desc);

-- ─── Log de auditoria ─────────────────────────────────────────────────────────
create table if not exists public.caregiver_audit_log (
  id              uuid primary key default gen_random_uuid(),
  relationship_id uuid references public.caregiver_relationships(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  action          text not null,
  details         jsonb default '{}',
  created_at      timestamptz default now()
);

create index if not exists idx_cal_relationship on public.caregiver_audit_log(relationship_id);
create index if not exists idx_cal_actor        on public.caregiver_audit_log(actor_id);

-- ─── Updated_at triggers ──────────────────────────────────────────────────────
create trigger cr_updated_at before update on public.caregiver_relationships
  for each row execute procedure public.set_updated_at();

create trigger cn_updated_at before update on public.caregiver_notes
  for each row execute procedure public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.caregiver_relationships enable row level security;
alter table public.caregiver_notes         enable row level security;
alter table public.caregiver_audit_log     enable row level security;

-- caregiver_relationships
-- Paciente: vê e gerencia todos os seus relacionamentos
create policy "cr_patient_all" on public.caregiver_relationships
  for all using (auth.uid() = patient_id);

-- Cuidador: vê os relacionamentos onde é o cuidador
create policy "cr_caregiver_select" on public.caregiver_relationships
  for select using (auth.uid() = caregiver_id);

-- Cuidador: pode atualizar status (aceitar/recusar) somente no próprio relacionamento
create policy "cr_caregiver_update" on public.caregiver_relationships
  for update using (auth.uid() = caregiver_id)
  with check (auth.uid() = caregiver_id);

-- Leitura pública do convite por token (para tela de aceite, sem login prévio)
create policy "cr_invite_token_select" on public.caregiver_relationships
  for select using (
    invite_token is not null
    and status = 'pending'
    and invite_expires_at > now()
  );

-- caregiver_notes
-- Cuidador: pode criar e ver suas próprias notas
create policy "cn_caregiver_all" on public.caregiver_notes
  for all using (auth.uid() = caregiver_id);

-- Paciente: pode ver notas sobre si mesmo (somente leitura)
create policy "cn_patient_select" on public.caregiver_notes
  for select using (auth.uid() = patient_id);

-- caregiver_audit_log: somente leitura para envolvidos
create policy "cal_read" on public.caregiver_audit_log
  for select using (
    actor_id = auth.uid()
    or relationship_id in (
      select id from public.caregiver_relationships
      where patient_id = auth.uid() or caregiver_id = auth.uid()
    )
  );

-- ─── Helpers RLS: verificar permissão do cuidador ────────────────────────────
create or replace function public.caregiver_has_permission(
  p_patient_id uuid,
  p_permission text
) returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.caregiver_relationships
    where patient_id    = p_patient_id
      and caregiver_id  = auth.uid()
      and status        = 'active'
      and (
        permission_level = p_permission
        or permission_level = 'admin'
        or (p_permission = 'viewer' and permission_level in ('viewer','caregiver','admin'))
        or (p_permission = 'caregiver' and permission_level in ('caregiver','admin'))
      )
  );
$$;

-- ─── Policies de leitura por cuidadores em tabelas existentes ─────────────────
-- Medicamentos: cuidadores ativos podem visualizar
drop policy if exists "meds_caregiver" on public.medicamentos;
create policy "meds_caregiver" on public.medicamentos
  for select using (
    user_id in (
      select patient_id from public.caregiver_relationships
      where caregiver_id = auth.uid() and status = 'active'
    )
  );

-- Histórico: cuidadores ativos podem visualizar
drop policy if exists "hist_caregiver" on public.historico_doses;
create policy "hist_caregiver" on public.historico_doses
  for select using (
    user_id in (
      select patient_id from public.caregiver_relationships
      where caregiver_id = auth.uid() and status = 'active'
    )
  );

-- Cuidadores com permissão 'caregiver' ou 'admin' podem confirmar doses
create policy "hist_caregiver_insert" on public.historico_doses
  for insert with check (
    public.caregiver_has_permission(user_id, 'caregiver')
  );

-- Perfis: cuidadores podem ver perfil do paciente
drop policy if exists "profiles_caregiver" on public.profiles;
create policy "profiles_caregiver" on public.profiles
  for select using (
    id in (
      select patient_id from public.caregiver_relationships
      where caregiver_id = auth.uid() and status = 'active'
    )
  );

-- ─── Função: aceitar convite por token ───────────────────────────────────────
create or replace function public.accept_caregiver_invite(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_rel public.caregiver_relationships;
begin
  -- Busca o convite
  select * into v_rel
  from public.caregiver_relationships
  where invite_token = p_token
    and status = 'pending'
    and invite_expires_at > now();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado.');
  end if;

  -- Impede auto-aceite (paciente não pode ser seu próprio cuidador)
  if v_rel.patient_id = auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Você não pode ser seu próprio cuidador.');
  end if;

  -- Atualiza o relacionamento
  update public.caregiver_relationships
  set
    caregiver_id = auth.uid(),
    status       = 'active',
    accepted_at  = now(),
    invite_token = null -- invalida o token após aceite
  where id = v_rel.id;

  -- Registra auditoria
  insert into public.caregiver_audit_log (relationship_id, actor_id, action, details)
  values (
    v_rel.id,
    auth.uid(),
    'invite_accepted',
    jsonb_build_object('patient_id', v_rel.patient_id, 'permission_level', v_rel.permission_level)
  );

  return jsonb_build_object('success', true, 'relationship_id', v_rel.id, 'patient_id', v_rel.patient_id);
end;
$$;

-- ─── Função: revogar acesso de cuidador ───────────────────────────────────────
create or replace function public.revoke_caregiver(p_relationship_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_rel public.caregiver_relationships;
begin
  select * into v_rel
  from public.caregiver_relationships
  where id = p_relationship_id and patient_id = auth.uid();

  if not found then return false; end if;

  update public.caregiver_relationships
  set status = 'revoked', revoked_at = now()
  where id = p_relationship_id;

  insert into public.caregiver_audit_log (relationship_id, actor_id, action)
  values (p_relationship_id, auth.uid(), 'caregiver_revoked');

  return true;
end;
$$;

-- ─── Função: buscar dados do paciente (usada pelo dashboard do cuidador) ───────
create or replace function public.get_patient_summary(p_patient_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_active boolean;
  v_profile record;
  v_meds_count integer;
  v_today_confirmed integer;
  v_today_total integer;
  v_month_adhesion numeric;
  v_last_dose record;
begin
  -- Verifica acesso
  select exists(
    select 1 from public.caregiver_relationships
    where patient_id = p_patient_id
      and caregiver_id = auth.uid()
      and status = 'active'
  ) into v_active;

  if not v_active then
    raise exception 'Acesso negado';
  end if;

  -- Dados do perfil
  select nome, email into v_profile from public.profiles where id = p_patient_id;

  -- Medicamentos ativos
  select count(*) into v_meds_count
  from public.medicamentos
  where user_id = p_patient_id and ativo = true;

  -- Adesão do mês (últimos 30 dias)
  select
    round(
      sum(case when status = 'confirmed' then 1 else 0 end)::numeric
      / nullif(count(*), 0) * 100, 1
    ) into v_month_adhesion
  from public.historico_doses
  where user_id = p_patient_id
    and created_at >= now() - interval '30 days';

  -- Última dose confirmada
  select hora, created_at into v_last_dose
  from public.historico_doses
  where user_id = p_patient_id and status = 'confirmed'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'profile',         jsonb_build_object('nome', v_profile.nome, 'email', v_profile.email),
    'meds_count',      v_meds_count,
    'month_adhesion',  coalesce(v_month_adhesion, 0),
    'last_dose',       case when v_last_dose.hora is not null
                         then jsonb_build_object('hora', v_last_dose.hora, 'at', v_last_dose.created_at)
                         else null end
  );
end;
$$;
