# Translations (English + Georgian)

Every user-visible string goes through `t()`. The language toggle (ქა / EN) lives in the navbar.

## Using it

```tsx
import { useI18n } from "../../lib/i18n"

function Example({ count, price }: { count: number; price: number }) {
  const { t, formatDate } = useI18n()
  return (
    <>
      <h2>{t("artwork.title")}</h2>
      <p>{t("artwork.bidsCount", { count })}</p>          {/* "{count} {count|bid|bids}" */}
      <p>{t("artwork.minBid", { amount: price })}</p>      {/* "Bid at least {amount}₾" */}
      <p>{formatDate(iso, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
    </>
  )
}
```

- Outside components (async callbacks, validators, plain modules) use `tr(key, vars)` from `lib/i18n`.
- `errorMessage(error)` (lib/notify) already translates known server errors.
- Dates: use `formatDate` / `locale` from `useI18n()` instead of `toLocaleString(undefined, …)`.
- Placeholders: `{name}`. English plural: `{count|singular|plural}`. Georgian nouns don’t change after numbers
  (`{count} ფსონი`), so Georgian strings normally don’t need the plural form.
- Keep JSX structure (e.g. `<strong>` inside a sentence): split into keys like `"x.before"`, `"x.strong"`,
  `"x.after"`, or pass the value as a variable and keep emphasis around a whole short key.
- Lists of labels defined outside components: store the **key** (typed `MessageKey`) and call `t()` when rendering
  (see `components/layout/Footer.tsx`).

## Where strings live

`messages/<namespace>.ts` exports `en` (source of truth, `as const`) and `ka: Record<keyof typeof en, string>` — TypeScript
fails if a Georgian string is missing. Keys are prefixed with the namespace: `artwork.buyNow`, `studio.dialog.title`.

Namespaces: common, layout, auth, profile, catalog, artists, info, artwork, live, studio, dashboard, orders, admin, errors.

## Georgian style guide

Modern, friendly, concise UI Georgian (as on Georgian banking / e-commerce apps). Informal “შენ” (you), not “თქვენ”.
Don’t translate literally; keep sentences short. Keep brand name **TSISKARI** and “LIVE” badges in Latin.

| English | Georgian |
|---|---|
| auction / live auction / timed auction | აუქციონი / ლაივ აუქციონი / ვადიანი აუქციონი |
| artwork / lot | ნამუშევარი / ლოტი |
| artist / collector | მხატვარი / კოლექციონერი |
| buyer / seller | მყიდველი / გამყიდველი |
| bid (noun) / place a bid / bid again | ფსონი / ფსონის დადება / ხელახლა დადება |
| highest bid / current bid / opening bid | უმაღლესი ფსონი / მიმდინარე ფსონი / საწყისი ფასი |
| bid step | ფსონის ბიჯი |
| outbid | ფსონი გადაგისწრეს |
| buy it now | ახლავე ყიდვა |
| reserve price / reserve met / not met | რეზერვის ფასი / რეზერვი მიღწეულია / რეზერვი არ არის მიღწეული |
| counter-offer | საპასუხო შეთავაზება |
| on approval | ელოდება დადასტურებას |
| going once / going twice / last call | ერთი… / ორი… / ბოლო შანსი! |
| starts in / ends in | იწყება / მთავრდება (e.g. „იწყება 02:10:00-ში“ or label „დაწყებამდე“ / „დასრულებამდე“) |
| upcoming | მალე |
| watchlist / saved | რჩეულები |
| dashboard / studio | პანელი / სტუდია |
| sign in / sign up / sign out | შესვლა / რეგისტრაცია / გასვლა |
| profile | პროფილი |
| order / payment / pay now | შეკვეთა / გადახდა / გადახდა ახლავე |
| buyer's premium / commission | მყიდველის საკომისიო / საკომისიო |
| payout | ანაზღაურება |
| shipping / shipped / delivered | მიწოდება / გაგზავნილია / მიწოდებულია |
| draft / publish | მონახაზი / გამოქვეყნება |
| category names | ფერწერა, გრაფიკა, ფოტოგრაფია, ციფრული ხელოვნება, ქანდაკება |
