import { useState, type FormEvent, type ReactNode } from "react"
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
} from "../../components/ui"
import { errorMessage, notify } from "../../lib/notify"
import { tr, useI18n } from "../../lib/i18n"
import { useAuth, type SignUpRole } from "./auth-context"

type Mode = "sign-in" | "sign-up" | "forgot" | "check-email"

type Props = {
  onClose: () => void
  initialMode?: "sign-in" | "sign-up"
  initialRole?: SignUpRole
}

/** Turns Supabase auth errors into something a person can act on. */
function friendly(error: unknown): string {
  // Match on the raw (English) server text; errorMessage() may already be translated.
  const raw = error instanceof Error ? error.message : ""
  if (/invalid login credentials/i.test(raw)) return tr("auth.error.invalidCredentials")
  if (/email not confirmed/i.test(raw)) return tr("auth.error.emailNotConfirmed")
  if (/rate limit|too many/i.test(raw)) return tr("auth.error.rateLimit")
  if (/already (registered|exists)/i.test(raw)) return tr("auth.error.alreadyExists")
  return errorMessage(error, tr("auth.error.generic"))
}

export function AuthDialog({
  onClose,
  initialMode = "sign-in",
  initialRole = "collector",
}: Props) {
  const { signIn, signUp, sendPasswordReset, resendConfirmation, configured } =
    useAuth()
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [sentFor, setSentFor] = useState<"sign-up" | "reset">("sign-up")
  const [role, setRole] = useState<SignUpRole>(initialRole)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => {
    setError(null)
    setMode(next)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError(friendly(reason))
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === "sign-in")
      return void run(async () => {
        await signIn(email.trim(), password)
        notify(t("auth.toast.signedInTitle"), t("auth.toast.signedInDetail"))
        onClose()
      })
    if (mode === "sign-up")
      return void run(async () => {
        if (!acceptedTerms) throw new Error(t("auth.error.acceptTerms"))
        const { needsConfirmation } = await signUp({
          email,
          password,
          firstName,
          lastName,
          role,
        })
        if (needsConfirmation) {
          setSentFor("sign-up")
          setMode("check-email")
        } else {
          notify(
            t("auth.toast.welcomeTitle"),
            t(role === "artist" ? "auth.toast.artistReady" : "auth.toast.collectorReady"),
          )
          onClose()
        }
      })
    if (mode === "forgot")
      return void run(async () => {
        await sendPasswordReset(email)
        setSentFor("reset")
        setMode("check-email")
      })
  }

  const titles: Record<Mode, { title: string; text: string }> = {
    "sign-in": { title: t("auth.signIn.title"), text: t("auth.signIn.text") },
    "sign-up": { title: t("auth.signUp.title"), text: t("auth.signUp.text") },
    forgot: { title: t("auth.forgot.title"), text: t("auth.forgot.text") },
    "check-email": {
      title: t("auth.checkEmail.title"),
      text:
        sentFor === "sign-up"
          ? t("auth.checkEmail.textSignUp")
          : t("auth.checkEmail.textReset"),
    },
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        {/* Brand header */}
        <div className="relative border-b border-white/[.06] bg-gradient-to-br from-amber/[.12] via-transparent to-transparent px-6 pb-5 pt-6">
          {(mode === "forgot" || mode === "check-email") && (
            <button
              onClick={() => switchMode("sign-in")}
              className="mb-3 flex items-center gap-1 text-xs text-text-secondary hover:text-text"
            >
              <ArrowLeft className="size-3.5" /> {t("auth.backToSignIn")}
            </button>
          )}
          <span className="font-display text-sm font-extrabold tracking-[-0.03em] text-text">
            AUR
            <span className="mx-px inline-grid size-4 place-items-center rounded-full bg-amber align-middle text-[9px] text-bg">
              O
            </span>
            RA
          </span>
          <DialogTitle className="mt-3 font-display text-2xl font-bold text-text">
            {titles[mode].title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-text-secondary">
            {titles[mode].text}
          </DialogDescription>

          {(mode === "sign-in" || mode === "sign-up") && (
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-black/30 p-1 text-sm">
              {(["sign-in", "sign-up"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchMode(item)}
                  className={`rounded-lg py-2 font-medium transition-colors ${
                    mode === item ? "bg-white/[.09] text-text" : "text-text-muted hover:text-text"
                  }`}
                >
                  {item === "sign-in" ? t("auth.tab.signIn") : t("auth.tab.createAccount")}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-5">
          {mode === "check-email" ? (
            <CheckEmail
              email={email}
              forSignUp={sentFor === "sign-up"}
              busy={busy}
              error={error}
              onResend={() =>
                void run(async () => {
                  if (sentFor === "sign-up") await resendConfirmation(email)
                  else await sendPasswordReset(email)
                  notify(t("auth.toast.resentTitle"), t("auth.toast.resentDetail", { email }))
                })
              }
              onDone={onClose}
            />
          ) : (
            <form className="space-y-4" onSubmit={submit} noValidate={false}>
              {mode === "sign-up" && (
                <>
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-text-secondary">
                      {t("auth.iWantTo")}
                    </legend>
                    <div role="radiogroup" className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: "collector", title: t("auth.role.collectorTitle"), text: t("auth.role.collectorText") },
                          { key: "artist", title: t("auth.role.artistTitle"), text: t("auth.role.artistText") },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          role="radio"
                          aria-checked={role === option.key}
                          onClick={() => setRole(option.key)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            role === option.key
                              ? "border-amber bg-amber/10"
                              : "border-white/10 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`block text-sm font-semibold ${
                              role === option.key ? "text-amber" : "text-text"
                            }`}
                          >
                            {option.title}
                          </span>
                          <span className="block text-[11px] text-text-muted">{option.text}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("auth.firstName")} id="auth-first">
                      <Input
                        id="auth-first"
                        required
                        autoComplete="given-name"
                        maxLength={80}
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        className="h-10"
                      />
                    </Field>
                    <Field label={t("auth.lastName")} id="auth-last">
                      <Input
                        id="auth-last"
                        required
                        autoComplete="family-name"
                        maxLength={80}
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        className="h-10"
                      />
                    </Field>
                  </div>
                </>
              )}

              <Field label={t("auth.email")} id="auth-email">
                <Input
                  id="auth-email"
                  required
                  type="email"
                  autoComplete="email"
                  autoFocus={mode !== "sign-up"}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className="h-10"
                />
              </Field>

              {mode !== "forgot" && (
                <Field
                  label={t("auth.password")}
                  id="auth-password"
                  aside={
                    mode === "sign-in" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-amber hover:text-amber/80"
                      >
                        {t("auth.forgotPassword")}
                      </button>
                    )
                  }
                >
                  <div className="relative">
                    <Input
                      id="auth-password"
                      required
                      minLength={8}
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-text-muted hover:text-text"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {mode === "sign-up" && <PasswordHint password={password} />}
                </Field>
              )}

              {mode === "sign-up" && (
                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-text-secondary">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-0.5 size-4 accent-[#e8b84b]"
                  />
                  {t("auth.acceptTerms")}
                </label>
              )}

              {error && (
                <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
              {!configured && (
                <p className="text-xs text-amber">
                  {t("auth.notConfigured")}
                </p>
              )}

              <Button
                type="submit"
                disabled={busy || (mode === "sign-up" && !acceptedTerms)}
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "sign-in"
                  ? t("auth.submit.signIn")
                  : mode === "sign-up"
                    ? role === "artist"
                      ? t("auth.submit.createArtistAccount")
                      : t("auth.submit.createAccount")
                    : t("auth.submit.sendResetLink")}
              </Button>

              {mode === "sign-up" && (
                <p className="text-center text-[11px] leading-5 text-text-muted">
                  {t("auth.privacyNote")}
                </p>
              )}
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  id,
  aside,
  children,
}: {
  label: string
  id: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium text-text-secondary">
          {label}
        </Label>
        {aside}
      </div>
      {children}
    </div>
  )
}

function PasswordHint({ password }: { password: string }) {
  const { t } = useI18n()
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d|[^A-Za-z]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = [
    t("auth.password.tooShort"),
    t("auth.password.okay"),
    t("auth.password.good"),
    t("auth.password.strong"),
  ]
  const colors = ["bg-red-500", "bg-amber", "bg-amber", "bg-emerald-500"]
  if (!password) return <p className="text-[11px] text-text-muted">{t("auth.password.atLeast8")}</p>
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index < score ? colors[score] : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="text-[11px] text-text-muted">
        {password.length < 8 ? labels[0] : labels[score]}
      </span>
    </div>
  )
}

function CheckEmail({
  email,
  forSignUp,
  busy,
  error,
  onResend,
  onDone,
}: {
  email: string
  forSignUp: boolean
  busy: boolean
  error: string | null
  onResend: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber/10 text-amber">
        <MailCheck className="size-7" />
      </span>
      <p className="mt-4 text-sm text-text-secondary">
        {forSignUp ? t("auth.checkEmail.sentConfirmation") : t("auth.checkEmail.sentReset")}
      </p>
      <p className="mt-0.5 font-medium text-text">{email}</p>
      <p className="mt-3 text-xs leading-5 text-text-muted">
        {forSignUp
          ? t("auth.checkEmail.openSignUp")
          : t("auth.checkEmail.openReset")}{" "}
        {t("auth.checkEmail.checkSpam")}
      </p>
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      <div className="mt-5 grid w-full grid-cols-2 gap-2">
        <Button variant="outline" className="h-10" disabled={busy} onClick={onResend}>
          {t("auth.checkEmail.resend")}
        </Button>
        <Button className="h-10" onClick={onDone}>
          {t("auth.checkEmail.done")}
        </Button>
      </div>
    </div>
  )
}
