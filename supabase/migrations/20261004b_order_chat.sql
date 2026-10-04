-- Buyer ↔ seller chat on an order.
--   open   : once payment is confirmed (paid, shipped, delivered)
--   closed : when the order is completed (payout sent) or cancelled — history stays readable
--   who    : the buyer and the seller write; admins can read (for problem reports)
-- Safe to re-run.

create table if not exists public.order_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;
revoke all on table public.order_messages from anon, authenticated;
grant select on table public.order_messages to authenticated;
drop policy if exists "parties and admins read order messages" on public.order_messages;
create policy "parties and admins read order messages" on public.order_messages
  for select to authenticated using (
    exists (
      select 1 from public.orders o
       where o.id = order_id
         and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
              or private.is_admin((select auth.uid())))
    )
  );

-- Realtime: new messages stream to the two people in the order.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;

-- Writing goes through one function that checks who and when.
create or replace function public.post_order_message(p_order_id uuid, p_body text)
returns public.order_messages language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o public.orders;
  msg public.order_messages;
  other uuid;
  sender_name text;
  title text;
  text_body text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'Sign in to send a message'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found or me not in (o.buyer_id, o.seller_id) then
    raise exception 'Order not found';
  end if;
  if o.status not in ('paid', 'shipped', 'delivered') then
    raise exception 'The chat for this order is closed';
  end if;
  if char_length(text_body) = 0 then raise exception 'Write a message first'; end if;
  if char_length(text_body) > 1000 then raise exception 'Messages can be up to 1000 characters'; end if;
  if exists (select 1 from public.order_messages
              where order_id = p_order_id and sender_id = me and created_at > now() - interval '1 second') then
    raise exception 'You''re sending messages too fast';
  end if;

  insert into public.order_messages (order_id, sender_id, body)
  values (p_order_id, me, text_body) returning * into msg;

  -- Tell the other person, but at most once per 10 minutes while they haven't read it.
  other := case when me = o.buyer_id then o.seller_id else o.buyer_id end;
  if not exists (
    select 1 from public.notifications n
     where n.user_id = other and n.kind = 'order_message' and n.link = '/orders/' || o.id
       and n.read_at is null and n.created_at > now() - interval '10 minutes'
  ) then
    select coalesce(p.display_name, p.username, '') into sender_name from public.profiles p where p.id = me;
    select coalesce(a.title, 'Artwork') into title from public.artworks a where a.id = o.artwork_id;
    perform private.notify(other, 'order_message',
      jsonb_build_object('title', title, 'from', sender_name, 'preview', left(text_body, 90)),
      '/orders/' || o.id);
  end if;
  return msg;
end;
$$;
revoke execute on function public.post_order_message(uuid, text) from public, anon;
grant execute on function public.post_order_message(uuid, text) to authenticated;

-- Email + push for the new kind (same list as before, plus order_message).
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
                'transfer_submitted', 'report_opened', 'event_lot_added', 'ending_soon', 'order_message') then
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
