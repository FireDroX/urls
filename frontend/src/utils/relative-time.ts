const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 365 * 24 * 3600 },
  { unit: 'month', seconds: 30 * 24 * 3600 },
  { unit: 'day', seconds: 24 * 3600 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
]

export function formatRelativeTime(date: Date, now: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const elapsed = Math.round((date.getTime() - now.getTime()) / 1000)
  const absolute = Math.abs(elapsed)
  const match = UNITS.find(({ seconds }) => absolute >= seconds)
  if (!match) return formatter.format(elapsed, 'second')
  return formatter.format(Math.trunc(elapsed / match.seconds), match.unit)
}
