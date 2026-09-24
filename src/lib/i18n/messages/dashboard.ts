// "dashboard" strings. Keys are prefixed "dashboard." — see src/lib/i18n/README.md.
export const en = {
  // Dashboard page
  "dashboard.signInPrompt": "Sign in to open your dashboard.",
  "dashboard.profileSavedTitle": "Profile saved",
  "dashboard.profileSavedDetail": "Your profile is up to date.",
  "dashboard.profileSaveFailed": "Couldn’t save profile",

  // Collector dashboard
  "dashboard.collector.eyebrow": "Collector dashboard",
  "dashboard.collector.welcomeBack": "Welcome back",
  "dashboard.collector.browseAuctions": "Browse auctions",
  "dashboard.collector.editProfile": "Edit profile",
  "dashboard.collector.upgradedTitle": "Artist studio unlocked",
  "dashboard.collector.upgradedDetail": "You can now create and manage your own auctions.",
  "dashboard.collector.upgradeFailed": "Couldn’t switch account",

  "dashboard.collector.tab.bids": "My bids",
  "dashboard.collector.tab.saved": "Watchlist",
  "dashboard.collector.tab.won": "Won",

  "dashboard.collector.offer.strong": "The artist offers you “{title}” for {amount}₾.",
  "dashboard.collector.offer.detail": "Your bid was below their reserve.",
  "dashboard.collector.offer.see": "See offer",

  "dashboard.collector.pay.title": "You won “{title}” — pay {amount} to secure it",
  "dashboard.collector.pay.timeLeft": "Time left",
  "dashboard.collector.pay.now": "Pay now",

  "dashboard.collector.stat.activeBids": "Active bids",
  "dashboard.collector.stat.winningNow": "Winning now",
  "dashboard.collector.stat.watchlist": "Watchlist",
  "dashboard.collector.stat.won": "Won",

  "dashboard.collector.empty.bids": "You haven’t placed any bids yet.",
  "dashboard.collector.empty.bidsAction": "Find something to bid on",
  "dashboard.collector.empty.saved": "Tap the heart on any artwork to watch it here.",
  "dashboard.collector.empty.savedAction": "Explore artworks",
  "dashboard.collector.empty.won": "Auctions you win will appear here with payment and shipping status.",

  "dashboard.collector.artist.title": "Are you an artist?",
  "dashboard.collector.artist.text":
    "Unlock your studio to list artworks and run your own auctions. You keep your bids and watchlist.",
  "dashboard.collector.artist.unlocking": "Unlocking…",
  "dashboard.collector.artist.open": "Open artist studio",

  // Bid row
  "dashboard.bid.amounts": "Your bid {amount}₾ · Current {current}₾",
  "dashboard.bid.status.offerForYou": "Offer for you",
  "dashboard.bid.status.onApproval": "On approval",
  "dashboard.bid.status.lost": "Lost",
  "dashboard.bid.status.won": "Won",
  "dashboard.bid.status.winning": "Winning",
  "dashboard.bid.status.outbid": "Outbid",
  "dashboard.bid.bidAgain": "Bid again",
} as const

export const ka: Record<keyof typeof en, string> = {
  "dashboard.signInPrompt": "პანელის სანახავად შედი ანგარიშზე.",
  "dashboard.profileSavedTitle": "პროფილი შენახულია",
  "dashboard.profileSavedDetail": "შენი პროფილი განახლდა.",
  "dashboard.profileSaveFailed": "პროფილის შენახვა ვერ მოხერხდა",

  "dashboard.collector.eyebrow": "კოლექციონერის პანელი",
  "dashboard.collector.welcomeBack": "კეთილი იყოს შენი დაბრუნება",
  "dashboard.collector.browseAuctions": "აუქციონების ნახვა",
  "dashboard.collector.editProfile": "პროფილის რედაქტირება",
  "dashboard.collector.upgradedTitle": "მხატვრის სტუდია გააქტიურდა",
  "dashboard.collector.upgradedDetail": "ახლა შეგიძლია შექმნა და მართო საკუთარი აუქციონები.",
  "dashboard.collector.upgradeFailed": "ანგარიშის შეცვლა ვერ მოხერხდა",

  "dashboard.collector.tab.bids": "ჩემი ფსონები",
  "dashboard.collector.tab.saved": "რჩეულები",
  "dashboard.collector.tab.won": "მოგებული",

  "dashboard.collector.offer.strong": "მხატვარი „{title}“-ს {amount}₾-ად გთავაზობს.",
  "dashboard.collector.offer.detail": "შენი ფსონი რეზერვის ფასზე დაბალი იყო.",
  "dashboard.collector.offer.see": "შეთავაზების ნახვა",

  "dashboard.collector.pay.title": "„{title}“ მოიგე — გადაიხადე {amount}, რომ შენი გახდეს",
  "dashboard.collector.pay.timeLeft": "დარჩენილი დრო",
  "dashboard.collector.pay.now": "გადახდა ახლავე",

  "dashboard.collector.stat.activeBids": "აქტიური ფსონები",
  "dashboard.collector.stat.winningNow": "ახლა იგებ",
  "dashboard.collector.stat.watchlist": "რჩეულები",
  "dashboard.collector.stat.won": "მოგებული",

  "dashboard.collector.empty.bids": "ჯერ ფსონი არ დაგიდია.",
  "dashboard.collector.empty.bidsAction": "იპოვე ნამუშევარი ფსონისთვის",
  "dashboard.collector.empty.saved": "დააჭირე გულს ნებისმიერ ნამუშევარზე და აქ გამოჩნდება.",
  "dashboard.collector.empty.savedAction": "ნამუშევრების ნახვა",
  "dashboard.collector.empty.won": "მოგებული აუქციონები აქ გამოჩნდება გადახდისა და მიწოდების სტატუსით.",

  "dashboard.collector.artist.title": "მხატვარი ხარ?",
  "dashboard.collector.artist.text":
    "გახსენი სტუდია, რომ ნამუშევრები დაამატო და საკუთარი აუქციონები მართო. ფსონები და რჩეულები შენთან დარჩება.",
  "dashboard.collector.artist.unlocking": "იხსნება…",
  "dashboard.collector.artist.open": "მხატვრის სტუდიის გახსნა",

  "dashboard.bid.amounts": "შენი ფსონი {amount}₾ · მიმდინარე {current}₾",
  "dashboard.bid.status.offerForYou": "შეთავაზება შენთვის",
  "dashboard.bid.status.onApproval": "ელოდება დადასტურებას",
  "dashboard.bid.status.lost": "წააგე",
  "dashboard.bid.status.won": "მოიგე",
  "dashboard.bid.status.winning": "იგებ",
  "dashboard.bid.status.outbid": "გადაგასწრეს",
  "dashboard.bid.bidAgain": "ხელახლა დადება",
}
