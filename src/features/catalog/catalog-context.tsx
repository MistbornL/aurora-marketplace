import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { tr } from "../../lib/i18n"
import { getCatalog } from "./api"
import type { Catalog } from "../../types"

type CatalogState = Catalog & {
  loading: boolean
  error: string | null
  refresh: (options?: { silent?: boolean }) => Promise<void>
}
const CatalogContext = createContext<CatalogState | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>({ artworks: [], artists: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    try {
      // Silent refreshes follow the person's own changes: skip the server cache.
      setCatalog(await getCatalog(undefined, silent))
      setError(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : tr("catalog.loadFailed"),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])
  const value = useMemo(
    () => ({ ...catalog, loading, error, refresh }),
    [catalog, loading, error, refresh],
  )
  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context)
    throw new Error("useCatalog must be used inside CatalogProvider")
  return context
}
