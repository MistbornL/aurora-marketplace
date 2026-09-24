-- Live (Copart-style) auctions, Buy it now, reserve price + seller approval.
--
-- format = 'timed' : fixed end time (as before).
-- format = 'live'  : starts at starts_at; opening window live_opening_seconds;
--                    every bid pushes the end to now() + live_bid_seconds (30s).
--                    When nobody bids for 30s it closes.
-- buy_now_price    : anyone can buy instantly while there are no bids; a bid that
--                    reaches it wins immediately.
-- reserve          : private minimum (private.auction_reserves). Ending below it
--                    → status 'awaiting_seller': the artist accepts, rejects or
--                    counters once within seller_decision_hours; the top bidder
--                    answers a counter within the same time.
-- Any auction may be scheduled (starts_at in the future → status 'scheduled').

-- ── Settings ────────────────────────────────────────────────────────────────
alter table public.platform_settings
  add column if not exists live_bid_seconds integer not null default 30,
  add column if not exists live_opening_seconds integer not null default 60,
  add column if not exists seller_decision_hours integer not null default 12;
do $$ begin
  alter table public.platform_settings add constraint platform_settings_live_bid_seconds_check check (live_bid_seconds between 10 and 300);
  alter table public.platform_settings add constraint platform_settings_live_opening_seconds_check check (live_opening_seconds between 10 and 900);
  alter table public.platform_settings add constraint platform_settings_seller_decision_hours_check check (seller_decision_hours between 1 and 72);
exception when duplicate_object then null; end $$;
grant update (live_bid_seconds, live_opening_seconds, seller_decision_hours)
  on table public.platform_settings to authenticated;

-- ── Auction columns ─────────────────────────────────────────────────────────
alter table public.auctions
  add column if not exists format text not null default 'timed',
  add column if not exists buy_now_price numeric(12,2),
  add column if not exists has_reserve boolean not null default false,
  add column if not exists reserve_met boolean not null default true,
  add column if not exists decision_deadline timestamptz,
  add column if not exists counter_offer numeric(12,2),
  add column if not exists seller_decision text,
  add column if not exists sold_via text;
do $$ begin
  alter table public.auctions add constraint auctions_format_check check (format in ('timed', 'live'));
  alter table public.auctions add constraint auctions_buy_now_check check (buy_now_price is null or buy_now_price > opening_bid);
  alter table public.auctions add constraint auctions_counter_offer_check check (counter_offer is null or counter_offer > 0);
  alter table public.auctions add constraint auctions_seller_decision_check check (seller_decision in
    ('accepted', 'rejected', 'countered', 'counter_accepted', 'counter_declined', 'expired'));
  alter table public.auctions add constraint auctions_sold_via_check check (sold_via in ('bid', 'buy_now', 'counter'));
exception when duplicate_object then null; end $$;

grant select (format, buy_now_price, has_reserve, reserve_met, decision_deadline, counter_offer, seller_decision, sold_via)
  on table public.auctions to anon, authenticated;
grant insert (format, buy_now_price), update (format, buy_now_price)
  on table public.auctions to authenticated;

-- Reserve prices are private to the seller (schema not exposed over the API).
create table if not exists private.auction_reserves (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  reserve_price numeric(12,2) not null check (reserve_price > 0)
);
revoke all on table private.auction_reserves from public, anon, authenticated;

