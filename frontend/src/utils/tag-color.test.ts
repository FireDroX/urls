import { describe, expect, it } from 'vitest'
import { readableTextColor } from './tag-color'

describe('readableTextColor', () => {
  it('uses white on dark backgrounds', () => {
    expect(readableTextColor('#000000')).toBe('#ffffff')
    expect(readableTextColor('#1e3a8a')).toBe('#ffffff')
  })

  it('uses black on light backgrounds', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000')
    expect(readableTextColor('#fde047')).toBe('#000000')
  })

  it('falls back to white for an invalid color', () => {
    expect(readableTextColor('red')).toBe('#ffffff')
  })
})
