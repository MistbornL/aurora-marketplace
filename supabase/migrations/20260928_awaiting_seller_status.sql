-- New auction state for "reserve not met → seller decides" (Copart's "On approval").
-- Enum values must be committed before functions use them, so this runs on its own.
alter type public.auction_status add value if not exists 'awaiting_seller' after 'live';
