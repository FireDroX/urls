import { describe, expect, it } from 'vitest'
import { LINK_STATS_DEFAULT_DAYS, parseStatsDays, utcDayToDate } from './link-stats'

describe('parseStatsDays', () => {
  it.each([
    ['7', 7],
    ['30', 30],
    ['90', 90],
    ['365', 365],
  ])('keeps the offered period %s', (value, expected) => {
    expect(parseStatsDays(value)).toBe(expected)
  })

  it.each([null, '', '0', '-7', '12', '366', '7.5', 'abc'])('falls back to the default for %j', (value) => {
    expect(parseStatsDays(value)).toBe(LINK_STATS_DEFAULT_DAYS)
  })
})

describe('utcDayToDate', () => {
  it('reads the day as UTC midnight', () => {
    expect(utcDayToDate('2026-11-02').toISOString()).toBe('2026-11-02T00:00:00.000Z')
  })
})
