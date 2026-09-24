export type ChatItem = {
  id: string
  kind: "chat" | "bid" | "system"
  user?: string
  avatar?: string | null
  text: string
  amount?: number
  at: number
  isMe?: boolean
}

export const MAX_MESSAGE_LENGTH = 280
export const MIN_SEND_INTERVAL_MS = 1500
export const MAX_MESSAGES = 200

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function clockTime(at: number, locale?: string) {
  return new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
}
