-- Auto-bid (maximum bid), anti-sniping for timed lots, "ending soon" alerts.
--
--  * auto_bids          : a bidder's private ceiling per auction (RLS: own rows only).
--  * private.apply_bid  : one place that records a bid and moves the auction.
--  * private.run_auto_bids : after every bid, lets the highest ceilings answer,
--                        resolving two ceilings against each other in one step
--                        so the bid history isn't flooded with increments.
--  * place_bid          : unchanged rules + anti-sniping + runs auto-bids.
--  * set_auto_bid       : set / clear your ceiling (bids for you straight away if needed).
--  * notify_ending_soon : once per bidder, ~15 minutes before a timed lot closes.
--
-- Safe to re-run.

-- ── Ceilings ─────────────────────────────────────────────────────────────────
create table if not exists public.auto_bids (
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  max_amount numeric(12,2) not null check (max_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (auction_id, bidder_id)
);
alter table public.auto_bids enable row level security;
revoke all on table public.auto_bids from anon, authenticated;
grant select on table public.auto_bids to authenticated;
drop policy if exists "bidders read their own auto-bid" on public.auto_bids;
create policy "bidders read their own auto-bid" on public.auto_bids
  for select to authenticated using (bidder_id = (select auth.uid()));

-- ── Record one bid and move the auction ──────────────────────────────────────
-- Anti-sniping: a bid in the last 60 seconds of a timed lot pushes the close to
-- 60 seconds from now. Live-format lots keep their own rule (end = now + 30s).
create or replace function private.apply_bid(p_auction uuid, p_bidder uuid, p_amount numeric)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  reserve numeric;
  bid_secs integer;
begin
  insert into public.bids (auction_id, bidder_id, amount) values (p_auction, p_bidder, p_amount);
  select reserve_price into reserve from private.auction_reserves where auction_id = p_auction;
  select live_bid_seconds into bid_secs from public.platform_settings where id = 1;

  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions
     set current_bid = p_amount,
         highest_bidder_id = p_bidder,
         bid_count = bid_count + 1,
         status = 'live'::public.auction_status,
         reserve_met = reserve is null or p_amount >= reserve,
         ends_at = case
           when format = 'live' then greatest(ends_at, now() + make_interval(secs => coalesce(bid_secs, 30)))
           when ends_at - now() < interval '60 seconds' then now() + interval '60 seconds'
           else ends_at end,
         updated_at = now()
   where id = p_auction
  returning * into a;
  perform set_config('aurora.placing_bid', 'off', true);
  return a;
end;
$$;
revoke execute on function private.apply_bid(uuid, uuid, numeric) from public, anon, authenticated;

-- ── Let ceilings answer ──────────────────────────────────────────────────────
create or replace function private.run_auto_bids(p_auction uuid)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  rival record;
  lead_max numeric;
  need numeric;
  cap numeric;
  rtop numeric;
  ltop numeric;
  n integer := 0;
begin
  select * into a from public.auctions where id = p_auction;
  loop
    exit when n >= 40
      or a.status not in ('live', 'scheduled')
      or a.ends_at <= now()
      or (a.starts_at is not null and a.starts_at > now());

    need := case when a.highest_bidder_id is null then a.current_bid else a.current_bid + a.bid_increment end;
    cap := coalesce(a.buy_now_price, 1e12); -- a bid equal to buy-now would end the auction
    exit when need >= cap;

    select ab.* into rival
      from public.auto_bids ab
     where ab.auction_id = p_auction
       and ab.bidder_id is distinct from a.highest_bidder_id
       and ab.bidder_id <> a.seller_id
       and ab.max_amount >= need
       and cardinality(private.missing_for_bidding(ab.bidder_id)) = 0
     order by ab.max_amount desc, ab.created_at asc
     limit 1;
    exit when not found;

    -- Highest amount each side can reach on the bid-increment grid.
    rtop := least(a.current_bid + floor((rival.max_amount - a.current_bid) / a.bid_increment) * a.bid_increment, cap - a.bid_increment);
    select max_amount into lead_max from public.auto_bids
     where auction_id = p_auction and bidder_id = a.highest_bidder_id;

    if lead_max is null or lead_max < need then
      -- Nobody answers: take the lead at the minimum.
      a := private.apply_bid(p_auction, rival.bidder_id, need);
    else
      ltop := least(a.current_bid + floor((lead_max - a.current_bid) / a.bid_increment) * a.bid_increment, cap - a.bid_increment);
      if rtop > ltop then
        -- The leader is pushed to their ceiling; the rival takes one step above.
        if ltop > a.current_bid then
          a := private.apply_bid(p_auction, a.highest_bidder_id, ltop);
        end if;
        a := private.apply_bid(p_auction, rival.bidder_id, least(rtop, ltop + a.bid_increment));
      else
        -- The leader holds (ties go to whoever was there first).
        a := private.apply_bid(p_auction, rival.bidder_id, rtop);
        a := private.apply_bid(p_auction, (select ab.bidder_id from public.auto_bids ab
                                            where ab.auction_id = p_auction and ab.max_amount = lead_max
                                              and ab.bidder_id is distinct from rival.bidder_id
                                            order by ab.created_at asc limit 1),
                               least(ltop, rtop + a.bid_increment));
      end if;
    end if;
    n := n + 1;
  end loop;
  return a;
end;
$$;
revoke execute on function private.run_auto_bids(uuid) from public, anon, authenticated;

-- ── place_bid: same rules, plus anti-sniping and auto-bids ───────────────────
create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  bidder uuid := auth.uid();
  previous uuid;
  minimum numeric;
  reserve numeric;
  bid_secs integer;
  wins_now boolean;
  title text;
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

  previous := a.highest_bidder_id;
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

  if wins_now then
    insert into public.bids (auction_id, bidder_id, amount) values (p_auction_id, bidder, p_amount);
    select live_bid_seconds into bid_secs from public.platform_settings where id = 1;
    perform set_config('aurora.placing_bid', 'on', true);
    update public.auctions
       set current_bid = p_amount,
           highest_bidder_id = bidder,
           bid_count = bid_count + 1,
           status = 'ended'::public.auction_status,
           reserve_met = true,
           sold_via = 'bid',
           ends_at = greatest(now(), coalesce(starts_at, created_at) + interval '1 second'),
           updated_at = now()
     where id = p_auction_id
    returning * into a;
    perform private.create_order(a, bidder, p_amount, false);
    perform set_config('aurora.placing_bid', 'off', true);
  else
    a := private.apply_bid(p_auction_id, bidder, p_amount);
    -- Ceilings (the previous leader's, or anyone else's) may answer right away.
    a := private.run_auto_bids(p_auction_id);
  end if;

  select t.title into title from public.artworks t where t.id = a.artwork_id;
  -- Someone's lead changed hands: tell the previous leader, and tell the
  -- bidder if a ceiling already topped them.
  if previous is not null and previous <> a.highest_bidder_id then
    perform private.notify(previous, 'outbid',
      jsonb_build_object('title', title, 'amount', a.current_bid, 'next', a.current_bid + a.bid_increment),
      '/artworks/' || a.id);
  end if;
  if a.highest_bidder_id <> bidder and not wins_now then
    perform private.notify(bidder, 'outbid',
      jsonb_build_object('title', title, 'amount', a.current_bid, 'next', a.current_bid + a.bid_increment),
      '/artworks/' || a.id);
  end if;
  return a;
end;
$$;
revoke execute on function public.place_bid(uuid, numeric) from public, anon;
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- ── set / clear a ceiling ────────────────────────────────────────────────────
create or replace function public.set_auto_bid(p_auction_id uuid, p_max numeric)
returns public.auctions language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  bidder uuid := auth.uid();
  previous uuid;
  title text;
  need numeric;
begin
  if bidder is null then raise exception 'Sign in to place a bid'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;

  if p_max is null or p_max <= 0 then
    delete from public.auto_bids where auction_id = p_auction_id and bidder_id = bidder;
    return a;
  end if;

  if cardinality(private.missing_for_bidding(bidder)) > 0 then
    raise exception 'Complete your bidder profile (name and phone) to place bids';
  end if;
  if a.status not in ('live', 'scheduled') or a.ends_at <= now() then
    raise exception 'This auction is not accepting bids';
  end if;
  if a.seller_id = bidder then raise exception 'You can''t bid on your own auction'; end if;
  if a.buy_now_price is not null and p_max >= a.buy_now_price then
    raise exception 'Your maximum must be below the buy-now price of %₾', trim_scale(a.buy_now_price);
  end if;
  -- (PL/pgSQL stops reading an IF condition at the first THEN, so a CASE
  -- can't live inside one — work the minimum out first.)
  if a.highest_bidder_id is null then
    need := a.current_bid;
  else
    need := a.current_bid + a.bid_increment;
  end if;
  if p_max < need and a.highest_bidder_id is distinct from bidder then
    raise exception 'Your maximum must be at least %₾', trim_scale(need);
  end if;

  insert into public.auto_bids (auction_id, bidder_id, max_amount)
  values (p_auction_id, bidder, p_max)
  on conflict (auction_id, bidder_id)
  do update set max_amount = excluded.max_amount, updated_at = now();

  previous := a.highest_bidder_id;
  if a.starts_at is null or a.starts_at <= now() then
    a := private.run_auto_bids(p_auction_id);
  end if;

  if previous is not null and previous <> a.highest_bidder_id then
    select t.title into title from public.artworks t where t.id = a.artwork_id;
    perform private.notify(previous, 'outbid',
      jsonb_build_object('title', title, 'amount', a.current_bid, 'next', a.current_bid + a.bid_increment),
      '/artworks/' || a.id);
  end if;
  return a;
end;
$$;
revoke execute on function public.set_auto_bid(uuid, numeric) from public, anon;
grant execute on function public.set_auto_bid(uuid, numeric) to authenticated;

-- ── "Ending soon" — once per bidder who isn't leading ────────────────────────
create table if not exists private.ending_soon_sent (
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);

create or replace function public.notify_ending_soon()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
  title text;
begin
  for r in
    select a.id as auction_id, a.artwork_id, a.current_bid, a.bid_increment, a.ends_at, b.bidder_id
      from public.auctions a
      join (select distinct auction_id, bidder_id from public.bids) b on b.auction_id = a.id
     where a.status = 'live'
       and a.format::text <> 'live'
       and a.ends_at > now()
       and a.ends_at <= now() + interval '15 minutes'
       and b.bidder_id is distinct from a.highest_bidder_id
       and not exists (select 1 from private.ending_soon_sent s
                        where s.auction_id = a.id and s.user_id = b.bidder_id)
  loop
    insert into private.ending_soon_sent (auction_id, user_id) values (r.auction_id, r.bidder_id)
    on conflict do nothing;
    select t.title into title from public.artworks t where t.id = r.artwork_id;
    perform private.notify(r.bidder_id, 'ending_soon',
      jsonb_build_object('title', title, 'amount', r.current_bid, 'next', r.current_bid + r.bid_increment),
      '/artworks/' || r.auction_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.notify_ending_soon() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('tsiskari-ending-soon', '* * * * *', $$select public.notify_ending_soon()$$);

-- ── Email + push for the new kind (same list as before, plus ending_soon) ────
create or replace function private.notify(p_user uuid, p_kind text, p_data jsonb, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  nid bigint;
  mail text;
  loc text;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, data, link) values (p_user, p_kind, coalesce(p_data, '{}'::jsonb), p_link)
  returning id into nid;
  if p_kind in ('won', 'second_chance', 'payment_reminder', 'order_expired', 'sold', 'paid_ship_now', 'shipped',
                'payout_sent', 'reserve_decision', 'counter_offer', 'order_cancelled', 'outbid', 'report_update',
                'transfer_submitted', 'report_opened', 'event_lot_added', 'ending_soon') then
    select u.email::text, coalesce(p.locale, 'ka') into mail, loc
      from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
    if mail is not null then
      insert into public.email_outbox (notification_id, to_email, locale, kind, data, link)
      values (nid, mail, loc, p_kind, coalesce(p_data, '{}'::jsonb), p_link);
    end if;
    if exists (select 1 from public.push_subscriptions where user_id = p_user) then
      insert into public.push_outbox (notification_id, user_id, locale, kind, data, link)
      values (nid, p_user, coalesce(loc, 'ka'), p_kind, coalesce(p_data, '{}'::jsonb), p_link);
    end if;
  end if;
end;
$$;
revoke execute on function private.notify(uuid, text, jsonb, text) from public, anon, authenticated;
