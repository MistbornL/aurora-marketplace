// Every namespace is merged into one dictionary per language.
import * as admin from "./admin"
import * as artists from "./artists"
import * as artwork from "./artwork"
import * as auth from "./auth"
import * as catalog from "./catalog"
import * as common from "./common"
import * as dashboard from "./dashboard"
import * as errors from "./errors"
import * as info from "./info"
import * as layout from "./layout"
import * as live from "./live"
import * as notify from "./notify"
import * as events from "./events"
import * as pilot from "./pilot"
import * as orders from "./orders"
import * as profile from "./profile"
import * as studio from "./studio"

const namespaces = { admin, artists, artwork, auth, catalog, common, dashboard, errors, events, info, layout, live, notify, orders, pilot, profile, studio }

export const EN = {
  ...admin.en,
  ...artists.en,
  ...artwork.en,
  ...auth.en,
  ...catalog.en,
  ...common.en,
  ...dashboard.en,
  ...errors.en,
  ...info.en,
  ...layout.en,
  ...live.en,
  ...notify.en,
  ...events.en,
  ...pilot.en,
  ...orders.en,
  ...profile.en,
  ...studio.en,
}

export type MessageKey = keyof typeof EN

export const KA = Object.assign({}, ...Object.values(namespaces).map((ns) => ns.ka)) as Record<MessageKey, string>
