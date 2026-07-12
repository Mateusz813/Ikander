-- =====================================================================
--  IKANDER — nagrody jednorazowe + negocjacja ceny (jak Vinted)
--  Uruchom w SQL Editor. Idempotentny.
-- =====================================================================

-- 1) nowe kolumny na nagrodach
alter table public.rewards add column if not exists consumed_at timestamptz;               -- wykupiona (jednorazowa)
alter table public.rewards add column if not exists nego_price  int;                        -- aktualna propozycja ceny
alter table public.rewards add column if not exists nego_by     uuid references public.profiles(id); -- kto proponuje

-- 2) wykup: nagroda (poza domyślną) staje się jednorazowa
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
  if v_uid is null then raise exception 'Niezalogowany'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then raise exception 'Nagroda nie istnieje'; end if;
  if v_reward.recipient_id <> v_uid then
    raise exception 'Możesz wykupić tylko nagrody przeznaczone dla Ciebie';
  end if;
  if v_reward.consumed_at is not null then
    raise exception 'Ta nagroda została już wykupiona';
  end if;

  select balance into v_balance from public.user_points where user_id = v_uid;
  if coalesce(v_balance, 0) < v_reward.cost then
    raise exception 'Za mało punktów (masz %, potrzeba %)', coalesce(v_balance, 0), v_reward.cost;
  end if;

  insert into public.reward_redemptions (reward_id, recipient_id, cost, status)
  values (v_reward.id, v_uid, v_reward.cost, 'pending')
  returning * into v_row;

  -- jednorazowa: konsumuj (oprócz domyślnej) i zamknij negocjację
  if not v_reward.is_default then
    update public.rewards
      set consumed_at = now(), nego_price = null, nego_by = null
      where id = v_reward.id;
  end if;

  return v_row;
end;
$$;

-- 3) propozycja ceny (start lub kontrpropozycja) — może obie strony
create or replace function public.propose_price(p_reward_id uuid, p_price int)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_reward public.rewards;
  v_row    public.rewards;
begin
  if v_uid is null then raise exception 'Niezalogowany'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Cena musi być dodatnia'; end if;

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then raise exception 'Nagroda nie istnieje'; end if;
  if v_uid <> v_reward.recipient_id and v_uid <> v_reward.created_by then
    raise exception 'Nie możesz negocjować tej nagrody';
  end if;
  if v_reward.is_default then raise exception 'Domyślnej nagrody nie negocjujemy'; end if;
  if v_reward.consumed_at is not null then raise exception 'Nagroda już wykupiona'; end if;

  update public.rewards set nego_price = p_price, nego_by = v_uid
    where id = p_reward_id returning * into v_row;
  return v_row;
end;
$$;

-- 4) odpowiedź na propozycję: akceptuj (ustaw cenę) lub odrzuć (zamknij)
create or replace function public.respond_price(p_reward_id uuid, p_accept boolean)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_reward public.rewards;
  v_row    public.rewards;
begin
  if v_uid is null then raise exception 'Niezalogowany'; end if;

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then raise exception 'Nagroda nie istnieje'; end if;
  if v_uid <> v_reward.recipient_id and v_uid <> v_reward.created_by then
    raise exception 'Nie możesz odpowiadać na tę negocjację';
  end if;
  if v_reward.nego_price is null or v_reward.nego_by is null then
    raise exception 'Brak propozycji do rozpatrzenia';
  end if;
  if v_reward.nego_by = v_uid then
    raise exception 'Nie możesz odpowiedzieć na własną propozycję';
  end if;

  if p_accept then
    update public.rewards set cost = v_reward.nego_price, nego_price = null, nego_by = null
      where id = p_reward_id returning * into v_row;
  else
    update public.rewards set nego_price = null, nego_by = null
      where id = p_reward_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

grant execute on function public.propose_price(uuid, int) to authenticated;
grant execute on function public.respond_price(uuid, boolean) to authenticated;

-- =====================================================================
--  GOTOWE.
-- =====================================================================
