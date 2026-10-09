-- Bank of Georgia card payments: remember the BOG order that belongs to each of
-- our orders so the callback, the return page and the reconciler can find it.
-- Written only by the API server (service role).
alter table public.orders add column if not exists bog_order_id text;
create index if not exists orders_bog_order_id_idx on public.orders (bog_order_id) where bog_order_id is not null;
