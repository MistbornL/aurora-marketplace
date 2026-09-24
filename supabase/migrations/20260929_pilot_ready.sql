-- Pilot-ready: notifications (+ email outbox), payout details, shipping
-- address, auction events, order problem reports, language preference.

-- ── Language preference (used for emails) ───────────────────────────────────
alter table public.profiles add column if not exists locale text not null default 'ka';
do $$ begin
  alter table public.profiles add constraint profiles_locale_check check (locale in ('en', 'ka'));
exception when duplicate_object then null; end $$;
grant select (locale) on table public.profiles to anon, authenticated;
grant update (locale) on table public.profiles to authenticated;

-- ── Private details: payout account (artists) + default delivery address ────
alter table public.profile_private
  add column if not exists payout_holder text not null default '',
  add column if not exists payout_iban text not null default '',
  add column if not exists payout_bank text not null default '',
  add column if not exists ship_city text not null default '',
  add column if not exists ship_address text not null default '';

-- ── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Emails are queued here; the API server sends them when an email provider is
-- configured (no grants: only the service role can read it).
create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  notification_id bigint references public.notifications(id) on delete cascade,
  to_email text not null,
  locale text not null default 'ka',
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  link text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_pending_idx on public.email_outbox (status, created_at);
alter table public.email_outbox enable row level security;
revoke all on table public.email_outbox from anon, authenticated;

-- Kinds important enough to email.
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
                'transfer_submitted', 'report_opened', 'event_lot_added') then
    select u.email::text, coalesce(p.locale, 'ka') into mail, loc
      from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
    if mail is not null then
      insert into public.email_outbox (notification_id, to_email, locale, kind, data, link)
      values (nid, mail, loc, p_kind, coalesce(p_data, '{}'::jsonb), p_link);
    end if;
  end if;
