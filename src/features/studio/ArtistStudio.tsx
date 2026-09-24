import { useCallback, useEffect, useState } from "react"
import { errorMessage, notify } from "../../lib/notify"
import { tr } from "../../lib/i18n"
import { useAuth } from "../auth/auth-context"
import { CompleteProfileDialog } from "../profile/CompleteProfileDialog"
import { useCatalog } from "../catalog/catalog-context"
import type { Profile } from "../profile/api"
import {
  createAuction,
  deleteAuction,
  listMyAuctions,
  updateAuction,
} from "./api"
import { AuctionDialog } from "./AuctionDialog"
import { DeleteAuctionDialog } from "./DeleteAuctionDialog"
import { uploadArtworkImage } from "./media"
import type { AuctionData, ManagedAuction, StudioTab } from "./types"
import { StudioView } from "./StudioView"

/** Artist dashboard: auctions are stored in Supabase (`artworks` + `auctions`). */
export function ArtistStudio({
  userId,
  profile,
  avatar,
  cover,
  onEditProfile,
}: {
  userId: string
  profile: Profile
  avatar?: string | null
  cover?: string | null
  onEditProfile: () => void
}) {
  const { refresh: refreshCatalog } = useCatalog()
  const { readiness } = useAuth()
  // Publishing needs location + bio; drafts don't. Hold the save until completed.
  const [pendingPublish, setPendingPublish] = useState<AuctionData | null>(null)
  const [tab, setTab] = useState<StudioTab>("auctions")
  const [auctions, setAuctions] = useState<ManagedAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManagedAuction | null | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ManagedAuction | null>(null)

  const load = useCallback(async () => {
    try {
      setAuctions(await listMyAuctions(userId))
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, tr("studio.toast.loadFailed")))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function save(values: AuctionData, skipReadiness = false) {
    if (values.isLive && readiness.sell.length && !skipReadiness)
      return setPendingPublish(values)
    try {
      const imageUrl = values.image
        ? await uploadArtworkImage(userId, values.image)
        : undefined
      const saved = editing
        ? await updateAuction(editing, values, imageUrl)
        : await createAuction(userId, values, imageUrl ?? "")
      setAuctions((items) =>
        editing
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      )
      notify(
        editing
          ? tr("studio.toast.updated")
          : saved.isLive
            ? tr("studio.toast.published")
            : tr("studio.toast.draftSaved"),
        saved.isLive
          ? tr("studio.toast.publishedDetail", { amount: saved.bidIncrement })
          : tr("studio.toast.draftDetail"),
      )
      setEditing(undefined)
      void refreshCatalog({ silent: true })
    } catch (error) {
      notify(tr("studio.toast.saveFailed"), errorMessage(error), "error")
    }
  }

  async function remove() {
    if (!deleteTarget) return
    try {
      await deleteAuction(deleteTarget)
      setAuctions((items) => items.filter((item) => item.id !== deleteTarget.id))
      notify(tr("studio.toast.removed"), tr("studio.toast.removedDetail", { title: deleteTarget.title }))
      void refreshCatalog({ silent: true })
    } catch (error) {
      notify(tr("studio.toast.removeFailed"), errorMessage(error), "error")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <StudioView
        profile={profile}
        userId={userId}
        avatar={avatar}
        cover={cover}
        auctions={auctions}
        loading={loading}
        error={loadError}
        onRetry={() => void load()}
        tab={tab}
        onTabChange={setTab}
        onEditProfile={onEditProfile}
        onCreateAuction={() => setEditing(null)}
        onEditAuction={setEditing}
        onDeleteAuction={setDeleteTarget}
      />
      {editing !== undefined && (
        <AuctionDialog
          auction={editing}
          onClose={() => setEditing(undefined)}
          onSubmit={save}
        />
      )}
      {pendingPublish && (
        <CompleteProfileDialog
          purpose="sell"
          onClose={() => setPendingPublish(null)}
          onDone={() => {
            const values = pendingPublish
            setPendingPublish(null)
            void save(values, true)
          }}
        />
      )}
      {deleteTarget && (
        <DeleteAuctionDialog
          auction={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