-- ── Guards ──────────────────────────────────────────────────────────────────
-- System writes (bids, settlement, decisions) set aurora.placing_bid = on.
create or replace function public.guard_auction_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  opening_secs integer;
begin
  if current_setting('aurora.placing_bid', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.current_bid := new.opening_bid;
    new.highest_bidder_id := null;
    new.bid_count := 0;
    new.has_reserve := false;
    new.reserve_met := true;
    new.decision_deadline := null;
    new.counter_offer := null;
    new.seller_decision := null;
    new.sold_via := null;
    if new.status in ('ended', 'awaiting_seller') then
      raise exception 'Auctions end automatically';
    end if;
    if not exists (
      select 1 from public.artworks where id = new.artwork_id and artist_id = new.seller_id
    ) then
      raise exception 'You can only auction your own artworks';
    end if;
  else
    new.current_bid := old.current_bid;
    new.highest_bidder_id := old.highest_bidder_id;
    new.bid_count := old.bid_count;
    new.seller_id := old.seller_id;
    new.artwork_id := old.artwork_id;
    new.has_reserve := old.has_reserve;
    new.reserve_met := old.reserve_met;
    new.decision_deadline := old.decision_deadline;
    new.counter_offer := old.counter_offer;
    new.seller_decision := old.seller_decision;
    new.sold_via := old.sold_via;
    if old.status in ('ended', 'awaiting_seller') and new.status is distinct from old.status then
      raise exception 'This auction has finished';
    end if;
    if new.status in ('ended', 'awaiting_seller') and new.status is distinct from old.status then
      raise exception 'Auctions end automatically';
    end if;
    if old.bid_count > 0 then
      if new.opening_bid <> old.opening_bid or new.bid_increment <> old.bid_increment
         or new.format <> old.format or new.buy_now_price is distinct from old.buy_now_price then
        raise exception 'Pricing is locked once an auction has bids';
      end if;
      if new.status = 'draft' then
        raise exception 'An auction with bids can''t go back to draft';
      end if;
      if old.format = 'live' then
        new.starts_at := old.starts_at;
        new.ends_at := old.ends_at;
      end if;
    else
      new.current_bid := new.opening_bid;
    end if;
  end if;

  -- Live format: the end is derived from the start (bids extend it later).
  if new.format = 'live' and (tg_op = 'INSERT' or old.bid_count = 0) then
    if new.starts_at is null then
      raise exception 'Live auctions need a start time';
    end if;
    select live_opening_seconds into opening_secs from public.platform_settings where id = 1;
    new.ends_at := new.starts_at + make_interval(secs => coalesce(opening_secs, 60));
  end if;

  -- Published auctions starting later are "scheduled" (Upcoming).
  if new.status in ('live', 'scheduled') then
    new.status := case when coalesce(new.starts_at, now()) > now() then 'scheduled' else 'live' end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_auction_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('live', 'scheduled')
     and (tg_op = 'INSERT' or old.status not in ('live', 'scheduled'))
     and cardinality(private.missing_for_selling(new.seller_id)) > 0 then
    raise exception 'Add your location and a short bio (30+ characters) before publishing';
  end if;
  return new;
end;
$$;

-- ── Reserve (seller only) ───────────────────────────────────────────────────
create or replace function public.set_auction_reserve(p_auction_id uuid, p_reserve numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found or a.seller_id is distinct from auth.uid() then raise exception 'Auction not found'; end if;
  if a.bid_count > 0 then raise exception 'The reserve is locked once an auction has bids'; end if;
  if p_reserve is not null and p_reserve <= a.opening_bid then
    raise exception 'The reserve must be higher than the opening bid';
  end if;
  if p_reserve is null then
    delete from private.auction_reserves where auction_id = a.id;
  else
    insert into private.auction_reserves (auction_id, reserve_price) values (a.id, p_reserve)
      on conflict (auction_id) do update set reserve_price = excluded.reserve_price;
  end if;
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions set has_reserve = p_reserve is not null, reserve_met = p_reserve is null
   where id = a.id;
  perform set_config('aurora.placing_bid', 'off', true);
end;
$$;

create or replace function public.get_auction_reserve(p_auction_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select r.reserve_price from private.auction_reserves r
    join public.auctions a on a.id = r.auction_id
   where r.auction_id = p_auction_id and a.seller_id = auth.uid();
$$;

-- ── Bidding ─────────────────────────────────────────────────────────────────
create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  bidder uuid := auth.uid();
  minimum numeric;
  reserve numeric;
  bid_secs integer;
  wins_now boolean;
begin
  if bidder is null then raise exception 'Sign in to place a bid'; end if;
  if cardinality(private.missing_for_bidding(bidder)) > 0 then
    raise exception 'Complete your bidder profile (name and phone) to place bids';
  end if;

  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if a.status not in ('live', 'scheduled') or a.ends_at <= now() then
    raise exception 'This auction is not accepting bids';
  end if;
  if a.starts_at is not null and a.starts_at > now() then
    raise exception 'Bidding hasn’t started yet';
  end if;
  if a.seller_id = bidder then raise exception 'You can''t bid on your own auction'; end if;
  if a.highest_bidder_id = bidder then raise exception 'You''re already the highest bidder'; end if;

  minimum := case when a.highest_bidder_id is null then a.current_bid else a.current_bid + a.bid_increment end;
  wins_now := a.buy_now_price is not null and p_amount = a.buy_now_price;
  if a.buy_now_price is not null and p_amount > a.buy_now_price then
    raise exception 'The most you can bid is %₾ — that wins it instantly', trim_scale(a.buy_now_price);
  end if;
  if not wins_now then
    if p_amount < minimum then raise exception 'Bid must be at least %₾', trim_scale(minimum); end if;
    if mod(p_amount - a.current_bid, a.bid_increment) <> 0 then
      raise exception 'Bids must increase in %₾ steps', trim_scale(a.bid_increment);
    end if;
  elsif p_amount < a.current_bid then
    raise exception 'Bid must be at least %₾', trim_scale(minimum);
  end if;

  insert into public.bids (auction_id, bidder_id, amount) values (p_auction_id, bidder, p_amount);

  select reserve_price into reserve from private.auction_reserves where auction_id = a.id;
  select live_bid_seconds into bid_secs from public.platform_settings where id = 1;

  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions
     set current_bid = p_amount,
         highest_bidder_id = bidder,
         bid_count = bid_count + 1,
         status = case when wins_now then 'ended'::public.auction_status else 'live'::public.auction_status end,
         reserve_met = wins_now or reserve is null or p_amount >= reserve,
         sold_via = case when wins_now then 'bid' else sold_via end,
         ends_at = case
           when wins_now then greatest(now(), coalesce(starts_at, created_at) + interval '1 second')
           when format = 'live' then greatest(ends_at, now() + make_interval(secs => coalesce(bid_secs, 30)))
           else ends_at end,
         updated_at = now()
   where id = p_auction_id
  returning * into a;
  if wins_now then
    perform private.create_order(a, bidder, p_amount, false);
  end if;
  perform set_config('aurora.placing_bid', 'off', true);
  return a;
end;
$$;

-- ── Buy it now ──────────────────────────────────────────────────────────────
create or replace function public.buy_now(p_auction_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  buyer uuid := auth.uid();
  order_id uuid;
begin
  if buyer is null then raise exception 'Sign in to buy'; end if;
  if cardinality(private.missing_for_bidding(buyer)) > 0 then
    raise exception 'Complete your bidder profile (name and phone) to buy';
  end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if a.buy_now_price is null then raise exception 'This artwork has no Buy it now price'; end if;
  if a.status not in ('live', 'scheduled') or a.ends_at <= now() then
    raise exception 'This auction is no longer available';
  end if;
  if a.bid_count > 0 then raise exception 'Buy it now ended — bidding has started'; end if;
  if a.seller_id = buyer then raise exception 'You can''t buy your own artwork'; end if;

  insert into public.bids (auction_id, bidder_id, amount) values (a.id, buyer, a.buy_now_price);
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions
     set current_bid = buy_now_price, highest_bidder_id = buyer, bid_count = bid_count + 1,
         status = 'ended', sold_via = 'buy_now', reserve_met = true,
         starts_at = least(coalesce(starts_at, now()), now() - interval '1 second'),
         ends_at = now(), updated_at = now()
   where id = a.id
  returning * into a;
  order_id := private.create_order(a, buyer, a.buy_now_price, false);
  perform set_config('aurora.placing_bid', 'off', true);
  return order_id;
end;
$$;

-- ── Seller decision when the reserve wasn't met ─────────────────────────────
create or replace function private.decide_auction(p_auction_id uuid, p_decision text, p_status public.auction_status)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare a public.auctions;
begin
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions set seller_decision = p_decision, status = p_status, updated_at = now()
   where id = p_auction_id returning * into a;
  perform set_config('aurora.placing_bid', 'off', true);
  return a;
end;
$$;
revoke execute on function private.decide_auction(uuid, text, public.auction_status) from public, anon, authenticated;

create or replace function public.seller_respond(p_auction_id uuid, p_action text, p_counter numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  hours integer;
  order_id uuid;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found or a.seller_id is distinct from auth.uid() then raise exception 'Auction not found'; end if;
  if a.status <> 'awaiting_seller' or a.seller_decision is not null then
    raise exception 'There’s nothing to decide on this auction';
  end if;
  if a.decision_deadline <= now() then raise exception 'The decision window has closed'; end if;

  if p_action = 'accept' then
    perform set_config('aurora.placing_bid', 'on', true);
    update public.auctions set sold_via = 'bid' where id = a.id;
    a := private.decide_auction(a.id, 'accepted', 'ended');
    order_id := private.create_order(a, a.highest_bidder_id, a.current_bid, false);
    return order_id;
  elsif p_action = 'reject' then
    perform private.decide_auction(a.id, 'rejected', 'ended');
    return null;
  elsif p_action = 'counter' then
    if p_counter is null or p_counter <= a.current_bid then
      raise exception 'A counter-offer must be higher than the top bid (%₾)', trim_scale(a.current_bid);
    end if;
    select seller_decision_hours into hours from public.platform_settings where id = 1;
    perform set_config('aurora.placing_bid', 'on', true);
    update public.auctions
       set counter_offer = p_counter, seller_decision = 'countered',
           decision_deadline = now() + make_interval(hours => hours), updated_at = now()
     where id = a.id;
    perform set_config('aurora.placing_bid', 'off', true);
    return null;
  end if;
  raise exception 'Unknown action';
end;
$$;

create or replace function public.buyer_respond_counter(p_auction_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found or a.highest_bidder_id is distinct from auth.uid() then raise exception 'Auction not found'; end if;
  if a.status <> 'awaiting_seller' or a.seller_decision <> 'countered' then
    raise exception 'There’s no counter-offer to answer';
  end if;
  if a.decision_deadline <= now() then raise exception 'The counter-offer has expired'; end if;
  if not p_accept then
    perform private.decide_auction(a.id, 'counter_declined', 'ended');
    return null;
  end if;
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions set sold_via = 'counter' where id = a.id;
  a := private.decide_auction(a.id, 'counter_accepted', 'ended');
  return private.create_order(a, a.highest_bidder_id, a.counter_offer, false);
end;
$$;

revoke execute on function
  public.set_auction_reserve(uuid, numeric), public.get_auction_reserve(uuid), public.buy_now(uuid),
  public.seller_respond(uuid, text, numeric), public.buyer_respond_counter(uuid, boolean)
  from public, anon;
grant execute on function
  public.set_auction_reserve(uuid, numeric), public.get_auction_reserve(uuid), public.buy_now(uuid),
  public.seller_respond(uuid, text, numeric), public.buyer_respond_counter(uuid, boolean)
  to authenticated;

-- ── Settlement ──────────────────────────────────────────────────────────────
create or replace function public.settle_auctions()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  changed integer := 0;
  n integer;
  a public.auctions;
  o public.orders;
  next_bid record;
  reserve numeric;
  s public.platform_settings;
begin
  select * into s from public.platform_settings where id = 1;
  perform set_config('aurora.placing_bid', 'on', true);

  -- 0) Scheduled auctions whose start time has come.
  update public.auctions set status = 'live', updated_at = now()
   where status = 'scheduled' and starts_at <= now() and ends_at > now();
  get diagnostics n = row_count;
  changed := changed + n;

  -- 1) Close finished auctions.
  for a in
    select * from public.auctions
     where status in ('live', 'scheduled') and ends_at <= now()
     for update skip locked
  loop
    if a.highest_bidder_id is null then
      update public.auctions set status = 'ended', updated_at = now() where id = a.id;
    elsif a.reserve_met then
      update public.auctions set status = 'ended', sold_via = 'bid', updated_at = now()
       where id = a.id returning * into a;
      if not exists (select 1 from public.orders where auction_id = a.id and status not in ('expired', 'cancelled')) then
        perform private.create_order(a, a.highest_bidder_id, a.current_bid, false);
      end if;
    else
      update public.auctions
         set status = 'awaiting_seller', updated_at = now(),
             decision_deadline = now() + make_interval(hours => s.seller_decision_hours)
       where id = a.id;
    end if;
    changed := changed + 1;
  end loop;

  -- 1b) Seller / buyer didn’t answer in time → no sale.
  update public.auctions set status = 'ended', seller_decision = 'expired', updated_at = now()
   where status = 'awaiting_seller' and decision_deadline <= now();
  get diagnostics n = row_count;
  changed := changed + n;

  -- 2) Expire unpaid orders; strike the buyer; offer to the next bidder.
  for o in
    select * from public.orders where status = 'awaiting_payment' and pay_by <= now() for update skip locked
  loop
    update public.orders set status = 'expired', updated_at = now() where id = o.id;
    insert into public.account_standing (user_id, payment_strikes) values (o.buyer_id, 1)
      on conflict (user_id) do update
      set payment_strikes = public.account_standing.payment_strikes + 1, updated_at = now();

    select b.bidder_id, max(b.amount) as amount into next_bid
      from public.bids b
     where b.auction_id = o.auction_id
       and b.bidder_id not in (select buyer_id from public.orders where auction_id = o.auction_id)
     group by b.bidder_id
     order by max(b.amount) desc
     limit 1;
    select reserve_price into reserve from private.auction_reserves where auction_id = o.auction_id;
    -- Never offer below the artist’s reserve.
    if next_bid.bidder_id is not null and (reserve is null or next_bid.amount >= reserve) then
      select * into a from public.auctions where id = o.auction_id;
      perform private.create_order(a, next_bid.bidder_id, next_bid.amount, true);
    end if;
    changed := changed + 1;
  end loop;

  -- 3) Shipped long enough without a dispute → delivered.
  update public.orders
     set status = 'delivered', delivered_at = now(), updated_at = now()
   where status = 'shipped' and shipped_at <= now() - make_interval(days => s.auto_release_days);
  get diagnostics n = row_count;
  changed := changed + n;

  perform set_config('aurora.placing_bid', 'off', true);
  return changed;
end;
$$;
revoke execute on function public.settle_auctions() from public;
grant execute on function public.settle_auctions() to anon, authenticated;

-- Bid history stays visible for scheduled / awaiting auctions too (draft rule unchanged).
