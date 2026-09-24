-- Orders & payments (provider-agnostic).
--
-- Flow: auction ends → order created (pay within 24h) → buyer pays
--   * bank transfer: buyer marks "sent", an admin confirms
--   * card provider (later): provider webhook → server → confirm_order_payment()
-- → paid (contacts revealed) → seller ships → buyer confirms / auto after 7 days
-- → admin sends payout (price − commission) → completed.
-- Unpaid after the window: order expires, buyer gets a strike, next-highest
-- bidder gets a second-chance order.

-- ── Settings (single row) ────────────────────────────────────────────────────
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  seller_commission_pct numeric(5,2) not null default 10 check (seller_commission_pct between 0 and 50),
  buyer_premium_pct numeric(5,2) not null default 5 check (buyer_premium_pct between 0 and 50),
  payment_window_hours integer not null default 24 check (payment_window_hours between 1 and 168),
  auto_release_days integer not null default 7 check (auto_release_days between 1 and 60),
  max_payment_strikes integer not null default 2 check (max_payment_strikes between 1 and 10),
  bank_name text not null default '',
  bank_account_holder text not null default '',
  bank_iban text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
revoke all on table public.platform_settings from anon, authenticated;
grant select on table public.platform_settings to authenticated;
drop policy if exists "signed-in users read settings" on public.platform_settings;
create policy "signed-in users read settings" on public.platform_settings for select to authenticated using (true);

-- ── Account standing (private; users can read their own, never write) ────────
create table if not exists public.account_standing (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  payment_strikes integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.account_standing enable row level security;
revoke all on table public.account_standing from anon, authenticated;
grant select on table public.account_standing to authenticated;
drop policy if exists "users read own standing" on public.account_standing;
create policy "users read own standing" on public.account_standing for select to authenticated
  using (user_id = (select auth.uid()));

-- ── Orders ───────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'order_status' and typnamespace = 'public'::regnamespace) then
    create type public.order_status as enum (
      'awaiting_payment', 'payment_submitted', 'paid', 'shipped', 'delivered', 'completed', 'expired', 'cancelled'
    );
  end if;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  auction_id uuid not null references public.auctions(id) on delete restrict,
  artwork_id uuid not null references public.artworks(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  hammer_price numeric(12,2) not null check (hammer_price > 0),
  buyer_premium numeric(12,2) not null check (buyer_premium >= 0),
  total_due numeric(12,2) not null check (total_due >= hammer_price),
  seller_commission numeric(12,2) not null check (seller_commission >= 0),
  seller_payout numeric(12,2) not null check (seller_payout >= 0),
  status public.order_status not null default 'awaiting_payment',
  second_chance boolean not null default false,
  pay_by timestamptz not null,
  payment_method text,
  payment_reference text,
  payment_submitted_at timestamptz,
  paid_at timestamptz,
  shipping_note text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  payout_reference text,
  paid_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active order per auction.
create unique index if not exists orders_one_active_per_auction
  on public.orders (auction_id) where status not in ('expired', 'cancelled');
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, pay_by);
create index if not exists orders_artwork_idx on public.orders (artwork_id);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant select on table public.orders to authenticated; -- all writes go through the functions below

create or replace function private.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;
revoke execute on function private.is_admin(uuid) from public, anon;
grant execute on function private.is_admin(uuid) to authenticated;

drop policy if exists "parties and admins read orders" on public.orders;
create policy "parties and admins read orders" on public.orders for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

-- Admins may edit settings.
drop policy if exists "admins update settings" on public.platform_settings;
create policy "admins update settings" on public.platform_settings for update to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
grant update (seller_commission_pct, buyer_premium_pct, payment_window_hours, auto_release_days,
              max_payment_strikes, bank_name, bank_account_holder, bank_iban, updated_at)
  on table public.platform_settings to authenticated;

