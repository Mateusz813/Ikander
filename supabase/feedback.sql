-- =====================================================================
--  IKANDER — sekcja "Pomysły" (komentarze: co dodać / poprawić)
--  Uruchom w: Supabase Dashboard -> SQL Editor -> New query -> Run
--  Skrypt jest idempotentny (można puścić ponownie bez szkód).
-- =====================================================================

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  done       boolean not null default false,   -- oznaczone jako zrobione
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback(created_at desc);

-- uprawnienia: tylko zalogowani (anon nic)
revoke all on public.feedback from anon;
grant select, insert, update, delete on public.feedback to authenticated;

alter table public.feedback enable row level security;

-- oboje widzą wszystkie wpisy
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated using (true);

-- dodawać można tylko jako swój wpis
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated with check (author_id = auth.uid());

-- oznaczać jako zrobione może każde z dwojga
drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback
  for update to authenticated using (true) with check (true);

-- usuwać można tylko własne wpisy
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback
  for delete to authenticated using (author_id = auth.uid());

-- realtime — nowy wpis pojawia się u drugiej osoby na żywo
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;
end $$;

-- =====================================================================
--  GOTOWE.
-- =====================================================================
