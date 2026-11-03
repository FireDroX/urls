export const LINK_STATS_DAY_OPTIONS = [7, 30, 90, 365] as const
export const LINK_STATS_DEFAULT_DAYS = 30

export function parseStatsDays(value: string | null): number {
  const days = Number(value)
  return LINK_STATS_DAY_OPTIONS.some((option) => option === days) ? days : LINK_STATS_DEFAULT_DAYS
}

export function utcDayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

export function linkDetailPath(id: string): string {
  return `/redirects/${encodeURIComponent(id)}`
}
