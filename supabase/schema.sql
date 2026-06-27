-- =====================================================================
--  IKANDER — schemat bazy danych (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
--  JAK URUCHOMIĆ:
--    Supabase Dashboard -> SQL Editor -> New query -> wklej CAŁOŚĆ -> Run
--
--  Skrypt jest IDEMPOTENTNY — można go odpalić wielokrotnie bez szkód.
--
--  KONTA (tworzone w bloku 5 albo ręcznie w Dashboard):
--    Mateusz -> e-mail: mateusz@ikander.local  haslo: ika
--    Iwona   -> e-mail: iwona@ikander.local    haslo: mati
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELE
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  partner_id   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  icon       text not null default '✅',
  type       text not null check (type in ('check','quantity')),
  target     numeric,                              -- cel dla typu 'quantity' (np. 2000)
  unit       text,                                 -- jednostka (np. 'ml')
  quick_add  jsonb not null default '[]'::jsonb,   -- przyciski szybkiego dodawania, np. [100,200,500]
  is_default boolean not null default false,       -- domyślna akcja (Woda) — nieusuwalna
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists actions_user_idx on public.actions(user_id);

create table if not exists public.action_logs (
  id           uuid primary key default gen_random_uuid(),
  action_id    uuid not null references public.actions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  date         date not null,
  progress     numeric not null default 0,         -- postęp (dla 'quantity'); dla 'check' 0/1
  completed    boolean not null default false,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (action_id, date)
);
create index if not exists action_logs_user_date_idx on public.action_logs(user_id, date);
create index if not exists action_logs_date_idx on public.action_logs(date);

create table if not exists public.rewards (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade, -- kto WYKUPUJE (wydaje punkty)
  created_by   uuid not null references public.profiles(id) on delete cascade, -- partner, który WYKONUJE
  name         text not null,
  icon         text not null default '🎁',
  cost         int not null check (cost > 0),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists rewards_recipient_idx on public.rewards(recipient_id);

create table if not exists public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  reward_id    uuid not null references public.rewards(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade, -- kto wykupił
  cost         int not null,                       -- koszt w chwili wykupu (snapshot)
  status       text not null default 'pending' check (status in ('pending','fulfilled')),
  redeemed_at  timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id) -- kto oznaczył jako wykonane
);
create index if not exists redemptions_recipient_idx on public.reward_redemptions(recipient_id);
create index if not exists redemptions_status_idx on public.reward_redemptions(status);

-- ---------------------------------------------------------------------
-- 2. WIDOKI (status dnia + punkty)  — security_invoker => respektują RLS
-- ---------------------------------------------------------------------

-- Status każdego "zalogowanego" dnia: ile akcji obowiązuje i ile wykonano.
-- Akcja "obowiązuje" danego dnia jeśli powstała tego dnia lub wcześniej.
create or replace view public.day_status
with (security_invoker = true) as
select
  d.user_id,
  d.date,
  (select count(*) from public.actions a
     where a.user_id = d.user_id and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date) as applicable,
  (select count(*) from public.action_logs l
     join public.actions a on a.id = l.action_id
     where l.user_id = d.user_id and l.date = d.date
       and l.completed and (a.created_at at time zone 'Europe/Warsaw')::date <= l.date) as done,
  (
    (select count(*) from public.actions a
       where a.user_id = d.user_id and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date) > 0
    and
    (select count(*) from public.action_logs l
       join public.actions a on a.id = l.action_id
       where l.user_id = d.user_id and l.date = d.date
         and l.completed and (a.created_at at time zone 'Europe/Warsaw')::date <= l.date)
    >=
    (select count(*) from public.actions a
       where a.user_id = d.user_id and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date)
  ) as is_perfect
from (select distinct user_id, date from public.action_logs) d;

-- Punkty użytkownika: zdobyte (akcje + bonusy za perfekcyjny dzień) minus wydane (nagrody).
create or replace view public.user_points
with (security_invoker = true) as
select
  t.user_id,
  t.earned,
  t.spent,
  (t.earned - t.spent) as balance
from (
  select
    p.id as user_id,
    coalesce((
      select count(*) from public.action_logs l
      join public.actions a on a.id = l.action_id
      where l.user_id = p.id and l.completed
        and (a.created_at at time zone 'Europe/Warsaw')::date <= l.date
    ), 0)
    +
    coalesce((
      select count(*) from public.day_status ds
      where ds.user_id = p.id and ds.is_perfect
    ), 0) as earned,
    coalesce((
      select sum(rr.cost) from public.reward_redemptions rr
      where rr.recipient_id = p.id
    ), 0) as spent
  from public.profiles p
) t;

-- ---------------------------------------------------------------------
-- 3. FUNKCJE (RPC) — wykup i wykonanie nagrody (atomowo, z kontrolą salda)
-- ---------------------------------------------------------------------

create or replace function public.redeem_reward(p_reward_id uuid)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_reward  public.rewards;
  v_balance int;
  v_row     public.reward_redemptions;
begin
  if v_uid is null then
    raise exception 'Niezalogowany';
  end if;

  -- serializacja per użytkownik: czyta saldo i wstawia wykup atomowo
  -- (zapobiega podwójnemu wydaniu punktów przy dwóch szybkich kliknięciach)
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then
    raise exception 'Nagroda nie istnieje';
  end if;

  if v_reward.recipient_id <> v_uid then
    raise exception 'Możesz wykupić tylko nagrody przeznaczone dla Ciebie';
  end if;

  select balance into v_balance from public.user_points where user_id = v_uid;
  if coalesce(v_balance, 0) < v_reward.cost then
    raise exception 'Za mało punktów (masz %, potrzeba %)', coalesce(v_balance, 0), v_reward.cost;
  end if;

  insert into public.reward_redemptions (reward_id, recipient_id, cost, status)
  values (v_reward.id, v_uid, v_reward.cost, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.fulfill_redemption(p_redemption_id uuid)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.reward_redemptions;
begin
  if v_uid is null then
    raise exception 'Niezalogowany';
  end if;

  -- Świadomie: nagrodę może oznaczyć jako wykonaną KAŻDA z dwóch osób
  -- (zarówno wykonawca, jak i ta, która wykupiła — "jakby druga zapomniała").
  update public.reward_redemptions
     set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = v_uid
   where id = p_redemption_id and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'Nagroda już wykonana lub nie istnieje';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. UPRAWNIENIA + RLS (Row Level Security)
-- ---------------------------------------------------------------------

-- anon (klucz publiczny przed logowaniem) nie ma dostępu do danych
revoke all on public.profiles, public.actions, public.action_logs,
              public.rewards, public.reward_redemptions,
              public.day_status, public.user_points from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.actions, public.action_logs,
  public.rewards, public.reward_redemptions to authenticated;
grant select on public.day_status, public.user_points to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.fulfill_redemption(uuid) to authenticated;

alter table public.profiles           enable row level security;
alter table public.actions            enable row level security;
alter table public.action_logs        enable row level security;
alter table public.rewards            enable row level security;
alter table public.reward_redemptions enable row level security;

-- profiles: oboje widzą oba profile; każdy edytuje tylko swój
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- actions: oboje widzą wszystkie; każdy zarządza tylko swoimi
drop policy if exists actions_select on public.actions;
create policy actions_select on public.actions
  for select to authenticated using (true);
drop policy if exists actions_insert on public.actions;
create policy actions_insert on public.actions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists actions_update on public.actions;
create policy actions_update on public.actions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists actions_delete on public.actions;
create policy actions_delete on public.actions
  for delete to authenticated using (user_id = auth.uid() and is_default = false);

-- action_logs: oboje widzą wszystkie; każdy zapisuje tylko swoje (i tylko swoich akcji)
drop policy if exists logs_select on public.action_logs;
create policy logs_select on public.action_logs
  for select to authenticated using (true);
drop policy if exists logs_insert on public.action_logs;
create policy logs_insert on public.action_logs
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.actions a where a.id = action_id and a.user_id = auth.uid())
  );