-- Strikes block bidding.
create or replace function private.missing_for_bidding(uid uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when coalesce(pp.first_name, '') = '' or coalesce(pp.last_name, '') = '' then 'name' end,
    case when char_length(regexp_replace(coalesce(pp.phone, ''), '[^0-9]', '', 'g')) < 7 then 'phone' end,
    case when coalesce(st.payment_strikes, 0) >= (select max_payment_strikes from public.platform_settings where id = 1)
      then 'standing' end
  ], null)
  from (select 1) one
  left join public.profile_private pp on pp.id = uid
  left join public.account_standing st on st.user_id = uid;
$$;

-- ── Internal: create an order for a buyer at a price ─────────────────────────
create or replace function private.create_order(
  p_auction public.auctions, p_buyer uuid, p_price numeric, p_second_chance boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.platform_settings;
  premium numeric(12,2);
  commission numeric(12,2);
  new_id uuid;
begin
  select * into s from public.platform_settings where id = 1;
  premium := round(p_price * s.buyer_premium_pct / 100, 2);
  commission := round(p_price * s.seller_commission_pct / 100, 2);
  insert into public.orders (
    auction_id, artwork_id, buyer_id, seller_id, hammer_price, buyer_premium, total_due,
    seller_commission, seller_payout, second_chance, pay_by
  ) values (
    p_auction.id, p_auction.artwork_id, p_buyer, p_auction.seller_id, p_price, premium, p_price + premium,
    commission, p_price - commission, p_second_chance, now() + make_interval(hours => s.payment_window_hours)
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function private.create_order(public.auctions, uuid, numeric, boolean) from public, anon, authenticated;

-- ── Settlement: close auctions, expire unpaid orders, auto-confirm delivery ──
-- Idempotent; run every minute by pg_cron and opportunistically by the API.
create or replace function public.settle_auctions()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  changed integer := 0;
  n integer;
  a public.auctions;
  o public.orders;
  next_bid record;
  s public.platform_settings;
begin
  select * into s from public.platform_settings where id = 1;

  -- 1) Close ended live auctions; create an order for the winner.
  for a in
    select * from public.auctions where status = 'live' and ends_at <= now() for update skip locked
  loop
    update public.auctions set status = 'ended' where id = a.id;
    if a.highest_bidder_id is not null
       and not exists (select 1 from public.orders where auction_id = a.id and status not in ('expired', 'cancelled')) then
      perform private.create_order(a, a.highest_bidder_id, a.current_bid, false);
    end if;
    changed := changed + 1;
  end loop;

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
    if next_bid.bidder_id is not null then
      select * into a from public.auctions where id = o.auction_id;
      perform private.create_order(a, next_bid.bidder_id, next_bid.amount, true);
    end if;
    changed := changed + 1;
  end loop;

  -- 3) Shipped long enough without a dispute → delivered (payout can be released).
  update public.orders
     set status = 'delivered', delivered_at = now(), updated_at = now()
   where status = 'shipped' and shipped_at <= now() - make_interval(days => s.auto_release_days);
  get diagnostics n = row_count;
  changed := changed + n;

  return changed;
end;
$$;
revoke execute on function public.settle_auctions() from public;
grant execute on function public.settle_auctions() to anon, authenticated;

