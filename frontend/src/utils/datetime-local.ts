function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocal(iso: string | null): string {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string | null {
  return value === '' ? null : new Date(value).toISOString()
}

export function isFutureDateTimeLocal(value: string, now = Date.now()): boolean {
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time > now
}
