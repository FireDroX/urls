import { describe, expect, it } from 'vitest'
import { fromDateTimeLocal, isFutureDateTimeLocal, toDateTimeLocal } from './datetime-local'

describe('datetime-local conversion', () => {
  it('round-trips a local date without seconds', () => {
    const local = '2030-01-02T03:04'

    expect(toDateTimeLocal(fromDateTimeLocal(local))).toBe(local)
  })

  it('maps an empty value to no date', () => {
    expect(toDateTimeLocal(null)).toBe('')
    expect(fromDateTimeLocal('')).toBeNull()
  })

  it('tells whether a local date is in the future', () => {
    const now = new Date('2030-01-02T03:04').getTime()

    expect(isFutureDateTimeLocal('2030-01-02T03:05', now)).toBe(true)
    expect(isFutureDateTimeLocal('2030-01-02T03:04', now)).toBe(false)
    expect(isFutureDateTimeLocal('not a date', now)).toBe(false)
  })
})
