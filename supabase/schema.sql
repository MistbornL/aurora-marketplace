-- Run this in Supabase SQL Editor after creating the project.
create type public.user_role as enum ('collector', 'artist', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text,
  bio text not null default '',
  website text not null default '',
  instagram text not null default '',
  x_handle text not null default '',
  avatar_url text,
  cover_url text,
  location text not null default '',
  role public.user_role not null default 'collector',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create unique index profiles_username_unique
  on public.profiles (lower(username)) where username is not null;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
