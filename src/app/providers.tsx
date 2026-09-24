import { useEffect, type ReactNode } from "react"
import { Toaster } from "../components/ui/sonner"
import { AuthProvider } from "../features/auth/auth-context"
import { CatalogProvider } from "../features/catalog/catalog-context"
import { LanguageProvider, useI18n } from "../lib/i18n"
import { useAuth } from "../features/auth/auth-context"
import { saveLocale } from "../features/profile/api"

/** Keeps profiles.locale in sync so emails arrive in the person's language. */
function LocaleSync() {
  const { user } = useAuth()
  const { lang } = useI18n()
  useEffect(() => {
    if (user) void saveLocale(user.id, lang)
  }, [user, lang])
  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CatalogProvider>
          <LocaleSync />
          {children}
          <Toaster />
        </CatalogProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
