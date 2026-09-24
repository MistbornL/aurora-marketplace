-- Web Push notifications: free, no third-party account needed. Browsers deliver
-- pushes through their own vendor push services (Chrome→FCM, Firefox→Mozilla…)
-- using a VAPID keypair we generate ourselves — no signup, no per-message cost.

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

-- Pushes are queued here; the API server sends them via web-push when a
-- VAPID keypair is configured (no grants: only the service role reads it).
create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  notification_id bigint references public.notifications(id) on delete cascade,
  user_id uuid not null,
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
create index if not exists push_outbox_pending_idx on public.push_outbox (status, created_at);
alter table public.push_outbox enable row level security;
revoke all on table public.push_outbox from anon, authenticated;

-- A signed-in person registers the browser subscription their service worker created.
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_key = excluded.auth_key;
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
end;
$$;
revoke execute on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- Queue a push for the same set of kinds already deemed important enough to email.
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
    if exists (select 1 from public.push_subscriptions where user_id = p_user) then
      insert into public.push_outbox (notification_id, user_id, locale, kind, data, link)
      values (nid, p_user, coalesce(loc, 'ka'), p_kind, coalesce(p_data, '{}'::jsonb), p_link);
    end if;
  end if;
end;
$$;
revoke execute on function private.notify(uuid, text, jsonb, text) from public, anon, authenticated;
