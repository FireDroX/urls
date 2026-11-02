export type LinkState = 'active' | 'disabled' | 'expired'

interface LinkStatus {
  disabled: boolean
  expiresAt: string | null
}

export function linkState(link: LinkStatus, now = Date.now()): LinkState {
  if (link.disabled) {
    return 'disabled'
  }
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now) {
    return 'expired'
  }
  return 'active'
}
