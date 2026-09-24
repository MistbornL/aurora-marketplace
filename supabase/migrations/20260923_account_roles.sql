-- Account roles: one auth system, one `role` per profile (collector | artist | admin).
-- Run after 20260922_security_and_auction_foundation.sql.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role' and typnamespace = 'public'::regnamespace) then
    create type public.user_role as enum ('collector', 'artist', 'admin');
  end if;
end $$;

alter table public.profiles
  add column if not exists role public.user_role not null default 'collector';

-- New users pick collector or artist at sign-up. Never trust 'admin' from the client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'artist'
      then 'artist'::public.user_role
      else 'collector'::public.user_role end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- IMPORTANT: previously users could UPDATE every column of their own profile,
-- including `role` (i.e. make themselves admin). Restrict writes to safe columns.
revoke insert, update on table public.profiles from authenticated;
grant insert (id, display_name, username, bio, website, instagram, x_handle, avatar_url, cover_url, location)
  on table public.profiles to authenticated;
-- `id` is included because the client upserts; RLS still pins id = auth.uid().
grant update (id, display_name, username, bio, website, instagram, x_handle, avatar_url, cover_url, location, updated_at)
  on table public.profiles to authenticated;

-- Collector -> artist upgrade (one way). Admin is only granted from the dashboard/SQL.
create or replace function public.become_artist()
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  update public.profiles
     set role = 'artist', updated_at = now()
   where id = uid and role = 'collector';
  return (select role from public.profiles where id = uid);
end;
$$;
revoke execute on function public.become_artist() from public, anon;
grant execute on function public.become_artist() to authenticated;

-- Only artists can create artworks / auctions.
create or replace function public.is_artist(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role in ('artist', 'admin'));
$$;
revoke execute on function public.is_artist(uuid) from public, anon;
grant execute on function public.is_artist(uuid) to authenticated;

drop policy if exists "artists manage their own artworks" on public.artworks;
create policy "artists manage their own artworks" on public.artworks for all to authenticated
  using ((select auth.uid()) = artist_id)
  with check ((select auth.uid()) = artist_id and public.is_artist((select auth.uid())));

drop policy if exists "sellers manage their own auctions" on public.auctions;
create policy "sellers manage their own auctions" on public.auctions for all to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id and public.is_artist((select auth.uid())));
