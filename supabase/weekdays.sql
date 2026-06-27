-- =====================================================================
--  IKANDER — harmonogram dni dla akcji (codziennie / wybrane dni tygodnia)
--  Uruchom w: Supabase Dashboard -> SQL Editor -> New query -> Run
--  Idempotentny.
-- =====================================================================

-- 1) kolumna z dniami tygodnia (ISO: 1=pon ... 7=nd); domyślnie codziennie
alter table public.actions
  add column if not exists weekdays int[] not null default '{1,2,3,4,5,6,7}';

-- 2) widok statusu dnia — akcja obowiązuje tylko w wybrane dni tygodnia
create or replace view public.day_status
with (security_invoker = true) as
select
  d.user_id,
  d.date,
  (select count(*) from public.actions a
     where a.user_id = d.user_id
       and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date
       and extract(isodow from d.date)::int = any(a.weekdays)) as applicable,
  (select count(*) from public.action_logs l
     join public.actions a on a.id = l.action_id
     where l.user_id = d.user_id and l.date = d.date
       and l.completed and (a.created_at at time zone 'Europe/Warsaw')::date <= l.date
       and extract(isodow from l.date)::int = any(a.weekdays)) as done,
  (
    (select count(*) from public.actions a
       where a.user_id = d.user_id
         and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date
         and extract(isodow from d.date)::int = any(a.weekdays)) > 0
    and
    (select count(*) from public.action_logs l
       join public.actions a on a.id = l.action_id
       where l.user_id = d.user_id and l.date = d.date
         and l.completed and (a.created_at at time zone 'Europe/Warsaw')::date <= l.date
         and extract(isodow from l.date)::int = any(a.weekdays))
    >=
    (select count(*) from public.actions a
       where a.user_id = d.user_id
         and (a.created_at at time zone 'Europe/Warsaw')::date <= d.date
         and extract(isodow from d.date)::int = any(a.weekdays))
  ) as is_perfect
from (select distinct user_id, date from public.action_logs) d;

-- 3) widok punktów — liczy tylko akcje obowiązujące w danym dniu tygodnia
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
        and extract(isodow from l.date)::int = any(a.weekdays)
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

-- =====================================================================
--  GOTOWE.
-- =====================================================================
