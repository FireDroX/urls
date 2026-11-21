import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relative-time'

const NOW = new Date('2026-11-19T12:00:00Z')
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

describe('formatRelativeTime', () => {
  it.each([
    [10, 'il y a 10 secondes'],
    [60, 'il y a 1 minute'],
    [3 * 3600, 'il y a 3 heures'],
    [24 * 3600, 'hier'],
    [5 * 24 * 3600, 'il y a 5 jours'],
    [70 * 24 * 3600, 'il y a 2 mois'],
    [800 * 24 * 3600, 'il y a 2 ans'],
  ])('formats %i seconds ago in French', (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), NOW, 'fr')).toBe(expected)
  })

  it('formats in English', () => {
    expect(formatRelativeTime(ago(2 * 3600), NOW, 'en')).toBe('2 hours ago')
  })

  it('formats a future date', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 2 * 24 * 3600 * 1000), NOW, 'en')).toBe('in 2 days')
  })
})