end;
$$;
revoke execute on function private.notify(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function private.notify_admins(p_kind text, p_data jsonb, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.profiles where role = 'admin' loop
    perform private.notify(r.id, p_kind, p_data, p_link);
  end loop;
end;
$$;
revoke execute on function private.notify_admins(text, jsonb, text) from public, anon, authenticated;

-- Order events → notifications.
create or replace function private.order_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  title text;
  d jsonb;
  link text := '/orders/' || new.id;
begin
  select coalesce(a.title, 'Artwork') into title from public.artworks a where a.id = new.artwork_id;
  d := jsonb_build_object('title', title, 'total', new.total_due, 'payout', new.seller_payout,
                          'price', new.hammer_price, 'reference', new.reference, 'pay_by', new.pay_by);
  if tg_op = 'INSERT' then
    perform private.notify(new.buyer_id, case when new.second_chance then 'second_chance' else 'won' end, d, link);
    perform private.notify(new.seller_id, 'sold', d, link);
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;
  case new.status
    when 'payment_submitted' then perform private.notify_admins('transfer_submitted', d, '/admin');
    when 'paid' then
      perform private.notify(new.buyer_id, 'payment_confirmed', d, link);
      perform private.notify(new.seller_id, 'paid_ship_now', d, link);
    when 'shipped' then perform private.notify(new.buyer_id, 'shipped', d, link);
    when 'delivered' then perform private.notify(new.seller_id, 'delivered', d, link);
    when 'completed' then perform private.notify(new.seller_id, 'payout_sent', d, link);
    when 'expired' then
      perform private.notify(new.buyer_id, 'order_expired', d, link);
      perform private.notify(new.seller_id, 'buyer_no_pay', d, link);
    when 'cancelled' then
      perform private.notify(new.buyer_id, 'order_cancelled', d, link);
      perform private.notify(new.seller_id, 'order_cancelled', d, link);
    else null;
  end case;
  return new;
end;
$$;
drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert or update of status on public.orders
  for each row execute function private.order_notifications();

-- Auction events → notifications (reserve decisions, counter-offers, no sale).
create or replace function private.auction_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  title text;
  d jsonb;
  link text := '/artworks/' || new.id;
begin
  select coalesce(a.title, 'Artwork') into title from public.artworks a where a.id = new.artwork_id;
  d := jsonb_build_object('title', title, 'amount', new.current_bid, 'counter', new.counter_offer,
                          'deadline', new.decision_deadline);
  if new.status = 'awaiting_seller' and old.status is distinct from 'awaiting_seller' then
    perform private.notify(new.seller_id, 'reserve_decision', d, link);
    perform private.notify(new.highest_bidder_id, 'reserve_not_met', d, link);
  end if;
  if new.seller_decision is distinct from old.seller_decision then
    if new.seller_decision = 'countered' then
      perform private.notify(new.highest_bidder_id, 'counter_offer', d, link);
    elsif new.seller_decision in ('rejected', 'expired', 'counter_declined') then
      perform private.notify(new.highest_bidder_id, 'no_sale', d, link);
      perform private.notify(new.seller_id, 'no_sale', d, link);
    end if;
  end if;
  if new.status = 'ended' and old.status in ('live', 'scheduled') and new.bid_count = 0 then
    perform private.notify(new.seller_id, 'ended_no_bids', d, '/dashboard');
  end if;
  return new;
end;
$$;
drop trigger if exists auctions_notify on public.auctions;
create trigger auctions_notify after update on public.auctions
  for each row execute function private.auction_notifications();

-- ── Orders: reminder flag + delivery details ────────────────────────────────
alter table public.orders add column if not exists reminded_at timestamptz;

create table if not exists public.order_shipping (
  order_id uuid primary key references public.orders(id) on delete cascade,
  method text not null default 'courier' check (method in ('courier', 'pickup')),
  recipient text not null default '',
  phone text not null default '',
  city text not null default '',
  address text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.order_shipping enable row level security;
revoke all on table public.order_shipping from anon, authenticated;
grant select on table public.order_shipping to authenticated;
drop policy if exists "parties read shipping once paid" on public.order_shipping;
create policy "parties read shipping once paid" on public.order_shipping for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and (o.buyer_id = (select auth.uid())
            or private.is_admin((select auth.uid()))
            or (o.seller_id = (select auth.uid()) and o.status in ('paid', 'shipped', 'delivered', 'completed')))
  ));

create or replace function public.set_order_shipping(
  p_order_id uuid, p_method text, p_recipient text, p_phone text, p_city text, p_address text, p_notes text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or o.buyer_id is distinct from auth.uid() then raise exception 'Order not found'; end if;
  if o.status not in ('awaiting_payment', 'payment_submitted', 'paid') then
    raise exception 'Delivery details can’t be changed after shipping';
  end if;
  if p_method not in ('courier', 'pickup') then raise exception 'Unknown delivery method'; end if;
  if p_method = 'courier' and (coalesce(trim(p_city), '') = '' or coalesce(trim(p_address), '') = '') then
    raise exception 'Add a city and street address for delivery';
  end if;
  insert into public.order_shipping (order_id, method, recipient, phone, city, address, notes, updated_at)
  values (o.id, p_method, left(trim(coalesce(p_recipient, '')), 120), left(trim(coalesce(p_phone, '')), 40),
          left(trim(coalesce(p_city, '')), 80), left(trim(coalesce(p_address, '')), 300), left(trim(coalesce(p_notes, '')), 300), now())
  on conflict (order_id) do update set method = excluded.method, recipient = excluded.recipient, phone = excluded.phone,
    city = excluded.city, address = excluded.address, notes = excluded.notes, updated_at = now();
  -- Remember it for next time.
  if p_method = 'courier' then
    update public.profile_private set ship_city = left(trim(p_city), 80), ship_address = left(trim(p_address), 300)
     where id = o.buyer_id;
  end if;
end;
$$;

-- Admin sees where to send the artist's money.
create or replace function public.order_payout_account(p_order_id uuid)
returns table (holder text, iban text, bank text)
language sql stable security definer set search_path = '' as $$
  select pp.payout_holder, pp.payout_iban, pp.payout_bank
    from public.orders o join public.profile_private pp on pp.id = o.seller_id
   where o.id = p_order_id and private.is_admin(auth.uid());
$$;

-- ── Problem reports on orders ───────────────────────────────────────────────
create table if not exists public.order_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('not_received', 'not_as_described', 'damaged', 'payment', 'other')),
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists order_reports_order_idx on public.order_reports (order_id);
create index if not exists order_reports_status_idx on public.order_reports (status, created_at desc);
alter table public.order_reports enable row level security;
revoke all on table public.order_reports from anon, authenticated;
grant select on table public.order_reports to authenticated;
drop policy if exists "parties and admins read reports" on public.order_reports;
create policy "parties and admins read reports" on public.order_reports for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.orders o where o.id = order_id
               and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())))
  );

