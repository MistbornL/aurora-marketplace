-- Live auctions in Supabase: bid counts, public bid history, safe studio writes.
-- Run after 20260923_account_roles.sql. Safe to re-run.

-- ── Bid counter (public; the bids table itself is private) ───────────────────
alter table public.auctions
  add column if not exists bid_count integer not null default 0 check (bid_count >= 0);

-- Backfill (the guard trigger below only lets place_bid change bid_count,
-- so flag this transaction the same way on re-runs).
do $$
begin
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions a
     set bid_count = (select count(*) from public.bids b where b.auction_id = a.id)
   where bid_count = 0;
  perform set_config('aurora.placing_bid', 'off', true);
end $$;

create index if not exists bids_auction_id_created_at_idx
  on public.bids (auction_id, created_at desc);

-- ── Server-controlled auction fields ─────────────────────────────────────────
-- Sellers never set current price / leader / bid count themselves, and can't
-- change pricing once bidding has started.
create or replace function public.guard_auction_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.current_bid := new.opening_bid;
    new.highest_bidder_id := null;
    new.bid_count := 0;
    if not exists (
      select 1 from public.artworks
       where id = new.artwork_id and artist_id = new.seller_id
    ) then
      raise exception 'You can only auction your own artworks';
    end if;
    return new;
  end if;

  -- UPDATE
  if current_setting('aurora.placing_bid', true) = 'on' then
    return new; -- place_bid is allowed to move price/leader/count
  end if;
  new.current_bid := old.current_bid;
  new.highest_bidder_id := old.highest_bidder_id;
  new.bid_count := old.bid_count;
  new.seller_id := old.seller_id;
  new.artwork_id := old.artwork_id;
  if old.bid_count > 0 then
    if new.opening_bid <> old.opening_bid or new.bid_increment <> old.bid_increment then
      raise exception 'Pricing is locked once an auction has bids';
    end if;
    if new.status = 'draft' then
      raise exception 'An auction with bids can''t go back to draft';
    end if;
  else
    new.current_bid := new.opening_bid;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_auction_write on public.auctions;
create trigger guard_auction_write
  before insert or update on public.auctions
  for each row execute function public.guard_auction_write();

-- ── place_bid: first bid may equal the opening price; counts bids ────────────
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

-- ── Public bid history (names only, never user ids or emails) ────────────────
create or replace function public.auction_bid_history(p_auction_id uuid)
returns table (
  bid_id uuid,
  bidder text,
  avatar_url text,
  amount numeric,
  created_at timestamptz,
  is_you boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         coalesce(nullif(p.username, ''), 'Collector'),
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
revoke execute on function public.auction_bid_history(uuid) from public;
grant execute on function public.auction_bid_history(uuid) to anon, authenticated;

-- ── Row level security: drafts are private, deletes can't wipe bids ──────────
drop policy if exists "auctions are publicly readable" on public.auctions;
drop policy if exists "sellers manage their own auctions" on public.auctions;
drop policy if exists "published auctions are readable" on public.auctions;
drop policy if exists "artists create auctions" on public.auctions;
drop policy if exists "sellers update their auctions" on public.auctions;
drop policy if exists "sellers delete auctions without bids" on public.auctions;

create policy "published auctions are readable" on public.auctions for select
  using (status <> 'draft' or seller_id = (select auth.uid()));
create policy "artists create auctions" on public.auctions for insert to authenticated
  with check (seller_id = (select auth.uid()) and public.is_artist((select auth.uid())));
create policy "sellers update their auctions" on public.auctions for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));
create policy "sellers delete auctions without bids" on public.auctions for delete to authenticated
  using (seller_id = (select auth.uid()) and bid_count = 0);

drop policy if exists "published artworks are publicly readable" on public.artworks;
drop policy if exists "artists manage their own artworks" on public.artworks;
drop policy if exists "artworks are readable when published" on public.artworks;
drop policy if exists "artists create artworks" on public.artworks;
drop policy if exists "artists update their artworks" on public.artworks;
drop policy if exists "artists delete artworks without bids" on public.artworks;

create policy "artworks are readable when published" on public.artworks for select
  using (
    artist_id = (select auth.uid())
    or exists (select 1 from public.auctions a where a.artwork_id = artworks.id and a.status <> 'draft')
  );
create policy "artists create artworks" on public.artworks for insert to authenticated
  with check (artist_id = (select auth.uid()) and public.is_artist((select auth.uid())));
create policy "artists update their artworks" on public.artworks for update to authenticated
  using (artist_id = (select auth.uid()))
  with check (artist_id = (select auth.uid()));
-- Deleting an artwork cascades to its auction and bids, so block it once bids exist.
create policy "artists delete artworks without bids" on public.artworks for delete to authenticated
  using (
    artist_id = (select auth.uid())
    and not exists (select 1 from public.auctions a where a.artwork_id = artworks.id and a.bid_count > 0)
  );

-- Column-level write access for the studio.
revoke insert, update on table public.auctions from authenticated;
grant insert (artwork_id, seller_id, status, opening_bid, current_bid, bid_increment, starts_at, ends_at)
  on table public.auctions to authenticated;
grant update (status, opening_bid, bid_increment, starts_at, ends_at, updated_at)
  on table public.auctions to authenticated;

revoke insert, update on table public.artworks from authenticated;
grant insert (artist_id, title, image_url, category, medium, dimensions, year, description)
  on table public.artworks to authenticated;
grant update (title, image_url, category, medium, dimensions, year, description, updated_at)
  on table public.artworks to authenticated;
