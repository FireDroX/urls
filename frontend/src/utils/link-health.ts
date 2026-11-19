import type { LinkLastCheck } from '#api/links'

export type LinkHealth = 'broken' | 'unchecked' | 'ok'

export function linkHealth(lastCheck: LinkLastCheck | null): LinkHealth {
  if (lastCheck?.broken) return 'broken'
  if (!lastCheck || lastCheck.outcome === 'skipped') return 'unchecked'
  return 'ok'
}