drop policy if exists logs_update on public.action_logs;
create policy logs_update on public.action_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists logs_delete on public.action_logs;
create policy logs_delete on public.action_logs
  for delete to authenticated using (user_id = auth.uid());

-- rewards: oboje widzą wszystkie; nagrody tworzy się DLA PARTNERA
drop policy if exists rewards_select on public.rewards;
create policy rewards_select on public.rewards
  for select to authenticated using (true);
drop policy if exists rewards_insert on public.rewards;
create policy rewards_insert on public.rewards
  for insert to authenticated with check (created_by = auth.uid() and recipient_id <> auth.uid());
drop policy if exists rewards_update on public.rewards;
create policy rewards_update on public.rewards
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists rewards_delete on public.rewards;
create policy rewards_delete on public.rewards
  for delete to authenticated using (created_by = auth.uid() and is_default = false);

-- reward_redemptions: oboje widzą wszystkie; zapis tylko przez funkcje RPC
drop policy if exists redemptions_select on public.reward_redemptions;
create policy redemptions_select on public.reward_redemptions
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 5. UTWORZENIE KONT (Mateusz + Iwona)  — OPCJONALNE
-- ---------------------------------------------------------------------
-- Jeśli wolisz, utwórz konta ręcznie:
--   Dashboard -> Authentication -> Users -> Add user  (zaznacz "Auto Confirm User")
--   e-mail: mateusz@ikander.local  haslo: ika
--   e-mail: iwona@ikander.local    haslo: mati
-- i pomiń ten blok (DO $$ ... $$). Reszta skryptu zaseeduje się sama.
do $$
declare
  rec record;
  v_id uuid;
