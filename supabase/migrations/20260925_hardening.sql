-- Follow-up from Supabase advisors.
-- 1) is_artist() is only needed inside RLS policies: move it out of the exposed
--    `public` schema so it isn't callable via /rest/v1/rpc.
-- 2) Index foreign keys used by joins and cascades.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_artist(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role in ('artist', 'admin'));
$$;
revoke execute on function private.is_artist(uuid) from public, anon;
grant execute on function private.is_artist(uuid) to authenticated;

drop policy if exists "artists create auctions" on public.auctions;
create policy "artists create auctions" on public.auctions for insert to authenticated
  with check (seller_id = (select auth.uid()) and private.is_artist((select auth.uid())));

drop policy if exists "artists create artworks" on public.artworks;
create policy "artists create artworks" on public.artworks for insert to authenticated
  with check (artist_id = (select auth.uid()) and private.is_artist((select auth.uid())));

drop function if exists public.is_artist(uuid);

create index if not exists artworks_artist_id_idx on public.artworks (artist_id);
create index if not exists auctions_highest_bidder_id_idx on public.auctions (highest_bidder_id);
