import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "../../components/ui"
import { errorMessage } from "../../lib/notify"
import { useAuth } from "../auth/auth-context"
import { useI18n } from "../../lib/i18n"
import {
  getPrivateProfile,
  getProfile,
  savePrivateProfile,
  savePublicDetails,
  type PrivateProfile,
} from "./api"

/**
 * Asks only for what's missing, right when it's needed:
 *  - purpose "bid":  first/last name + phone (private)
 *  - purpose "sell": location + bio (public, shown on the artist page)
 */
export function CompleteProfileDialog({
  purpose,
  onClose,
  onDone,
}: {
  purpose: "bid" | "sell"
  onClose: () => void
  onDone: () => void
}) {
  const { user, refreshProfile } = useAuth()
  const { t } = useI18n()
  const [priv, setPriv] = useState<PrivateProfile>({ first_name: "", last_name: "", phone: "" })
  const [location, setLocation] = useState("")
  const [bio, setBio] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void Promise.all([getPrivateProfile(user), getProfile(user)]).then(([p, pub]) => {
      setPriv(p)
      setLocation(pub.location)
      setBio(pub.bio)
      setLoaded(true)
    })
  }, [user])

  if (!user) return null
  const activeUser = user

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (purpose === "bid") {
        if (priv.phone.replace(/\D/g, "").length < 7)
          throw new Error(t("profile.complete.invalidPhone"))
        await savePrivateProfile(activeUser, priv)
      } else {
        if (bio.trim().length < 30) throw new Error(t("profile.complete.bioTooShort"))
        await savePublicDetails(activeUser, { location, bio })
      }
      await refreshProfile()
      onDone()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {purpose === "bid" ? t("profile.complete.bidTitle") : t("profile.complete.sellTitle")}
          </DialogTitle>
          <DialogDescription>
            {purpose === "bid"
              ? t("profile.complete.bidText")
              : t("profile.complete.sellText")}
          </DialogDescription>
        </DialogHeader>
        {!loaded ? (
          <p className="py-6 text-center text-sm text-text-muted">{t("common.loading")}</p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            {purpose === "bid" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="cp-first" label={t("profile.field.firstName")} value={priv.first_name} autoComplete="given-name"
                    onChange={(value) => setPriv({ ...priv, first_name: value })} />
                  <TextField id="cp-last" label={t("profile.field.lastName")} value={priv.last_name} autoComplete="family-name"
                    onChange={(value) => setPriv({ ...priv, last_name: value })} />
                </div>
                <TextField id="cp-phone" label={t("profile.complete.phone")} type="tel" value={priv.phone} autoComplete="tel"
                  placeholder={t("profile.complete.phonePlaceholder")} onChange={(value) => setPriv({ ...priv, phone: value })} />
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Lock className="size-3.5" /> {t("profile.complete.privateNote")}
                </p>
              </>
            ) : (
              <>
                <TextField id="cp-location" label={t("profile.field.location")} value={location} placeholder={t("profile.field.locationPlaceholder")}
                  onChange={setLocation} />
                <div className="space-y-1.5">
                  <Label htmlFor="cp-bio" className="text-xs text-text-secondary">{t("profile.complete.shortBio")}</Label>
                  <Textarea id="cp-bio" rows={4} required value={bio} onChange={(event) => setBio(event.target.value)}
                    placeholder={t("profile.complete.bioPlaceholder")} />
                  <p className="text-right text-[11px] text-text-muted">{t("profile.complete.bioCount", { count: bio.trim().length })}</p>
                </div>
              </>
            )}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            <Button type="submit" disabled={busy} className="h-10 w-full">
              {busy ? t("common.saving") : purpose === "bid" ? t("profile.complete.saveBid") : t("profile.complete.savePublish")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-text-secondary">{label}</Label>
      <Input id={id} type={type} required value={value} placeholder={placeholder} autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)} className="h-10" />
    </div>
  )
}
