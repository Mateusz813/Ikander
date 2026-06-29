-- =====================================================================
--  IKANDER — buziaczki 💋  (wyślij buziaczka -> druga osoba widzi w apce)
--  Uruchom w SQL Editor. Idempotentny.
-- =====================================================================

create table if not exists public.kisses (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  seen_at      timestamptz
);
create index if not exists kisses_recipient_idx on public.kisses(recipient_id, seen_at);

revoke all on public.kisses from anon;
grant select, insert, update on public.kisses to authenticated;

alter table public.kisses enable row level security;

-- widzisz buziaczki swoje (wysłane i otrzymane)
drop policy if exists kisses_select on public.kisses;
create policy kisses_select on public.kisses
  for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

-- wysyłasz tylko jako siebie, do drugiej osoby
drop policy if exists kisses_insert on public.kisses;
create policy kisses_insert on public.kisses
  for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id <> auth.uid());

-- oznaczyć jako zobaczony może odbiorca
drop policy if exists kisses_update on public.kisses;
create policy kisses_update on public.kisses
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- realtime — buziaczek pojawia się u odbiorcy na żywo
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kisses'
  ) then
    alter publication supabase_realtime add table public.kisses;
  end if;
end $$;

-- =====================================================================
--  GOTOWE.
-- =====================================================================
