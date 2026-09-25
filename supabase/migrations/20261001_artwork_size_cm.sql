-- Real, numeric artwork size so the site can show a painting at true scale
-- ("View on your wall" AR). `dimensions` stays as the human-readable label.
alter table public.artworks
  add column if not exists width_cm  numeric(6,1) check (width_cm  is null or (width_cm  > 0 and width_cm  <= 1000)),
  add column if not exists height_cm numeric(6,1) check (height_cm is null or (height_cm > 0 and height_cm <= 1000)),
  add column if not exists depth_cm  numeric(5,1) check (depth_cm  is null or (depth_cm  > 0 and depth_cm  <= 200));

comment on column public.artworks.width_cm  is 'Width in centimetres (used for AR at true size).';
comment on column public.artworks.height_cm is 'Height in centimetres (used for AR at true size).';
comment on column public.artworks.depth_cm  is 'Depth in centimetres, optional (canvas or frame depth).';

-- Artworks use column-level grants, so new columns need their own.
grant select (width_cm, height_cm, depth_cm) on public.artworks to anon, authenticated;
grant insert (width_cm, height_cm, depth_cm) on public.artworks to authenticated;
grant update (width_cm, height_cm, depth_cm) on public.artworks to authenticated;

-- Best-effort backfill from labels like "80 × 60 cm" (read as width × height).
update public.artworks a
   set width_cm  = replace((parsed.m)[1], ',', '.')::numeric,
       height_cm = replace((parsed.m)[2], ',', '.')::numeric
  from (
    select id, regexp_match(dimensions, '(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)') as m
      from public.artworks
     where width_cm is null and height_cm is null
  ) parsed
 where parsed.id = a.id
   and parsed.m is not null
   and replace((parsed.m)[1], ',', '.')::numeric between 1 and 1000
   and replace((parsed.m)[2], ',', '.')::numeric between 1 and 1000;