-- ── Buyer: "I've sent the bank transfer" ─────────────────────────────────────
create or replace function public.submit_order_payment(p_order_id uuid, p_note text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id is distinct from auth.uid() then raise exception 'Order not found'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'This order isn’t waiting for payment'; end if;
  if o.pay_by <= now() then raise exception 'The payment window has closed'; end if;
  update public.orders
     set status = 'payment_submitted', payment_method = 'bank_transfer',
         payment_reference = left(coalesce(nullif(trim(p_note), ''), o.reference), 120),
         payment_submitted_at = now(), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;

-- ── Admin or payment webhook (service role): mark paid ──────────────────────
create or replace function public.confirm_order_payment(
  p_order_id uuid, p_method text, p_reference text, p_amount numeric default null
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or private.is_admin(auth.uid())) then
    raise exception 'Not allowed';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'paid' then return o; end if; -- webhooks can be delivered twice
  if o.status not in ('awaiting_payment', 'payment_submitted') then
    raise exception 'Order can’t be marked paid from status %', o.status;
  end if;
  if p_amount is not null and p_amount <> o.total_due then
    raise exception 'Amount % doesn’t match total due %', p_amount, o.total_due;
  end if;
  update public.orders
     set status = 'paid', paid_at = now(), payment_method = left(p_method, 40),
         payment_reference = left(coalesce(p_reference, payment_reference), 120), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;

-- ── Seller: shipped ──────────────────────────────────────────────────────────
create or replace function public.mark_order_shipped(p_order_id uuid, p_note text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.seller_id is distinct from auth.uid() then raise exception 'Order not found'; end if;
  if o.status <> 'paid' then raise exception 'Only paid orders can be marked as shipped'; end if;
  update public.orders
     set status = 'shipped', shipped_at = now(), shipping_note = left(nullif(trim(p_note), ''), 300), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;

-- ── Buyer: received ──────────────────────────────────────────────────────────
create or replace function public.confirm_order_delivered(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id is distinct from auth.uid() then raise exception 'Order not found'; end if;
  if o.status not in ('paid', 'shipped') then raise exception 'This order can’t be confirmed yet'; end if;
  update public.orders set status = 'delivered', delivered_at = now(), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;

-- ── Admin: payout sent to the artist ────────────────────────────────────────
create or replace function public.mark_payout_sent(p_order_id uuid, p_reference text default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'delivered' then raise exception 'Payouts are released after delivery'; end if;
  update public.orders
     set status = 'completed', paid_out_at = now(), payout_reference = left(p_reference, 120), updated_at = now()
   where id = o.id returning * into o;
  return o;
end;
$$;

-- ── Admin: cancel (e.g. dispute resolved with refund) ───────────────────────
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if not private.is_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  update public.orders set status = 'cancelled', updated_at = now()
   where id = p_order_id and status not in ('completed', 'expired', 'cancelled')
  returning * into o;
  if not found then raise exception 'Order can’t be cancelled'; end if;
  return o;
end;
$$;

-- ── Contacts: only after payment, only for the two parties (and admins) ─────
create or replace function public.order_contacts(p_order_id uuid)
returns table (role text, name text, email text, phone text)
language sql stable security definer set search_path = '' as $$
  with o as (
    select * from public.orders
     where id = p_order_id
       and status in ('paid', 'shipped', 'delivered', 'completed')
       and (buyer_id = auth.uid() or seller_id = auth.uid() or private.is_admin(auth.uid()))
  )
  select 'buyer', trim(concat(pp.first_name, ' ', pp.last_name)), u.email::text, pp.phone
    from o join public.profile_private pp on pp.id = o.buyer_id join auth.users u on u.id = o.buyer_id
   where o.seller_id = auth.uid() or private.is_admin(auth.uid())
  union all
  select 'seller', trim(concat(pp.first_name, ' ', pp.last_name)), u.email::text, pp.phone
    from o join public.profile_private pp on pp.id = o.seller_id join auth.users u on u.id = o.seller_id
   where o.buyer_id = auth.uid() or private.is_admin(auth.uid());
$$;

revoke execute on function
  public.submit_order_payment(uuid, text), public.confirm_order_payment(uuid, text, text, numeric),
  public.mark_order_shipped(uuid, text), public.confirm_order_delivered(uuid),
  public.mark_payout_sent(uuid, text), public.cancel_order(uuid), public.order_contacts(uuid)
  from public, anon;
grant execute on function
  public.submit_order_payment(uuid, text), public.confirm_order_payment(uuid, text, text, numeric),
  public.mark_order_shipped(uuid, text), public.confirm_order_delivered(uuid),
  public.mark_payout_sent(uuid, text), public.cancel_order(uuid), public.order_contacts(uuid)
  to authenticated;
grant execute on function public.confirm_order_payment(uuid, text, text, numeric) to service_role;