begin
  for rec in
    select * from (values
      ('mateusz@ikander.local', 'ika',  'Mateusz'),
      ('iwona@ikander.local',   'mati', 'Iwona')
    ) as t(email, pass, display)
  loop
    -- utwórz konto jeśli nie istnieje (wszystkie kolumny tokenów = '' dla zgodności z GoTrue)
    select id into v_id from auth.users where email = rec.email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        rec.email, crypt(rec.pass, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', rec.display),
        '', '', '', '', '', '', '', ''
      );
    end if;

    -- utwórz tożsamość niezależnie (samonaprawa, gdyby zabrakło z wcześniejszego uruchomienia)
    if not exists (select 1 from auth.identities where user_id = v_id and provider = 'email') then
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. PROFILE, PARTNERZY, DOMYŚLNE AKCJE I NAGRODY
-- ---------------------------------------------------------------------
do $$
declare
  v_mat uuid;
  v_iwo uuid;
begin
  select id into v_mat from auth.users where email = 'mateusz@ikander.local';
  select id into v_iwo from auth.users where email = 'iwona@ikander.local';

  if v_mat is null or v_iwo is null then
    raise exception 'Brak kont użytkowników. Utwórz je (blok 5 powyżej lub w Dashboard) i uruchom skrypt ponownie.';
  end if;

  -- profile
  insert into public.profiles (id, display_name) values (v_mat, 'Mateusz')
    on conflict (id) do update set display_name = excluded.display_name;
  insert into public.profiles (id, display_name) values (v_iwo, 'Iwona')
    on conflict (id) do update set display_name = excluded.display_name;

  -- partnerzy (wzajemnie)
  update public.profiles set partner_id = v_iwo where id = v_mat;
  update public.profiles set partner_id = v_mat where id = v_iwo;

  -- domyślna akcja: Woda 2000 ml dla obojga
  insert into public.actions (user_id, name, icon, type, target, unit, quick_add, is_default, sort_order)
  select v_mat, 'Woda', '💧', 'quantity', 2000, 'ml', '[100,200,500]'::jsonb, true, 0
  where not exists (select 1 from public.actions where user_id = v_mat and is_default);

  insert into public.actions (user_id, name, icon, type, target, unit, quick_add, is_default, sort_order)
  select v_iwo, 'Woda', '💧', 'quantity', 2000, 'ml', '[100,200,500]'::jsonb, true, 0
  where not exists (select 1 from public.actions where user_id = v_iwo and is_default);

  -- domyślna nagroda: Buziaczek w policzek (5 pkt) — recipient wykupuje, partner wykonuje
  insert into public.rewards (recipient_id, created_by, name, icon, cost, is_default)
  select v_mat, v_iwo, 'Buziaczek w policzek', '😘', 5, true
  where not exists (select 1 from public.rewards where recipient_id = v_mat and is_default);

  insert into public.rewards (recipient_id, created_by, name, icon, cost, is_default)
  select v_iwo, v_mat, 'Buziaczek w policzek', '😘', 5, true
  where not exists (select 1 from public.rewards where recipient_id = v_iwo and is_default);
end $$;

-- ---------------------------------------------------------------------
-- 7. REALTIME — zmiany jednej osoby odświeżają się na żywo u drugiej
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['actions', 'action_logs', 'rewards', 'reward_redemptions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =====================================================================
--  GOTOWE. Sprawdź:  select * from public.profiles;
-- =====================================================================
