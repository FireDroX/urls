import { describe, expect, it } from 'vitest'
import { linkState } from './link-state'

const NOW = Date.parse('2030-01-01T00:00:00.000Z')

describe('linkState', () => {
  it.each([
    [{ disabled: false, expiresAt: null }, 'active'],
    [{ disabled: false, expiresAt: '2030-01-02T00:00:00.000Z' }, 'active'],
    [{ disabled: false, expiresAt: '2029-12-31T00:00:00.000Z' }, 'expired'],
    [{ disabled: false, expiresAt: '2030-01-01T00:00:00.000Z' }, 'expired'],
    [{ disabled: true, expiresAt: null }, 'disabled'],
    [{ disabled: true, expiresAt: '2029-12-31T00:00:00.000Z' }, 'disabled'],
  ] as const)('maps %o to %s', (link, expected) => {
    expect(linkState(link, NOW)).toBe(expected)
  })
})
