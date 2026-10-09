-- Google sign-in. Google gives given_name / family_name / full_name / picture in
-- the user metadata (not our first_name / last_name). Use them so a Google
-- account arrives with a real name and photo; email sign-ups behave as before.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  fullname text := nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  fname text := nullif(trim(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(fullname, ' ', 1), '')), '');
  lname text := nullif(trim(coalesce(
    meta ->> 'last_name',
    meta ->> 'family_name',
    case when fullname like '% %' then substr(fullname, position(' ' in fullname) + 1) end,
    ''
  )), '');
  base text;
  candidate text;
begin
  base := lower(regexp_replace(
    coalesce(
      nullif(meta ->> 'username', ''),
      nullif(trim(concat(fname, ' ', left(lname, 1))), ''),
      split_part(new.email, '@', 1)
    ),
    '[^a-zA-Z0-9_.]+', '', 'g'));
  if char_length(base) < 3 then base := 'collector'; end if;
  candidate := left(base, 24);
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    candidate := left(base, 20) || (floor(random() * 9000) + 1000)::int;
  end loop;

  insert into public.profiles (id, display_name, username, role, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(concat(fname, ' ', lname)), ''), candidate),
    candidate,
    case when meta ->> 'role' = 'artist' then 'artist'::public.user_role else 'collector'::public.user_role end,
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', ''))
  );
  insert into public.profile_private (id, first_name, last_name)
  values (new.id, left(coalesce(fname, ''), 80), left(coalesce(lname, ''), 80));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
