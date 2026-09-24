// Email delivery for notifications.
//
// The database queues important notifications in public.email_outbox (see
// migration 20260929_pilot_ready.sql). When RESEND_API_KEY and the service-role
// key are set, this worker sends them every 30 seconds in the person's language.
// Without a key nothing is sent (the in-app bell still shows everything).
import "./env.mjs"

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const resendKey = process.env.RESEND_API_KEY || ""
const from = process.env.EMAIL_FROM || "AURORA <onboarding@resend.dev>"
const appUrl = (process.env.APP_URL || "http://localhost:8443").replace(/\/$/, "")

export const emailConfigured = Boolean(url && serviceKey && resendKey)

const serviceHeaders = () =>
  serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey, "Content-Type": "application/json" }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }

// {placeholders} come from the notification's data. Shared with push.mjs so
// both channels speak from the same copy.
export const T = {
  en: {
    outbid: ["You’ve been outbid on {title}", "Someone bid {amount}₾. Bid {next}₾ to take the lead again."],
    won: ["You won {title}!", "Pay {total}₾ within 24 hours to secure it. Payment details are on your order page."],
    second_chance: ["Second chance: {title} can be yours", "The winner didn’t pay. It’s yours for {total}₾ if you pay within 24 hours."],
    sold: ["Sold: {title}", "Winning bid {price}₾. Please don’t ship until we confirm the buyer’s payment."],
    payment_reminder: ["Reminder: pay for {title}", "Your payment window is closing. Pay {total}₾ (reference AURORA {reference}) to keep the artwork."],
    order_expired: ["Payment window closed — {title}", "We didn’t receive payment in time, so the artwork may go to the next bidder."],
    paid_ship_now: ["Paid — please ship {title}", "The buyer’s payment is safely with AURORA. Ship the work and mark it as shipped."],
    shipped: ["{title} is on its way", "The artist has shipped your artwork. Confirm when it arrives."],
    payout_sent: ["Payout sent: {payout}₾", "Your payout for {title} is on its way to your bank account."],
    reserve_decision: ["Your decision: {title}", "Bidding ended at {amount}₾, below your reserve. Accept, decline or counter within 12 hours."],
    counter_offer: ["The artist offers you {title} for {counter}₾", "Your bid was below the reserve, but the artist made you an offer. Answer within 12 hours."],
    order_cancelled: ["Order cancelled — {title}", "This order was cancelled by AURORA. If you paid, a refund is on its way."],
    report_update: ["Update on your report — {title}", "{note}"],
    transfer_submitted: ["Transfer to check: #{reference}", "{title} · {total}₾. Confirm it in the back office."],
    report_opened: ["New problem report: #{reference}", "{title}. Review it in the back office."],
    event_lot_added: ["{title} is in “{event}”", "Your artwork was added to a live auction event."],
  },
  ka: {
    outbid: ["„{title}“ — ფსონი გადაგისწრეს", "ვიღაცამ {amount}₾ დადო. დადე {next}₾ და ისევ წინ იქნები."],
    won: ["მოიგე „{title}“!", "გადაიხადე {total}₾ 24 საათში. გადახდის დეტალები შეკვეთის გვერდზეა."],
    second_chance: ["მეორე შანსი: „{title}“ შეიძლება შენი იყოს", "გამარჯვებულმა არ გადაიხადა. ნამუშევარი შენია {total}₾-ად, თუ 24 საათში გადაიხდი."],
    sold: ["გაიყიდა: „{title}“", "მოგებული ფსონი: {price}₾. არ გააგზავნო, სანამ გადახდას არ დავადასტურებთ."],
    payment_reminder: ["შეხსენება: გადაიხადე „{title}“", "გადახდის დრო იწურება. გადაიხადე {total}₾ (დანიშნულება: AURORA {reference})."],
    order_expired: ["გადახდის დრო ამოიწურა — „{title}“", "გადახდა დროულად არ მივიღეთ, ამიტომ ნამუშევარი შეიძლება შემდეგ მონაწილეს გადაეცეს."],
    paid_ship_now: ["გადახდილია — გააგზავნე „{title}“", "მყიდველის თანხა AURORA-სთან დაცულია. გააგზავნე ნამუშევარი და მონიშნე გაგზავნილად."],
    shipped: ["„{title}“ გზაშია", "მხატვარმა ნამუშევარი გამოგიგზავნა. მიღებისას დაადასტურე."],
    payout_sent: ["ანაზღაურება გაიგზავნა: {payout}₾", "„{title}“-ის ანაზღაურება შენს ანგარიშზე მიდის."],
    reserve_decision: ["შენი გადაწყვეტილება: „{title}“", "ვაჭრობა {amount}₾-ზე დასრულდა, რეზერვზე დაბლა. 12 საათში მიიღე, უარყავი ან შესთავაზე სხვა ფასი."],
    counter_offer: ["მხატვარი „{title}“-ს {counter}₾-ად გთავაზობს", "შენი ფსონი რეზერვზე დაბალი იყო, მაგრამ მხატვარმა შეთავაზება გამოგიგზავნა. უპასუხე 12 საათში."],
    order_cancelled: ["შეკვეთა გაუქმდა — „{title}“", "შეკვეთა AURORA-მ გააუქმა. თუ გადაიხადე, თანხა დაგიბრუნდება."],
    report_update: ["განახლება შენს მიმართვაზე — „{title}“", "{note}"],
    transfer_submitted: ["შესამოწმებელი გადარიცხვა: #{reference}", "„{title}“ · {total}₾. დაადასტურე ადმინ პანელში."],
    report_opened: ["ახალი პრობლემა: #{reference}", "„{title}“. ნახე ადმინ პანელში."],
    event_lot_added: ["„{title}“ — „{event}“-ში", "შენი ნამუშევარი ლაივ აუქციონის ღონისძიებას დაემატა."],
  },
}

