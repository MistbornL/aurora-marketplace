import { useState } from "react"
import { Star } from "lucide-react"
import { useI18n } from "../../../lib/i18n"
import { notify } from "../../../lib/notify"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui"

export function SavedWorksDialog({
  artworks,
  onArtwork,
  onClose,
}: {
  artworks: Array<{
    id: string
    title: string
    artist: string
    image: string
    currentBid: number
  }>
  onArtwork: (id: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("layout.saved.title")}</DialogTitle>
          <DialogDescription>
            {t("layout.saved.description")}
          </DialogDescription>
        </DialogHeader>
        {artworks.length ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {artworks.map((art) => (
              <Button
                key={art.id}
                variant="ghost"
                onClick={() => onArtwork(art.id)}
                className="h-auto w-full justify-start gap-3 rounded-xl p-2 text-left"
              >
                <img
                  src={art.image}
                  alt=""
                  className="size-14 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {art.title}
                  </span>
                  <span className="block truncate text-sm text-text-secondary">
                    {art.artist}
                  </span>
                </span>
                <span className="font-mono text-sm font-semibold text-amber">
                  {art.currentBid}₾
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
            {t("layout.saved.empty")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function MembershipDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [joined, setJoined] = useState(false)
  function joinWaitlist() {
    setJoined(true)
    notify(
      t("layout.membership.toastTitle"),
      t("layout.membership.toastDetail"),
    )
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-amber">
              {t("layout.account.collectors")}
            </p>
            <DialogTitle className="mt-2 text-2xl">
              {t("layout.membership.title")}
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-lg leading-6">
              {t("layout.membership.description")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: t("layout.membership.previewTitle"),
              text: t("layout.membership.previewText"),
            },
            {
              title: t("layout.membership.conciergeTitle"),
              text: t("layout.membership.conciergeText"),
            },
            {
              title: t("layout.membership.benefitsTitle"),
              text: t("layout.membership.benefitsText"),
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-surface-2 p-4"
            >
              <Star className="size-4 text-amber" />
              <p className="mt-3 font-display font-semibold text-text">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                {item.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-amber/25 bg-amber/10 p-4">
          <div>
            <p className="font-display font-semibold text-text">
              {t("layout.membership.circle")}
            </p>
            <p className="text-xs text-text-secondary">
              {t("layout.membership.price")}
            </p>
          </div>
          <Button onClick={joinWaitlist}>
            {joined ? t("layout.membership.registered") : t("layout.membership.join")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

