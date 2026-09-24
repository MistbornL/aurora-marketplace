alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text not null default '',
  add column if not exists website text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists x_handle text not null default '',
  add column if not exists avatar_url text,
  add column if not exists cover_url text,
  add column if not exists location text not null default '';

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username)) where username is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "avatars are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');
