-- Run this after the profile migration in Supabase SQL Editor.
-- Public reading is intentional: published artwork thumbnails must be viewable by collectors.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork-images', 'artwork-images', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "users can upload their own artwork images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "artwork images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'artwork-images');
