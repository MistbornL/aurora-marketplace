-- Saving a profile is an upsert (INSERT .. ON CONFLICT DO UPDATE), which needs INSERT
-- on every column it sends. name_display only had UPDATE, so saving returned 403.
grant insert (name_display, locale) on table public.profiles to authenticated;
