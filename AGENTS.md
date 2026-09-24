# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

Feature-based layout. Put code in the feature it belongs to; only truly shared
pieces go in `components/` or `lib/`.

```
src/
  main.tsx                 React entry (mounts app/App.tsx inside app/providers.tsx)
  app/
    App.tsx                Router + route wrappers (pages are lazy-loaded)
    providers.tsx          Auth, catalogue and toaster providers
  components/
    ui/                    shadcn/ui primitives (generated — keep edits minimal)
    layout/                Nav (+ mobile menu, panels), Footer, UserAvatar, page skeletons
    artwork/               ArtworkCard, HeartButton, badges (LIVE / ending soon / verified)
  features/
    auth/                  auth-context (user + role), AuthDialog
    catalog/               catalogue provider + API, Landing/Discover pages, saved works
    artwork/               ArtworkDetailPage, bid API, useLiveArtwork (polling + bid history)
    artists/               Artists directory + artist profile pages
    live/                  Live lobby (/live) + one room per auction (/live/:id), Realtime chat
    info/                  About / FAQ / Terms pages
    dashboard/             /dashboard — picks collector dashboard or artist studio by role
    collector/             Collector dashboard + "my bids" API
    studio/                Artist studio: Supabase CRUD for artworks/auctions, dialogs, schemas
    orders/                Orders after an auction ends: /orders/:id page, API + RPCs, shared rows/pills
    admin/                 /admin back office (admins only): payments, payouts, problem reports, events, settings
    events/                Live-auction evenings (/events/:id), next-event banner, calendar file
    notifications/         Bell notifications stored in the DB (created by triggers)
    profile/               Profile API + editor dialog
  lib/                     supabase client, api-client, clock (shared ticker), notify, theme tokens
  styles/globals.css       Tailwind v4 entry + theme tokens
  types/index.ts           Shared domain types (Artwork, Artist, BidEntry…)
server/
  index.mjs                Node API (routes, incl. POST /api/payments/webhook)
  lib/                     env loading, Supabase REST client, demo store, payments (HMAC webhook), email worker
  data/seed.mjs            Demo lots and artists
supabase/
  schema.sql, migrations/  Run in order in the Supabase SQL editor
docs/                      Product/design brief
```

Conventions: components in PascalCase files, hooks/modules in kebab-case;
features import from `lib/`, `components/` and `types/`, and from other features
only through their public files (api.ts, contexts).

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/styles/globals.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/styles/globals.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/styles/globals.css`, so global font wiring belongs in `src/styles/globals.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Payments

Buyers pay TSISKARI (winning bid + buyer’s premium) within `payment_window_hours`
(24h). Orders are created by `settle_auctions()` (pg_cron every minute, and
opportunistically by the API). Payment is confirmed either by an admin (bank
transfer) or automatically by a provider webhook → `server/lib/payments.mjs`
(HMAC check) → `confirm_order_payment` with the service key. Secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_WEBHOOK_SECRET`) live only in the server
env — never prefix them with `VITE_`.

## Notifications, email & push

Database triggers write `public.notifications` (outbid, won, paid, shipped,
reserve decisions, payout…) — the bell shows them in the person's language via
`notify.<kind>.*` keys. Important kinds are also queued in `public.email_outbox`
(sent by `server/lib/email.mjs` via Resend when `RESEND_API_KEY` is set) and in
`public.push_outbox` (sent by `server/lib/push.mjs` via the free Web Push API
when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set — no provider, no signup,
no per-message cost). The browser side lives in `src/lib/push.ts` (subscribe/
unsubscribe) and `public/sw.js` (the service worker that shows the OS
notification and handles clicks); the toggle is in the notifications bell
panel.

## Translations

All UI text goes through `t()` / `tr()` — see `src/lib/i18n/README.md`.
