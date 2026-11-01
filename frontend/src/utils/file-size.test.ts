import { describe, expect, it } from 'vitest'
import { formatFileSize } from './file-size'

const FR_UNITS = ['o', 'Ko', 'Mo', 'Go', 'To']
const EN_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

describe('formatFileSize', () => {
  it.each([
    [0, '0 o'],
    [512, '512 o'],
    [1536, '1,5 Ko'],
    [48 * 1024 * 1024, '48 Mo'],
    [75 * 1024 ** 3, '75 Go'],
  ])('formats %d bytes as %s in French', (bytes, expected) => {
    expect(formatFileSize(bytes, FR_UNITS, 'fr-FR').replace(/ /g, ' ')).toBe(expected)
  })

  it('uses English units and decimal point in English', () => {
    expect(formatFileSize(1536, EN_UNITS, 'en')).toBe('1.5 KB')
  })
})
