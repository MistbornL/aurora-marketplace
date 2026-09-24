export function dateFromAuctionValue(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function formatAuctionDateTime(date: Date, time: string) {
  const [hours = "12", minutes = "00"] = time.split(":")
  const selected = new Date(date)
  selected.setHours(Number(hours), Number(minutes), 0, 0)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}T${pad(selected.getHours())}:${pad(selected.getMinutes())}`
}

/** ISO timestamp from the DB → local "YYYY-MM-DDTHH:mm" for the picker. */
export function isoToLocalValue(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return formatAuctionDateTime(date, `${pad(date.getHours())}:${pad(date.getMinutes())}`)
}
