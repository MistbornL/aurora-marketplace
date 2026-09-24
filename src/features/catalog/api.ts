import { apiFetch } from "../../lib/api-client"
import type { Catalog } from "../../types"

/** `fresh` skips the server's 5-second cache (used right after your own changes). */
export const getCatalog = (signal?: AbortSignal, fresh = false) =>
  apiFetch<Catalog>(fresh ? "/catalog?fresh=1" : "/catalog", { signal })
