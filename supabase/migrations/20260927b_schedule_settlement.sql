-- Run settlement every minute (Supabase: pg_cron). Safe to re-run: the job is
-- upserted by name.
create extension if not exists pg_cron;
select cron.schedule('aurora-settle-auctions', '* * * * *', $$select public.settle_auctions()$$);
