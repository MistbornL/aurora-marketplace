-- People choose how they appear publicly (as an artist, and next to their bids):
--   username  → "nino"            (default; real name stays private)
--   full_name → "Nino Beridze"
--   both      → "Nino Beridze (nino)"
-- profiles.display_name becomes the computed public name. It used to be filled
-- with the real name at sign-up and was publicly readable — now it's derived
-- from the person's choice and can't be written directly.

alter table public.profiles add column if not exists name_display text not null default 'username';
do $$ begin
  alter table public.profiles add constraint profiles_name_display_check
    check (name_display in ('username', 'full_name', 'both'));
exception when duplicate_object then null; end $$;

grant select (name_display) on table public.profiles to anon, authenticated;
grant update (name_display) on table public.profiles to authenticated;
revoke insert (display_name), update (display_name) on table public.profiles from authenticated;

create or replace function private.public_name(uid uuid, mode text, uname text)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when mode in ('full_name', 'both') and nullif(trim(concat(pp.first_name, ' ', pp.last_name)), '') is not null then
      case
        when mode = 'both' and coalesce(uname, '') <> ''
          then trim(concat(pp.first_name, ' ', pp.last_name)) || ' (' || uname || ')'
        else trim(concat(pp.first_name, ' ', pp.last_name))
      end
    else coalesce(nullif(uname, ''), 'Collector')
  end
  from (select 1) one
  left join public.profile_private pp on pp.id = uid;
$$;
revoke execute on function private.public_name(uuid, text, text) from public, anon, authenticated;

create or replace function private.profiles_set_public_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.display_name := private.public_name(new.id, new.name_display, new.username);
  return new;
end;
$$;

drop trigger if exists profiles_public_name on public.profiles;
create trigger profiles_public_name
  before insert or update of username, name_display, display_name on public.profiles
  for each row execute function private.profiles_set_public_name();

-- Changing first / last name refreshes the public name.
create or replace function private.profile_private_sync_public_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set display_name = null where id = new.id; -- recomputed by the trigger above
  return new;
end;
$$;

drop trigger if exists profile_private_public_name on public.profile_private;
create trigger profile_private_public_name
  after insert or update of first_name, last_name on public.profile_private
  for each row execute function private.profile_private_sync_public_name();

-- Backfill (removes real names that were exposed before).
update public.profiles set display_name = null;

-- Bid history shows the chosen public name.
create or replace function public.auction_bid_history(p_auction_id uuid)
returns table (bid_id uuid, bidder text, avatar_url text, amount numeric, created_at timestamptz, is_you boolean)
language sql stable security definer set search_path = '' as $$
  select b.id,
         coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'Collector'),
         p.avatar_url,
         b.amount,
         b.created_at,
         b.bidder_id = auth.uid()
    from public.bids b
    join public.auctions a on a.id = b.auction_id
    left join public.profiles p on p.id = b.bidder_id
   where b.auction_id = p_auction_id
     and (a.status <> 'draft' or a.seller_id = auth.uid())
   order by b.created_at desc
   limit 50;
$$;