export const fill = (text, data) =>
  text.replace(/\{(\w+)\}/g, (_, key) => (data?.[key] == null ? "" : String(data[key])))

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch])

export function renderEmail(row) {
  const dict = T[row.locale] ?? T.ka
  const [subjectT, bodyT] = dict[row.kind] ?? T.en[row.kind] ?? ["AURORA", ""]
  const subject = fill(subjectT, row.data)
  const body = fill(bodyT, row.data)
  const link = row.link ? `${appUrl}${row.link}` : appUrl
  const cta = row.locale === "en" ? "Open AURORA" : "გახსენი AURORA"
  const html = `<!doctype html><html><body style="margin:0;background:#0d0d10;font-family:Georgia,serif;color:#f2efe8">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#181820;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;letter-spacing:-0.5px">AUR<span style="color:#e8b84b">O</span>RA</td></tr>
<tr><td style="padding-top:20px;font-size:20px;line-height:1.3">${escapeHtml(subject)}</td></tr>
<tr><td style="padding-top:10px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c5bc">${escapeHtml(body)}</td></tr>
<tr><td style="padding-top:22px"><a href="${link}" style="display:inline-block;background:#e8b84b;color:#0d0d10;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:999px">${cta}</a></td></tr>
</table></td></tr></table></body></html>`
  return { subject, text: `${subject}\n\n${body}\n\n${link}`, html }
}

async function sendBatch() {
  const response = await fetch(
    `${url}/rest/v1/email_outbox?status=eq.pending&attempts=lt.5&order=created_at.asc&limit=20`,
    { headers: serviceHeaders() },
  )
  if (!response.ok) throw new Error(`outbox read failed (${response.status})`)
  const rows = await response.json()
  for (const row of rows) {
    const { subject, text, html } = renderEmail(row)
    let patch
    try {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [row.to_email], subject, text, html }),
      })
      patch = sent.ok
        ? { status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }
        : {
            status: row.attempts + 1 >= 5 ? "failed" : "pending",
            attempts: row.attempts + 1,
            last_error: (await sent.text()).slice(0, 500),
          }
    } catch (error) {
      patch = { attempts: row.attempts + 1, last_error: String(error).slice(0, 500) }
    }
    await fetch(`${url}/rest/v1/email_outbox?id=eq.${row.id}`, {
      method: "PATCH",
      headers: serviceHeaders(),
      body: JSON.stringify(patch),
    }).catch(() => undefined)
  }
}

export function startEmailWorker() {
  if (!emailConfigured) return
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await sendBatch()
    } catch (error) {
      console.error("email worker:", error.message)
    } finally {
      running = false
    }
  }
  setInterval(tick, 30_000)
  void tick()
  console.log("Email notifications: on")
}
