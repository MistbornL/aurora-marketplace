import { useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "../../components/ui"
import { errorMessage, notify } from "../../lib/notify"
import { useAuth } from "./auth-context"
import { useI18n } from "../../lib/i18n"

/** Shown automatically after someone opens a password-reset email link. */
export function ResetPasswordDialog() {
  const { recovering, updatePassword } = useAuth()
  const { t } = useI18n()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!recovering) return null

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      notify(t("auth.reset.toastTitle"), t("auth.reset.toastDetail"))
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("auth.reset.title")}</DialogTitle>
          <DialogDescription>{t("auth.reset.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs text-text-secondary">
              {t("auth.reset.newPassword")}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10"
            />
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <Button type="submit" disabled={busy} className="h-10 w-full">
            {busy ? t("common.saving") : t("auth.reset.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
