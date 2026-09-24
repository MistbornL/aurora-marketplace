-- Progressive profile: ask for details only when they're needed.
--  * Sign-up: first/last name (+ email/password, account type).
--  * Before bidding: phone number (so the winner can be contacted).
--  * Before publishing an auction: location + short bio.
-- Real names and phone numbers are private (owner-only), never on public pages.

-- ── Private profile table ────────────────────────────────────────────────────
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 32),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;
revoke all on table public.profile_private from anon, authenticated;
grant select, insert, update on table public.profile_private to authenticated;

drop policy if exists "owners read their private profile" on public.profile_private;
drop policy if exists "owners create their private profile" on public.profile_private;
drop policy if exists "owners update their private profile" on public.profile_private;
create policy "owners read their private profile" on public.profile_private for select to authenticated
  using (id = (select auth.uid()));
create policy "owners create their private profile" on public.profile_private for insert to authenticated
  with check (id = (select auth.uid()));
create policy "owners update their private profile" on public.profile_private for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Existing users get an empty private row.
insert into public.profile_private (id)
select id from public.profiles
on conflict (id) do nothing;

-- ── Sign-up trigger: names + unique username ─────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
begin
  base := lower(regexp_replace(
    coalesce(
      nullif(meta ->> 'username', ''),
      nullif(trim(concat(meta ->> 'first_name', ' ', left(meta ->> 'last_name', 1))), ''),
      split_part(new.email, '@', 1)
    ),
    '[^a-zA-Z0-9_.]+', '', 'g'));
  if char_length(base) < 3 then base := 'collector'; end if;
  candidate := left(base, 24);
  -- Usernames are unique: add digits until free (sign-up must never fail on this).
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    candidate := left(base, 20) || (floor(random() * 9000) + 1000)::int;
  end loop;

  insert into public.profiles (id, display_name, username, role)
  values (
    new.id,
    coalesce(nullif(trim(concat(meta ->> 'first_name', ' ', meta ->> 'last_name')), ''), candidate),
    candidate,
    case when meta ->> 'role' = 'artist' then 'artist'::public.user_role else 'collector'::public.user_role end
  );
  insert into public.profile_private (id, first_name, last_name)
  values (new.id, left(coalesce(meta ->> 'first_name', ''), 80), left(coalesce(meta ->> 'last_name', ''), 80));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── Readiness checks (used by the DB rules and exposed to the app) ───────────
create or replace function private.missing_for_bidding(uid uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when coalesce(pp.first_name, '') = '' or coalesce(pp.last_name, '') = '' then 'name' end,
    case when char_length(regexp_replace(coalesce(pp.phone, ''), '[^0-9]', '', 'g')) < 7 then 'phone' end
  ], null)
  from (select 1) one
  left join public.profile_private pp on pp.id = uid;
$$;

create or replace function private.missing_for_selling(uid uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when coalesce(p.location, '') = '' then 'location' end,
    case when char_length(coalesce(p.bio, '')) < 30 then 'bio' end
  ], null)
  from (select 1) one
  left join public.profiles p on p.id = uid;
$$;
revoke execute on function private.missing_for_bidding(uuid), private.missing_for_selling(uuid) from public, anon;
grant execute on function private.missing_for_bidding(uuid), private.missing_for_selling(uuid) to authenticated;

-- ── Enforce: bids need a complete bidder profile ─────────────────────────────
create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns public.auctions
language plpgsql
security definer
set search_path = ''
as $$
declare
  auction_row public.auctions;
  bidder uuid := auth.uid();
  minimum numeric;
begin
  if bidder is null then
    raise exception 'Sign in to place a bid';
  end if;
  if cardinality(private.missing_for_bidding(bidder)) > 0 then
    raise exception 'Complete your bidder profile (name and phone) to place bids';
  end if;

  select * into auction_row from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if auction_row.status <> 'live' or auction_row.ends_at <= now() then
    raise exception 'This auction is not accepting bids';
  end if;
  if auction_row.seller_id = bidder then
    raise exception 'You can''t bid on your own auction';
  end if;
  if auction_row.highest_bidder_id = bidder then
    raise exception 'You''re already the highest bidder';
  end if;

  minimum := case when auction_row.highest_bidder_id is null
                  then auction_row.current_bid
                  else auction_row.current_bid + auction_row.bid_increment end;
  if p_amount < minimum then
    raise exception 'Bid must be at least %₾', trim_scale(minimum);
  end if;
  if mod(p_amount - auction_row.current_bid, auction_row.bid_increment) <> 0 then
    raise exception 'Bids must increase in %₾ steps', trim_scale(auction_row.bid_increment);
  end if;

  insert into public.bids (auction_id, bidder_id, amount)
  values (p_auction_id, bidder, p_amount);

  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions
     set current_bid = p_amount,
         highest_bidder_id = bidder,
         bid_count = bid_count + 1,
         updated_at = now()
   where id = p_auction_id
  returning * into auction_row;
  perform set_config('aurora.placing_bid', 'off', true);
  return auction_row;
end;
$$;
revoke execute on function public.place_bid(uuid, numeric) from public, anon;
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- ── Enforce: publishing (going live) needs a complete artist profile ─────────
create or replace function public.guard_auction_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'live'
     and (tg_op = 'INSERT' or old.status is distinct from 'live')
     and cardinality(private.missing_for_selling(new.seller_id)) > 0 then
    raise exception 'Add your location and a short bio (30+ characters) before publishing';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_auction_publish on public.auctions;
create trigger guard_auction_publish
  before insert or update of status on public.auctions
  for each row execute function public.guard_auction_publish();

-- ── One call for the app: what's still missing? ──────────────────────────────
create or replace function public.account_readiness()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'bid', to_jsonb(private.missing_for_bidding(auth.uid())),
    'sell', to_jsonb(private.missing_for_selling(auth.uid()))
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.account_readiness() from public, anon;
grant execute on function public.account_readiness() to authenticated;
