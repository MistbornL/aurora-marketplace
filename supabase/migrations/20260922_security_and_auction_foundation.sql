-- Security hardening for existing profile data.
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

drop policy if exists "users can create their own profile" on public.profiles;
create policy "users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The auth trigger invokes this function; it is not an API endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create type public.auction_status as enum ('draft', 'scheduled', 'live', 'ended', 'cancelled');

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  image_url text not null,
  category text not null default '',
  medium text not null default '',
  dimensions text not null default '',
  year smallint check (year between 1000 and 9999),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null unique references public.artworks(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  status public.auction_status not null default 'draft',
  opening_bid numeric(12,2) not null check (opening_bid > 0),
  current_bid numeric(12,2) not null check (current_bid >= opening_bid),
  bid_increment numeric(12,2) not null check (bid_increment > 0),
  highest_bidder_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > coalesce(starts_at, created_at))
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index auctions_status_ends_at_idx on public.auctions (status, ends_at);
create index auctions_seller_id_idx on public.auctions (seller_id);
create index bids_auction_id_amount_idx on public.bids (auction_id, amount desc);
create index bids_bidder_id_idx on public.bids (bidder_id);

alter table public.artworks enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;

revoke all on table public.artworks, public.auctions, public.bids from anon;
grant select on table public.artworks, public.auctions to anon, authenticated;
grant insert, update, delete on table public.artworks, public.auctions to authenticated;
grant select on table public.bids to authenticated;

create policy "published artworks are publicly readable" on public.artworks for select using (true);
create policy "artists manage their own artworks" on public.artworks for all to authenticated
  using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id);

create policy "auctions are publicly readable" on public.auctions for select using (true);
create policy "sellers manage their own auctions" on public.auctions for all to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy "participants can read auction bids" on public.bids for select to authenticated
  using ((select auth.uid()) = bidder_id or (select auth.uid()) = (select seller_id from public.auctions where id = auction_id));

create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns public.auctions
language plpgsql
security definer
set search_path = ''
as $$
declare
  auction_row public.auctions;
  bidder uuid := auth.uid();
begin
  if bidder is null then
    raise exception 'Authentication required';
  end if;

  select * into auction_row from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if auction_row.status <> 'live' or auction_row.ends_at <= now() then raise exception 'Auction is not accepting bids'; end if;
  if auction_row.seller_id = bidder then raise exception 'Sellers cannot bid on their own auctions'; end if;
  if p_amount < auction_row.current_bid + auction_row.bid_increment then raise exception 'Bid is below the minimum increment'; end if;
  if mod(p_amount - auction_row.current_bid, auction_row.bid_increment) <> 0 then raise exception 'Bid does not match the required increment'; end if;

  insert into public.bids (auction_id, bidder_id, amount) values (p_auction_id, bidder, p_amount);
  update public.auctions set current_bid = p_amount, highest_bidder_id = bidder, updated_at = now() where id = p_auction_id returning * into auction_row;
  return auction_row;
end;
$$;

revoke execute on function public.place_bid(uuid, numeric) from public, anon;
grant execute on function public.place_bid(uuid, numeric) to authenticated;