create or replace function public.report_order_problem(p_order_id uuid, p_reason text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  rid uuid;
  title text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'Order not found'; end if;
  if exists (select 1 from public.order_reports where order_id = o.id and reporter_id = auth.uid() and status = 'open') then
    raise exception 'You already have an open report for this order';
  end if;
  insert into public.order_reports (order_id, reporter_id, reason, message)
  values (o.id, auth.uid(), p_reason, left(trim(coalesce(p_message, '')), 2000))
  returning id into rid;
  select a.title into title from public.artworks a where a.id = o.artwork_id;
  perform private.notify_admins('report_opened',
    jsonb_build_object('title', title, 'reference', o.reference, 'reason', p_reason), '/admin');
  return rid;
end;
$$;

create or replace function public.resolve_order_report(p_report_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.order_reports;
  o public.orders;
  title text;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  update public.order_reports set status = 'resolved', admin_note = left(trim(coalesce(p_note, '')), 2000), resolved_at = now()
   where id = p_report_id and status = 'open' returning * into r;
  if not found then raise exception 'Report not found'; end if;
  select * into o from public.orders where id = r.order_id;
  select a.title into title from public.artworks a where a.id = o.artwork_id;
  perform private.notify(r.reporter_id, 'report_update',
    jsonb_build_object('title', title, 'reference', o.reference, 'note', r.admin_note), '/orders/' || o.id);
end;
$$;

-- ── Auction events (e.g. "Thursday Night Live") ─────────────────────────────
create table if not exists public.auction_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  starts_at timestamptz not null,
  lot_gap_minutes integer not null default 5 check (lot_gap_minutes between 1 and 120),
  cover_url text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.auction_events enable row level security;
revoke all on table public.auction_events from anon, authenticated;
grant select on table public.auction_events to anon, authenticated;
grant insert, update, delete on table public.auction_events to authenticated;
drop policy if exists "published events are public" on public.auction_events;
create policy "published events are public" on public.auction_events for select to anon
  using (published);
drop policy if exists "signed-in users see published events" on public.auction_events;
create policy "signed-in users see published events" on public.auction_events for select to authenticated
  using (published or private.is_admin((select auth.uid())));
drop policy if exists "admins manage events" on public.auction_events;
create policy "admins manage events" on public.auction_events for all to authenticated
  using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.auctions
  add column if not exists event_id uuid references public.auction_events(id) on delete set null,
  add column if not exists lot_number integer;
create index if not exists auctions_event_idx on public.auctions (event_id, lot_number);
grant select (event_id, lot_number) on table public.auctions to anon, authenticated;

-- Place every lot of an event: lot n starts at starts_at + (n-1) × gap.
create or replace function private.schedule_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.auction_events;
  opening integer;
  r record;
  n integer := 0;
  lot_start timestamptz;
begin
  select * into e from public.auction_events where id = p_event_id;
  select live_opening_seconds into opening from public.platform_settings where id = 1;
  perform set_config('aurora.placing_bid', 'on', true);
  for r in select id, bid_count from public.auctions where event_id = p_event_id order by lot_number nulls last, created_at loop
    n := n + 1;
    lot_start := e.starts_at + make_interval(mins => (n - 1) * e.lot_gap_minutes);
    if r.bid_count = 0 then
      update public.auctions
         set lot_number = n, format = 'live', starts_at = lot_start,
             ends_at = lot_start + make_interval(secs => coalesce(opening, 60)),
             status = case when status in ('live', 'scheduled')
                           then case when lot_start > now() then 'scheduled'::public.auction_status else 'live'::public.auction_status end
                           else status end,
             updated_at = now()
       where id = r.id;
    else
      update public.auctions set lot_number = n where id = r.id;
    end if;
  end loop;
  perform set_config('aurora.placing_bid', 'off', true);
end;
$$;
revoke execute on function private.schedule_event(uuid) from public, anon, authenticated;

create or replace function public.event_add_lot(p_event_id uuid, p_auction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  e public.auction_events;
  title text;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into e from public.auction_events where id = p_event_id;
  if not found then raise exception 'Event not found'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if a.bid_count > 0 or a.status not in ('scheduled', 'live') then
    raise exception 'Only published auctions without bids can join an event';
  end if;
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions
     set event_id = e.id,
         lot_number = coalesce((select max(lot_number) from public.auctions where event_id = e.id), 0) + 1
   where id = a.id;
  perform set_config('aurora.placing_bid', 'off', true);
  perform private.schedule_event(e.id);
  select t.title into title from public.artworks t where t.id = a.artwork_id;
  perform private.notify(a.seller_id, 'event_lot_added',
    jsonb_build_object('title', title, 'event', e.title, 'starts_at', e.starts_at), '/events/' || e.id);
end;
$$;

create or replace function public.event_remove_lot(p_auction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.auctions;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found or a.event_id is null then raise exception 'Auction not found'; end if;
  if a.bid_count > 0 then raise exception 'This lot already has bids'; end if;
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions set event_id = null, lot_number = null where id = a.id;
  perform set_config('aurora.placing_bid', 'off', true);
  perform private.schedule_event(a.event_id);
end;
$$;

-- Admin moved lots or changed the event time → re-place every lot.
create or replace function public.event_reschedule(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  perform private.schedule_event(p_event_id);
end;
$$;

create or replace function public.event_move_lot(p_auction_id uuid, p_direction integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions;
  other public.auctions;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into a from public.auctions where id = p_auction_id;
  if not found or a.event_id is null then raise exception 'Auction not found'; end if;
  select * into other from public.auctions
   where event_id = a.event_id and lot_number = a.lot_number + sign(p_direction)::int;
  if not found then return; end if;
  perform set_config('aurora.placing_bid', 'on', true);
  update public.auctions set lot_number = other.lot_number where id = a.id;
  update public.auctions set lot_number = a.lot_number where id = other.id;
  perform set_config('aurora.placing_bid', 'off', true);
  perform private.schedule_event(a.event_id);
end;
$$;

revoke execute on function
  public.set_order_shipping(uuid, text, text, text, text, text, text), public.order_payout_account(uuid),
  public.report_order_problem(uuid, text, text), public.resolve_order_report(uuid, text),
  public.event_add_lot(uuid, uuid), public.event_remove_lot(uuid), public.event_reschedule(uuid),
  public.event_move_lot(uuid, integer)
  from public, anon;
grant execute on function
  public.set_order_shipping(uuid, text, text, text, text, text, text), public.order_payout_account(uuid),
  public.report_order_problem(uuid, text, text), public.resolve_order_report(uuid, text),
  public.event_add_lot(uuid, uuid), public.event_remove_lot(uuid), public.event_reschedule(uuid),
  public.event_move_lot(uuid, integer)
  to authenticated;

-- ── Bidding: tell the previous leader they were outbid ──────────────────────
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

  if previous is not null and previous <> bidder then
    select t.title into title from public.artworks t where t.id = a.artwork_id;
    perform private.notify(previous, 'outbid',
      jsonb_build_object('title', title, 'amount', p_amount, 'next', p_amount + a.bid_increment),
      '/artworks/' || a.id);
  end if;
  return a;
end;
$$;

-- ── Settlement: payment reminders; open reports pause auto-release ─────────
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
  title text;
begin
  select * into s from public.platform_settings where id = 1;
  perform set_config('aurora.placing_bid', 'on', true);

  update public.auctions set status = 'live', updated_at = now()
   where status = 'scheduled' and starts_at <= now() and ends_at > now();
  get diagnostics n = row_count;
  changed := changed + n;

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

  update public.auctions set status = 'ended', seller_decision = 'expired', updated_at = now()
   where status = 'awaiting_seller' and decision_deadline <= now();
  get diagnostics n = row_count;
  changed := changed + n;

  -- Reminder when a quarter of the payment window is left.
  for o in
    select * from public.orders
     where status = 'awaiting_payment' and reminded_at is null
       and pay_by - now() <= make_interval(hours => greatest(1, s.payment_window_hours / 4))
       and pay_by > now()
     for update skip locked
  loop
    update public.orders set reminded_at = now() where id = o.id;
    select t.title into title from public.artworks t where t.id = o.artwork_id;
    perform private.notify(o.buyer_id, 'payment_reminder',
      jsonb_build_object('title', title, 'total', o.total_due, 'pay_by', o.pay_by, 'reference', o.reference),
      '/orders/' || o.id);
  end loop;

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
    if next_bid.bidder_id is not null and (reserve is null or next_bid.amount >= reserve) then
      select * into a from public.auctions where id = o.auction_id;
      perform private.create_order(a, next_bid.bidder_id, next_bid.amount, true);
    end if;
    changed := changed + 1;
  end loop;

  -- Shipped long enough without an open problem report → delivered.
  update public.orders ord
     set status = 'delivered', delivered_at = now(), updated_at = now()
   where ord.status = 'shipped' and ord.shipped_at <= now() - make_interval(days => s.auto_release_days)
     and not exists (select 1 from public.order_reports rep where rep.order_id = ord.id and rep.status = 'open');
  get diagnostics n = row_count;
  changed := changed + n;

  perform set_config('aurora.placing_bid', 'off', true);
  return changed;
end;
$$;
revoke execute on function public.settle_auctions() from public;
grant execute on function public.settle_auctions() to anon, authenticated;

-- Payouts wait while a problem report is open.
create or replace function public.mark_payout_sent(p_order_id uuid, p_reference text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'delivered' then raise exception 'Payouts are released after delivery'; end if;
  if exists (select 1 from public.order_reports where order_id = o.id and status = 'open') then
    raise exception 'Resolve the open problem report before paying out';
  end if;
  update public.orders
     set status = 'completed', paid_out_at = now(), payout_reference = left(p_reference, 120), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;
