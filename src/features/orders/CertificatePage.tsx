import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import QRCode from "qrcode"
import { Printer } from "lucide-react"
import { useAuth } from "../auth/auth-context"
import { getArtwork } from "../artwork/api"
import { useI18n } from "../../lib/i18n"
import type { Artwork } from "../../types"
import { getOrder, money, type Order } from "./api"

const PAID = ["paid", "shipped", "delivered", "completed"]

/**
 * A printable certificate for a paid order. "Print or save as PDF" uses the
 * browser's own PDF export, so Georgian text and fonts always render correctly.
 */
export default function CertificatePage() {
  const { id = "" } = useParams()
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [art, setArt] = useState<Artwork | null>(null)
  const [qr, setQr] = useState("")

  useEffect(() => {
    let cancelled = false
    getOrder(id)
      .then(async (found) => {
        if (cancelled) return
        setOrder(found)
        if (!found) return
        const [artwork, code] = await Promise.all([
          getArtwork(found.artworkId).catch(() => null),
          QRCode.toDataURL(`${location.origin}/artworks/${found.artworkId}`, {
            margin: 1,
            width: 220,
            color: { dark: "#1b171d", light: "#fffaf5" },
          }),
        ])
        if (cancelled) return
        setArt(artwork)
        setQr(code)
      })
      .catch(() => !cancelled && setOrder(null))
    return () => {
      cancelled = true
    }
  }, [id])

  const allowed = order && user && [order.buyerId, order.sellerId].includes(user.id) && PAID.includes(order.status)
  if (order === undefined) return <div className="min-h-screen bg-bg" />
  if (!order || !allowed)
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4 text-center text-sm text-text-secondary">
        <div>
          <p>{t("orders.cert.notReady")}</p>
          <button onClick={() => navigate(`/orders/${id}`)} className="mt-4 text-amber underline">
            {t("orders.cert.back")}
          </button>
        </div>
      </div>
    )

  const date = new Date(order.paidAt ?? order.createdAt).toLocaleDateString(lang === "ka" ? "ka-GE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const size =
    art?.widthCm && art?.heightCm ? `${art.widthCm} × ${art.heightCm} cm` : null
  const rows: [string, string][] = [
    [t("orders.cert.artist"), art?.artist ?? order.sellerName],
    ...(art?.medium ? ([[t("orders.cert.medium"), art.medium]] as [string, string][]) : []),
    ...(art?.year ? ([[t("orders.cert.year"), String(art.year)]] as [string, string][]) : []),
    ...(size ? ([[t("orders.cert.size"), size]] as [string, string][]) : []),
    [t("orders.cert.hammer"), money(order.hammerPrice)],
    [t("orders.cert.owner"), order.buyerName],
    [t("orders.cert.date"), date],
  ]

  return (
    <div className="min-h-screen bg-bg px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[760px] items-center justify-between print:hidden">
        <button onClick={() => navigate(`/orders/${id}`)} className="text-sm text-text-secondary hover:text-text">
          ← {t("orders.cert.back")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-amber px-5 text-sm font-semibold text-bg hover:bg-amber-dark"
        >
          <Printer className="size-4" /> {t("orders.cert.print")}
        </button>
      </div>

      <article className="mx-auto max-w-[760px] rounded-sm bg-[#fffaf5] p-3 text-[#1b171d] shadow-2xl print:max-w-none print:shadow-none">
        <div className="border border-[#d9b9a3] p-2">
          <div className="border-2 border-[#1b171d] px-8 py-10 text-center sm:px-14">
            <p className="font-display text-xl font-extrabold tracking-[-0.03em]">TSISKARI</p>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.35em] text-[#b9633a]">
              {t("orders.cert.number")} {order.reference}
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("orders.cert.heading")}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#5a4a52]">{t("orders.cert.lead")}</p>

            {order.image && (
              <img
                src={order.image}
                alt=""
                crossOrigin="anonymous"
                className="mx-auto mt-8 max-h-72 w-auto rounded-sm shadow-[0_12px_40px_rgba(27,23,29,.25)]"
              />
            )}
            <h2 className="mt-6 font-display text-2xl font-bold">“{order.title}”</h2>

            <dl className="mx-auto mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-left text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-[#8a7782]">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-9 flex items-end justify-between gap-6 border-t border-[#e6d3c6] pt-6 text-left">
              <div>
                <p className="font-display text-lg font-bold italic">TSISKARI</p>
                <p className="text-[11px] text-[#8a7782]">{t("orders.cert.signed")}</p>
              </div>
              {qr && (
                <div className="text-center">
                  <img src={qr} alt="" className="size-24" />
                  <p className="mt-1 max-w-[7rem] text-[10px] leading-tight text-[#8a7782]">{t("orders.cert.verify")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
